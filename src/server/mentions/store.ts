/**
 * @mention search and backlinks: what a writer can mention, and which pages
 * mention a target (through the document_mentions index written on save).
 */
import { and, eq, inArray, isNull, like, or } from "drizzle-orm";
import { db } from "@/server/db/client";
import { articles, documentMentions, fronts, organizations, outlineNodes, people, quests, sessions, territories } from "@/server/db/schema";
import { articleHref, personTemplate, TEMPLATE_LABELS, type ArticleTemplateKey } from "@/server/articles/templates";
import { NODE_KIND_LABELS } from "@/server/writer/types";
import { mentionHref, type MentionOption } from "./kinds";

const PER_SOURCE = 8;
const MAX_BACKLINKS = 200;

const pattern = (q: string) => `%${q.replace(/[%_\\]/g, "")}%`;

/** Articles and (with a campaign) its quests, fronts and outline items whose name contains `q`. */
export async function searchMentions(worldId: string, q: string, campaignId: string | null): Promise<MentionOption[]> {
  const p = pattern(q);
  const [pp, oo, tt, aa, qq, ff, nn] = await Promise.all([
    db.select({ id: people.id, name: people.name, kind: people.kind }).from(people).where(and(eq(people.worldId, worldId), isNull(people.deletedAt), like(people.name, p))).limit(PER_SOURCE),
    db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(and(eq(organizations.worldId, worldId), isNull(organizations.deletedAt), like(organizations.name, p))).limit(PER_SOURCE),
    db.select({ id: territories.id, name: territories.name }).from(territories).where(and(eq(territories.worldId, worldId), isNull(territories.deletedAt), like(territories.name, p))).limit(PER_SOURCE),
    db.select({ id: articles.id, name: articles.title, template: articles.template }).from(articles).where(and(eq(articles.worldId, worldId), isNull(articles.deletedAt), like(articles.title, p))).limit(PER_SOURCE * 2),
    campaignId ? db.select({ id: quests.id, name: quests.title }).from(quests).where(and(eq(quests.campaignId, campaignId), isNull(quests.deletedAt), like(quests.title, p))).limit(PER_SOURCE) : [],
    campaignId ? db.select({ id: fronts.id, name: fronts.name }).from(fronts).where(and(eq(fronts.campaignId, campaignId), isNull(fronts.deletedAt), like(fronts.name, p))).limit(PER_SOURCE) : [],
    campaignId
      ? db.select({ id: outlineNodes.id, name: outlineNodes.title, kind: outlineNodes.kind }).from(outlineNodes).where(and(eq(outlineNodes.campaignId, campaignId), isNull(outlineNodes.deletedAt), like(outlineNodes.title, p))).limit(PER_SOURCE)
      : [],
  ]);
  const article = (template: string, id: string, label: string): MentionOption => ({ kind: template, id, label, campaign: null, group: TEMPLATE_LABELS[template as ArticleTemplateKey] ?? "Article" });
  const all: MentionOption[] = [
    ...pp.map((x) => article(personTemplate(x.kind), x.id, x.name)),
    ...oo.map((x) => article("organization", x.id, x.name)),
    ...tt.map((x) => article("territory", x.id, x.name)),
    ...aa.map((x) => article(x.template, x.id, x.name)),
    ...qq.map((x) => ({ kind: "quest", id: x.id, label: x.name, campaign: campaignId, group: "Quest" })),
    ...ff.map((x) => ({ kind: "front", id: x.id, label: x.name, campaign: campaignId, group: "Front" })),
    ...nn.map((x) => ({ kind: "node", id: x.id, label: x.name, campaign: campaignId, group: NODE_KIND_LABELS[x.kind] })),
  ];
  // Names starting with the query first, then shorter names.
  const lower = q.toLowerCase();
  const rank = (o: MentionOption) => (o.label.toLowerCase().startsWith(lower) ? 0 : 1);
  return all.sort((a, b) => rank(a) - rank(b) || a.label.length - b.label.length || a.label.localeCompare(b.label)).slice(0, 20);
}

export interface Backlink {
  documentId: string;
  /** What holds the text ("Scene", "Quest", "Session", "Character", …). */
  type: string;
  title: string;
  href: string;
}

/**
 * The pages whose text mentions `targetId` (ids are unique across kinds),
 * each document once. Documents whose owner is gone are left out.
 */
export async function backlinksTo(targetId: string): Promise<Backlink[]> {
  const rows = await db.selectDistinct({ documentId: documentMentions.documentId }).from(documentMentions).where(eq(documentMentions.targetId, targetId)).limit(MAX_BACKLINKS);
  const ids = rows.map((r) => r.documentId);
  if (!ids.length) return [];
  const [nodes, qs, ss, as, ps, os, ts] = await Promise.all([
    db.select().from(outlineNodes).where(and(inArray(outlineNodes.documentId, ids), isNull(outlineNodes.deletedAt))),
    db.select().from(quests).where(and(inArray(quests.bodyDocumentId, ids), isNull(quests.deletedAt))),
    db.select().from(sessions).where(and(inArray(sessions.recapDocumentId, ids), isNull(sessions.deletedAt))),
    db.select().from(articles).where(and(or(inArray(articles.bodyDocumentId, ids), inArray(articles.sidebarDocumentId, ids), inArray(articles.footerDocumentId, ids)), isNull(articles.deletedAt))),
    db.select().from(people).where(and(or(inArray(people.descriptionDocumentId, ids), inArray(people.sidebarDocumentId, ids), inArray(people.footerDocumentId, ids)), isNull(people.deletedAt))),
    db.select().from(organizations).where(and(or(inArray(organizations.descriptionDocumentId, ids), inArray(organizations.sidebarDocumentId, ids), inArray(organizations.footerDocumentId, ids)), isNull(organizations.deletedAt))),
    db.select().from(territories).where(and(or(inArray(territories.descriptionDocumentId, ids), inArray(territories.sidebarDocumentId, ids), inArray(territories.footerDocumentId, ids)), isNull(territories.deletedAt))),
  ]);
  const out: Backlink[] = [];
  const pick = (docIds: (string | null)[]) => docIds.filter((d): d is string => d !== null && ids.includes(d));
  for (const n of nodes) out.push({ documentId: n.documentId!, type: NODE_KIND_LABELS[n.kind], title: n.title, href: mentionHref({ kind: "node", id: n.id, campaign: n.campaignId }) });
  for (const q of qs) out.push({ documentId: q.bodyDocumentId!, type: "Quest", title: q.title, href: mentionHref({ kind: "quest", id: q.id, campaign: q.campaignId }) });
  for (const s of ss) out.push({ documentId: s.recapDocumentId!, type: "Session recap", title: `Session ${s.number}${s.title ? ` · ${s.title}` : ""}`, href: `/sessions?campaign=${encodeURIComponent(s.campaignId)}&session=${encodeURIComponent(s.id)}` });
  const add = (template: ArticleTemplateKey, id: string, title: string, docIds: (string | null)[]) => {
    for (const d of pick(docIds)) out.push({ documentId: d, type: TEMPLATE_LABELS[template], title, href: articleHref(template, id) });
  };
  for (const a of as) add(a.template as ArticleTemplateKey, a.id, a.title, [a.bodyDocumentId, a.sidebarDocumentId, a.footerDocumentId]);
  for (const p of ps) add(personTemplate(p.kind), p.id, p.name, [p.descriptionDocumentId, p.sidebarDocumentId, p.footerDocumentId]);
  for (const o of os) add("organization", o.id, o.name, [o.descriptionDocumentId, o.sidebarDocumentId, o.footerDocumentId]);
  for (const t of ts) add("territory", t.id, t.name, [t.descriptionDocumentId, t.sidebarDocumentId, t.footerDocumentId]);
  // One row per page: an article mentioning it in body and sidebar is listed once.
  const seen = new Set<string>();
  return out.filter((b) => (seen.has(b.href) ? false : (seen.add(b.href), true))).sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title));
}
