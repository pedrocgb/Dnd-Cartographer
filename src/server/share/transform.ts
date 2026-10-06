/**
 * What a shared page may show of a rich-text document (pure; relative
 * imports only). Runs on the server, so hidden text never leaves it:
 * unrevealed secrets are dropped, revealed ones read as plain text, and
 * links into the app become links between shared pages, or plain text.
 */
import { mentionDisplayText } from "../mentions/kinds";
import { ARTICLE_IMAGE_KEY, ARTICLE_IMAGE_URL_PREFIX } from "../documents/rich-attrs";

export interface JsonMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface JsonNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
  marks?: JsonMark[];
}

const MAX_DEPTH = 64;

/** The element id of an outline item's section on a shared story page. */
export const sectionAnchor = (id: string) => `s-${id}`;

/** Only links that leave the app survive; anything relative points into it. */
export const isExternalHref = (href: unknown): href is string => typeof href === "string" && /^(https?:|mailto:)/i.test(href.trim());

/**
 * The document without its unrevealed secrets; a revealed secret is
 * replaced by its contents. A container left empty gets an empty paragraph
 * (its schema needs a block).
 */
export function stripSecrets(doc: JsonNode): JsonNode {
  const visit = (node: JsonNode, depth: number): JsonNode[] => {
    if (depth > MAX_DEPTH) return [];
    if (node.type === "secret") {
      if (node.attrs?.revealed !== true) return [];
      return (node.content ?? []).flatMap((child) => visit(child, depth + 1));
    }
    if (!node.content) return [node];
    const content = node.content.flatMap((child) => visit(child, depth + 1));
    const emptied = content.length === 0 && node.content.length > 0;
    return [{ ...node, content: emptied ? [{ type: "paragraph" }] : content }];
  };
  return visit(doc, 0)[0] ?? { type: "doc", content: [{ type: "paragraph" }] };
}

export interface ShareLinkContext {
  /** Where a mention leads on the shared side (another share, or a section of this one), or null for plain text. */
  mentionHref: (kind: string, id: string) => string | null;
  /** The shared URL of an article image (by its key). */
  imageSrc: (key: string) => string;
}

/** Link marks kept only when external. */
function shareMarks(marks: JsonMark[] | undefined): JsonMark[] | undefined {
  if (!marks) return undefined;
  const kept = marks.filter((m) => m.type !== "link" || isExternalHref(m.attrs?.href));
  return kept.length ? kept : undefined;
}

const textNode = (text: string, marks: JsonMark[] | undefined): JsonNode[] => (text ? [{ type: "text", text, ...(marks ? { marks } : {}) }] : []);

/**
 * Rewrites a (secret-free) document for a shared page: mentions become a
 * link to `ctx.mentionHref` or plain text, calendar dates plain text,
 * app-internal links are dropped, and article images load through the share.
 */
export function rewriteForShare(doc: JsonNode, ctx: ShareLinkContext): JsonNode {
  const visit = (node: JsonNode, depth: number): JsonNode[] => {
    if (depth > MAX_DEPTH) return [];
    const marks = shareMarks(node.marks);
    if (node.type === "mention") {
      const attrs = node.attrs ?? {};
      const href = typeof attrs.kind === "string" && typeof attrs.id === "string" ? ctx.mentionHref(attrs.kind, attrs.id) : null;
      return textNode(mentionDisplayText(attrs), href ? [...(marks ?? []), { type: "link", attrs: { href, target: null, rel: null } }] : marks);
    }
    if (node.type === "calendarDate") {
      return textNode(typeof node.attrs?.label === "string" ? node.attrs.label : "", marks);
    }
    const next: JsonNode = { ...node };
    if (marks) next.marks = marks;
    else delete next.marks;
    if (node.type === "image") {
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
      const key = src.startsWith(ARTICLE_IMAGE_URL_PREFIX) ? src.slice(ARTICLE_IMAGE_URL_PREFIX.length) : "";
      if (!ARTICLE_IMAGE_KEY.test(key)) return [];
      next.attrs = { ...node.attrs, src: ctx.imageSrc(key), href: isExternalHref(node.attrs?.href) ? node.attrs.href : null };
    }
    if (node.content) next.content = node.content.flatMap((child) => visit(child, depth + 1));
    return [next];
  };
  return visit(doc, 0)[0] ?? { type: "doc", content: [{ type: "paragraph" }] };
}

/** The article image keys a document shows (what a share may serve). */
export function imageKeysOf(doc: JsonNode): string[] {
  const keys: string[] = [];
  const visit = (node: JsonNode, depth: number) => {
    if (depth > MAX_DEPTH) return;
    const src = node.type === "image" ? node.attrs?.src : null;
    if (typeof src === "string" && src.startsWith(ARTICLE_IMAGE_URL_PREFIX)) keys.push(src.slice(ARTICLE_IMAGE_URL_PREFIX.length));
    for (const child of node.content ?? []) visit(child, depth + 1);
  };
  visit(doc, 0);
  return keys;
}

const VISIBLE_NODES = new Set(["image", "horizontalRule", "table", "mention", "calendarDate"]);

/** Whether nothing in the document would show (no text, link, date, image, divider or table). */
export function isBlankDoc(doc: JsonNode): boolean {
  const visit = (node: JsonNode, depth: number): boolean =>
    depth <= MAX_DEPTH && ((node.type === "text" && Boolean(node.text?.trim())) || VISIBLE_NODES.has(node.type ?? "") || (node.content ?? []).some((c) => visit(c, depth + 1)));
  return !visit(doc, 0);
}
