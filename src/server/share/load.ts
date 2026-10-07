import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { articles, campaigns, organizations, outlineNodes, people, richDocuments, shareLinks, territories } from "@/server/db/schema";
import { TEMPLATE_LABELS, isArticleTemplate, isGenericTemplate, type ArticleTemplateKey } from "@/server/articles/templates";
import { extractMentions } from "@/server/mentions/kinds";
import { outlineTree, type OutlineTreeNode } from "@/server/writer/logic";
import { readSetup } from "@/server/writer/parse";
import type { NodeKind } from "@/server/writer/types";
import { imageKeysOf, isBlankDoc, sectionAnchor, rewriteForShare, stripSecrets, type JsonNode } from "./transform";

export const SHARE_KINDS = ["article", "campaign", "outline"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

/** What a link shares: an article (its template picks the table), a whole campaign, or one outline item with what's inside it. */
export type ShareTarget = { kind: "article"; template: ArticleTemplateKey; id: string } | { kind: "campaign"; id: string } | { kind: "outline"; id: string };

export interface ClientShare {
  id: string;
  token: string;
  createdAt: string;
}

/** 32 random bytes: the link can't be guessed. */
export const newShareToken = () => randomBytes(32).toString("base64url");

export const SHARE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const sharePath = (token: string) => `/share/${token}`;

/** A request's target, or null when malformed. */
export function parseShareTarget(v: unknown): ShareTarget | null {
  if (!v || typeof v !== "object") return null;
  const x = v as Record<string, unknown>;
  if (typeof x.id !== "string" || !x.id || x.id.length > 64) return null;
  if (x.kind === "article") return isArticleTemplate(x.template) ? { kind: "article", template: x.template, id: x.id } : null;
  if (x.kind === "campaign" || x.kind === "outline") return { kind: x.kind, id: x.id };
  return null;
}

interface ArticleRecord {
  title: string;
  portraitKey: string | null;
  bodyId: string | null;
  sidebarId: string | null;
  footerId: string | null;
  updatedAt: Date;
}

/** A live article of the world, from whichever table its template lives in. */
async function findArticleRecord(worldId: string, template: ArticleTemplateKey, id: string): Promise<ArticleRecord | null> {
  const record = (r: { name: string; portraitKey: string | null; descriptionDocumentId: string | null; sidebarDocumentId: string | null; footerDocumentId: string | null; deletedAt: Date | null; updatedAt: Date } | undefined) =>
    r && !r.deletedAt ? { title: r.name, portraitKey: r.portraitKey, bodyId: r.descriptionDocumentId, sidebarId: r.sidebarDocumentId, footerId: r.footerDocumentId, updatedAt: r.updatedAt } : null;
  if (template === "character" || template === "playerCharacter") {
    const r = await db.query.people.findFirst({ where: and(eq(people.id, id), eq(people.worldId, worldId)) });
    return r && (r.kind === "player") === (template === "playerCharacter") ? record(r) : null;
  }
  if (template === "organization") return record(await db.query.organizations.findFirst({ where: and(eq(organizations.id, id), eq(organizations.worldId, worldId)) }));
  if (template === "territory") return record(await db.query.territories.findFirst({ where: and(eq(territories.id, id), eq(territories.worldId, worldId)) }));
  const r = await db.query.articles.findFirst({ where: and(eq(articles.id, id), eq(articles.worldId, worldId)) });
  if (!r || r.deletedAt || r.template !== template || !isGenericTemplate(r.template)) return null;
  return { title: r.title, portraitKey: r.portraitKey, bodyId: r.bodyDocumentId, sidebarId: r.sidebarDocumentId, footerId: r.footerDocumentId, updatedAt: r.updatedAt };
}

/** Whether the target exists (live) in the world. */
export async function shareTargetExists(worldId: string, target: ShareTarget): Promise<boolean> {
  if (target.kind === "article") return (await findArticleRecord(worldId, target.template, target.id)) !== null;
  if (target.kind === "campaign") return Boolean(await db.query.campaigns.findFirst({ where: and(eq(campaigns.id, target.id), eq(campaigns.worldId, worldId)), columns: { id: true } }));
  const node = await db.query.outlineNodes.findFirst({ where: and(eq(outlineNodes.id, target.id), eq(outlineNodes.worldId, worldId)), columns: { deletedAt: true } });
  return Boolean(node && !node.deletedAt);
}

/** The target's active (not revoked) share, if any. */
export async function activeShare(worldId: string, kind: ShareKind, targetId: string) {
  return db.query.shareLinks.findFirst({
    where: and(eq(shareLinks.worldId, worldId), eq(shareLinks.targetKind, kind), eq(shareLinks.targetId, targetId), isNull(shareLinks.revokedAt)),
  });
}

export const toClientShare = (row: typeof shareLinks.$inferSelect): ClientShare => ({ id: row.id, token: row.token, createdAt: row.createdAt.toISOString() });

// ---------- The shared view ----------

export interface SharedSection {
  id: string;
  kind: NodeKind;
  title: string;
  synopsis: string;
  doc: JsonNode | null;
  children: SharedSection[];
}

export type ShareView =
  | { kind: "article"; title: string; template: ArticleTemplateKey; templateLabel: string; portraitUrl: string | null; portraitFullUrl: string | null; body: JsonNode | null; sidebar: JsonNode | null; footer: JsonNode | null }
  | { kind: "writer"; campaign: string; root: { kind: NodeKind | null; title: string; lead: string; doc: JsonNode | null }; sections: SharedSection[] };

export interface LoadedShare {
  view: ShareView;
  /** Article image keys the view shows: the only ones the share's image route serves. */
  imageKeys: Set<string>;
  /** The article's portrait key, served by the share's portrait route. */
  portraitKey: string | null;
}

/** Each document, parsed and with its unrevealed secrets gone (absent when missing or unreadable). */
async function loadDocuments(worldId: string, ids: (string | null)[]): Promise<Map<string, JsonNode>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!wanted.length) return new Map();
  const rows = await db
    .select({ id: richDocuments.id, jsonText: richDocuments.jsonText })
    .from(richDocuments)
    .where(and(inArray(richDocuments.id, wanted), eq(richDocuments.worldId, worldId)));
  const docs = new Map<string, JsonNode>();
  for (const row of rows) {
    try {
      docs.set(row.id, stripSecrets(JSON.parse(row.jsonText) as JsonNode));
    } catch {
      // An unreadable document shows as empty.
    }
  }
  return docs;
}

/**
 * Where each mention in the documents leads on the shared side: an outline
 * item inside this view jumps to its section, a target with its own
 * active share opens that, anything else reads as plain text.
 */
async function mentionLinks(worldId: string, token: string, docs: JsonNode[], inView: Set<string>) {
  const targets = docs.flatMap((d) => extractMentions(d));
  const ids = [...new Set(targets.map((t) => t.id))];
  const rows = ids.length
    ? await db
        .select({ token: shareLinks.token, targetKind: shareLinks.targetKind, targetId: shareLinks.targetId })
        .from(shareLinks)
        .where(and(eq(shareLinks.worldId, worldId), inArray(shareLinks.targetId, ids), isNull(shareLinks.revokedAt)))
    : [];
  const shared = new Map(rows.map((r) => [`${r.targetKind}:${r.targetId}`, r.token]));
  return (kind: string, id: string): string | null => {
    if (kind === "node" && inView.has(id)) return `#${sectionAnchor(id)}`;
    const other = isArticleTemplate(kind) ? shared.get(`article:${id}`) : kind === "node" ? shared.get(`outline:${id}`) : undefined;
    return other && other !== token ? sharePath(other) : null;
  };
}

const shareImageSrc = (token: string) => (key: string) => `/api/share/${token}/image/${key}`;

async function loadArticleView(worldId: string, token: string, template: ArticleTemplateKey, id: string): Promise<LoadedShare | null> {
  const record = await findArticleRecord(worldId, template, id);
  if (!record) return null;
  const docs = await loadDocuments(worldId, [record.bodyId, record.sidebarId, record.footerId]);
  const linkFor = await mentionLinks(worldId, token, [...docs.values()], new Set());
  const imageKeys = new Set([...docs.values()].flatMap(imageKeysOf));
  const shown = (docId: string | null) => {
    const doc = docId ? docs.get(docId) : undefined;
    return doc && !isBlankDoc(doc) ? rewriteForShare(doc, { mentionHref: linkFor, imageSrc: shareImageSrc(token) }) : null;
  };
  return {
    view: {
      kind: "article",
      title: record.title,
      template,
      templateLabel: TEMPLATE_LABELS[template],
      portraitUrl: record.portraitKey ? `/api/share/${token}/portrait` : null,
      portraitFullUrl: record.portraitKey ? `/api/share/${token}/portrait/full` : null,
      body: shown(record.bodyId),
      sidebar: shown(record.sidebarId),
      footer: shown(record.footerId),
    },
    imageKeys,
    portraitKey: record.portraitKey,
  };
}

type OutlineRow = typeof outlineNodes.$inferSelect;

function findSubtree(list: OutlineTreeNode<OutlineRow>[], id: string): OutlineTreeNode<OutlineRow> | null {
  for (const t of list) {
    if (t.node.id === id) return t;
    const found = findSubtree(t.children, id);
    if (found) return found;
  }
  return null;
}

/** The tree without its items hidden from shares (and what's inside them). */
const withoutHidden = (list: OutlineTreeNode<OutlineRow>[]): OutlineTreeNode<OutlineRow>[] =>
  list.filter((t) => !t.node.hiddenFromShares).map((t) => ({ node: t.node, children: withoutHidden(t.children) }));

async function loadWriterView(worldId: string, token: string, kind: "campaign" | "outline", targetId: string): Promise<LoadedShare | null> {
  let campaignId = targetId;
  if (kind === "outline") {
    const node = await db.query.outlineNodes.findFirst({ where: and(eq(outlineNodes.id, targetId), eq(outlineNodes.worldId, worldId)) });
    if (!node || node.deletedAt) return null;
    campaignId = node.campaignId;
  }
  const campaign = await db.query.campaigns.findFirst({ where: and(eq(campaigns.id, campaignId), eq(campaigns.worldId, worldId)) });
  if (!campaign) return null;
  const nodes = await db.select().from(outlineNodes).where(and(eq(outlineNodes.campaignId, campaignId), isNull(outlineNodes.deletedAt)));
  const tree = outlineTree(nodes);
  const root = kind === "outline" ? findSubtree(tree, targetId) : null;
  // An item whose parent chain was deleted isn't reachable from the outline any more.
  if (kind === "outline" && !root) return null;
  // Hidden items go with everything inside them; the shared item itself always shows (sharing it alone reveals it).
  const list = withoutHidden(root ? root.children : tree);

  const inView: OutlineRow[] = root ? [root.node] : [];
  const collect = (t: OutlineTreeNode<OutlineRow>) => {
    inView.push(t.node);
    t.children.forEach(collect);
  };
  list.forEach(collect);

  const docs = await loadDocuments(worldId, inView.map((n) => n.documentId));
  const linkFor = await mentionLinks(worldId, token, [...docs.values()], new Set(inView.map((n) => n.id)));
  const ctx = { mentionHref: linkFor, imageSrc: shareImageSrc(token) };
  const shown = (docId: string | null) => {
    const doc = docId ? docs.get(docId) : undefined;
    return doc && !isBlankDoc(doc) ? rewriteForShare(doc, ctx) : null;
  };
  const section = (t: OutlineTreeNode<OutlineRow>): SharedSection => ({
    id: t.node.id,
    kind: t.node.kind,
    title: t.node.title,
    synopsis: t.node.synopsis,
    doc: shown(t.node.documentId),
    children: t.children.map(section),
  });

  let pitch = "";
  try {
    pitch = readSetup(JSON.parse(campaign.setup)).pitch;
  } catch {
    // No setup: no lead line.
  }
  return {
    view: {
      kind: "writer",
      campaign: campaign.name,
      root: root
        ? { kind: root.node.kind, title: root.node.title, lead: root.node.synopsis, doc: shown(root.node.documentId) }
        : { kind: null, title: campaign.name, lead: pitch, doc: null },
      sections: list.map(section),
    },
    imageKeys: new Set([...docs.values()].flatMap(imageKeysOf)),
    portraitKey: null,
  };
}

/** The live view behind a token, or null when it's unknown, revoked, or its target is gone. */
export async function loadShare(token: string): Promise<LoadedShare | null> {
  if (!SHARE_TOKEN.test(token)) return null;
  const share = await db.query.shareLinks.findFirst({ where: eq(shareLinks.token, token) });
  if (!share || share.revokedAt) return null;
  if (share.targetKind === "article") {
    const template = share.targetTemplate;
    return isArticleTemplate(template) ? loadArticleView(share.worldId, token, template, share.targetId) : null;
  }
  return loadWriterView(share.worldId, token, share.targetKind, share.targetId);
}

/** Revisions of the given documents, as "id:revision" (ordered). */
async function documentRevisions(worldId: string, ids: (string | null)[]): Promise<string> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!wanted.length) return "";
  const rows = await db
    .select({ id: richDocuments.id, revision: richDocuments.revision })
    .from(richDocuments)
    .where(and(inArray(richDocuments.id, wanted), eq(richDocuments.worldId, worldId)));
  return rows
    .map((r) => `${r.id}:${r.revision}`)
    .sort()
    .join(",");
}

/**
 * A cheap stamp of everything a share's view is built from (the target's
 * rows, its documents' revisions, the world's share links, for mention
 * links): when it changes, the view did, or may have. Null once the link
 * is revoked or its target is gone. Never parses a document.
 */
export async function shareFingerprint(token: string): Promise<string | null> {
  if (!SHARE_TOKEN.test(token)) return null;
  const share = await db.query.shareLinks.findFirst({ where: eq(shareLinks.token, token) });
  if (!share || share.revokedAt) return null;
  const { worldId } = share;
  const [links] = await db
    .select({ n: sql<number>`count(*)`, last: sql<number>`max(${shareLinks.updatedAt})` })
    .from(shareLinks)
    .where(eq(shareLinks.worldId, worldId));
  const linksStamp = `${links?.n ?? 0}@${links?.last ?? 0}`;

  if (share.targetKind === "article") {
    const template = share.targetTemplate;
    const record = isArticleTemplate(template) ? await findArticleRecord(worldId, template, share.targetId) : null;
    if (!record) return null;
    return [linksStamp, record.updatedAt.getTime(), await documentRevisions(worldId, [record.bodyId, record.sidebarId, record.footerId])].join("|");
  }

  let campaignId = share.targetId;
  if (share.targetKind === "outline") {
    const node = await db.query.outlineNodes.findFirst({ where: and(eq(outlineNodes.id, share.targetId), eq(outlineNodes.worldId, worldId)), columns: { campaignId: true, deletedAt: true } });
    if (!node || node.deletedAt) return null;
    campaignId = node.campaignId;
  }
  const campaign = await db.query.campaigns.findFirst({ where: and(eq(campaigns.id, campaignId), eq(campaigns.worldId, worldId)), columns: { updatedAt: true } });
  if (!campaign) return null;
  // The whole campaign's outline: an edit elsewhere in it only costs the viewer a refetch.
  const nodes = await db
    .select({ id: outlineNodes.id, updatedAt: outlineNodes.updatedAt, documentId: outlineNodes.documentId })
    .from(outlineNodes)
    .where(and(eq(outlineNodes.campaignId, campaignId), isNull(outlineNodes.deletedAt)));
  const nodeStamp = nodes
    .map((n) => `${n.id}:${n.updatedAt.getTime()}`)
    .sort()
    .join(",");
  return [linksStamp, campaign.updatedAt.getTime(), nodeStamp, await documentRevisions(worldId, nodes.map((n) => n.documentId))].join("|");
}
