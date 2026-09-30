/**
 * What an @mention can point at (pure; relative imports only): any article
 * (its template key), or a campaign's quest, front or outline item. The
 * mention stores its target's label as a fallback; pages show current names.
 */
import { ARTICLE_TEMPLATE_KEYS, articleHref, isArticleTemplate } from "../articles/templates";

export const CAMPAIGN_MENTION_KINDS = ["quest", "front", "node"] as const;
export type CampaignMentionKind = (typeof CAMPAIGN_MENTION_KINDS)[number];

export const MENTION_KINDS: readonly string[] = [...ARTICLE_TEMPLATE_KEYS, ...CAMPAIGN_MENTION_KINDS];

export const isMentionKind = (v: unknown): v is string => typeof v === "string" && MENTION_KINDS.includes(v);

export const isCampaignMentionKind = (v: unknown): v is CampaignMentionKind => typeof v === "string" && (CAMPAIGN_MENTION_KINDS as readonly string[]).includes(v);

export const MENTION_ID = /^[A-Za-z0-9:_-]{1,64}$/;
export const MAX_MENTION_LABEL = 200;

export interface MentionAttrs {
  kind: string;
  id: string;
  label: string;
  /** The campaign of a quest, front or outline item (for its link). */
  campaign: string | null;
}

/**
 * What a mention reads as: its custom text (set in the article link dialog)
 * or, without one, "@" and the target's label.
 */
export function mentionDisplayText(attrs: Record<string, unknown>): string {
  if (typeof attrs.text === "string" && attrs.text.trim()) return attrs.text;
  return `@${typeof attrs.label === "string" ? attrs.label : ""}`;
}

/** A search result for the @ menu. */
export interface MentionOption extends MentionAttrs {
  /** What it is ("Character", "Quest", "Scene", …). */
  group: string;
}

/** Where a mention leads. */
export function mentionHref({ kind, id, campaign }: Pick<MentionAttrs, "kind" | "id" | "campaign">): string {
  if (isArticleTemplate(kind)) return articleHref(kind, id);
  const c = campaign ? `campaign=${encodeURIComponent(campaign)}&` : "";
  if (kind === "quest") return `/sessions?${c}view=quests&quest=${encodeURIComponent(id)}`;
  if (kind === "front") return `/sessions?${c}view=fronts`;
  return `/writer?${c}node=${encodeURIComponent(id)}`;
}

type JsonNode = { type?: string; attrs?: Record<string, unknown>; content?: JsonNode[] };

/** Every distinct target a document mentions (the last label wins). */
export function extractMentions(json: unknown): MentionAttrs[] {
  const found = new Map<string, MentionAttrs>();
  const visit = (node: JsonNode, depth: number) => {
    if (!node || typeof node !== "object" || depth > 32) return;
    if (node.type === "mention") {
      const a = node.attrs ?? {};
      if (isMentionKind(a.kind) && typeof a.id === "string" && MENTION_ID.test(a.id)) {
        const label = typeof a.label === "string" ? a.label.slice(0, MAX_MENTION_LABEL) : "";
        found.set(`${a.kind}:${a.id}`, { kind: a.kind, id: a.id, label, campaign: typeof a.campaign === "string" ? a.campaign : null });
      }
    }
    for (const child of node.content ?? []) visit(child, depth + 1);
  };
  visit(json as JsonNode, 0);
  return [...found.values()];
}
