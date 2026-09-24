/**
 * Server-side contract for rich-text documents. Kept independent of Tiptap's
 * own runtime so validating a saved document never requires spinning up an
 * editor instance — it's just a JSON node tree walk.
 *
 * Attribute checks cover everything the editor renders into markup or
 * inline styles (image src/link, text color, font family, alignment), so a
 * crafted document can't smuggle in a foreign image URL, a javascript: link
 * or arbitrary CSS.
 */

import { MAP_FONTS, mapFontFamily } from "../texts/fonts";
import { ARTICLE_IMAGE_KEY, ARTICLE_IMAGE_URL_PREFIX, HEADING_LEVELS, IMAGE_ALIGNS, MAX_IMAGE_DIMENSION, TEXT_ALIGNS } from "./rich-attrs";

// Older documents are a subset of this schema, so the version is unchanged.
export const SCHEMA_VERSION = 1;

export const ALLOWED_NODE_TYPES = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "horizontalRule",
  "hardBreak",
  "title",
  "image",
]);

export const ALLOWED_MARK_TYPES = new Set(["bold", "italic", "strike", "underline", "link", "textStyle"]);

export const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export const LIMITS = {
  maxJsonBytes: 200_000,
  maxNestingDepth: 16,
};

export class DocumentValidationError extends Error {}

interface JsonNode {
  type?: string;
  text?: string;
  content?: JsonNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
}

function isValidHref(href: unknown): boolean {
  if (typeof href !== "string") return false;
  try {
    const url = new URL(href, "https://placeholder.invalid");
    return ALLOWED_LINK_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

const ALIGNABLE = new Set(["paragraph", "heading", "title"]);
const FONT_FAMILIES = new Set<string>(MAP_FONTS.map((f) => mapFontFamily(f.key)));
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const isArticleImageSrc = (src: unknown) =>
  typeof src === "string" && src.startsWith(ARTICLE_IMAGE_URL_PREFIX) && ARTICLE_IMAGE_KEY.test(src.slice(ARTICLE_IMAGE_URL_PREFIX.length));
const MAX_ALT_LENGTH = 500;

const isNullish = (v: unknown) => v === null || v === undefined;
const oneOf = (list: readonly (string | number)[], v: unknown) => (list as readonly unknown[]).includes(v);

function fail(message: string): never {
  throw new DocumentValidationError(message);
}

function checkNodeAttrs(node: JsonNode): void {
  const attrs = node.attrs ?? {};
  if (ALIGNABLE.has(node.type!) && !isNullish(attrs.textAlign) && !oneOf(TEXT_ALIGNS, attrs.textAlign)) {
    fail(`Unsupported text alignment: ${String(attrs.textAlign)}`);
  }
  if (node.type === "heading" && !oneOf(HEADING_LEVELS, attrs.level)) {
    fail(`Unsupported heading level: ${String(attrs.level)}`);
  }
  if (node.type !== "image") return;
  if (!isArticleImageSrc(attrs.src)) fail("Images must be uploaded to this app.");
  if (!isNullish(attrs.href) && !isValidHref(attrs.href)) fail("Image links must use http:, https:, or mailto:.");
  if (!isNullish(attrs.align) && !oneOf(IMAGE_ALIGNS, attrs.align)) fail(`Unsupported image alignment: ${String(attrs.align)}`);
  for (const key of ["width", "height"] as const) {
    const v = attrs[key];
    if (!isNullish(v) && !(typeof v === "number" && Number.isFinite(v) && v > 0 && v <= MAX_IMAGE_DIMENSION)) fail(`Invalid image ${key}.`);
  }
  for (const key of ["alt", "title"] as const) {
    const v = attrs[key];
    if (!isNullish(v) && !(typeof v === "string" && v.length <= MAX_ALT_LENGTH)) fail(`Invalid image ${key}.`);
  }
}

function checkMark(mark: { type: string; attrs?: Record<string, unknown> }): void {
  if (!ALLOWED_MARK_TYPES.has(mark.type)) fail(`Unsupported mark type: ${mark.type}`);
  if (mark.type === "link" && !isValidHref(mark.attrs?.href)) fail("Links must use http:, https:, or mailto:.");
  if (mark.type !== "textStyle") return;
  const { color, fontFamily } = mark.attrs ?? {};
  if (!isNullish(color) && !(typeof color === "string" && HEX_COLOR.test(color))) fail("Text color must be a hex color.");
  if (!isNullish(fontFamily) && !(typeof fontFamily === "string" && FONT_FAMILIES.has(fontFamily))) fail("Unsupported font.");
}

function walk(node: JsonNode, depth: number): void {
  if (depth > LIMITS.maxNestingDepth) {
    throw new DocumentValidationError(`Document nesting exceeds ${LIMITS.maxNestingDepth} levels.`);
  }
  if (!node.type || !ALLOWED_NODE_TYPES.has(node.type)) {
    throw new DocumentValidationError(`Unsupported node type: ${node.type}`);
  }
  checkNodeAttrs(node);
  for (const mark of node.marks ?? []) checkMark(mark);
  for (const child of node.content ?? []) {
    walk(child, depth + 1);
  }
}

/** Throws DocumentValidationError if the document is structurally invalid. */
export function validateDocument(json: unknown): void {
  const text = JSON.stringify(json);
  if (text.length > LIMITS.maxJsonBytes) {
    throw new DocumentValidationError(`Document is too large (${text.length} bytes).`);
  }
  if (typeof json !== "object" || json === null) {
    throw new DocumentValidationError("Document must be a JSON object.");
  }
  const root = json as JsonNode;
  if (root.type !== "doc") {
    throw new DocumentValidationError("Document root must be a 'doc' node.");
  }
  walk(root, 0);
}

/** Plain-text projection for search, derived the same way regardless of caller. */
export function deriveText(json: unknown): string {
  const lines: string[] = [];
  let current = "";

  function visit(node: JsonNode): void {
    if (node.type === "text" && node.text) {
      current += node.text;
      return;
    }
    const blockTypes = new Set(["paragraph", "heading", "title", "listItem", "blockquote"]);
    const isBlock = node.type ? blockTypes.has(node.type) : false;
    for (const child of node.content ?? []) {
      visit(child);
    }
    if (isBlock) {
      lines.push(current);
      current = "";
    }
  }

  if (typeof json === "object" && json !== null) {
    visit(json as JsonNode);
  }
  if (current) lines.push(current);
  return lines.filter((l) => l.length > 0).join("\n");
}
