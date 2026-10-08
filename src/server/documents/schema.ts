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
import { translate, type TranslateParams } from "../../i18n/translate";
import type { MessageKey } from "../../i18n/messages";
import { MAX_MENTION_LABEL, MENTION_ID, isMentionKind, mentionDisplayText } from "../mentions/kinds";
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
  "secret",
  "horizontalRule",
  "hardBreak",
  "title",
  "image",
  "mention",
  "tableOfContents",
  "calendarDate",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
]);

export const ALLOWED_MARK_TYPES = new Set(["bold", "italic", "strike", "underline", "link", "textStyle", "secretText"]);

export const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export const LIMITS = {
  maxJsonBytes: 200_000,
  maxNestingDepth: 16,
  /** Merged-cell span and saved column width (px) caps. */
  maxCellSpan: 100,
  maxColumnWidth: 4000,
  maxRowHeight: 2000,
  /** Same range the world's current day allows (see info-fields' world days). */
  maxWorldDay: 100_000_000,
};

/** A document that failed validation; `key`/`params` are an `errors` message for the route to word. */
export class DocumentValidationError extends Error {
  constructor(
    readonly key: MessageKey<"errors">,
    readonly params?: TranslateParams,
  ) {
    super(translate("en-US", "errors", key, params));
  }
}

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
const MAX_DATE_LABEL = 200;
const TABLE_CELLS = new Set(["tableCell", "tableHeader"]);
const CELL_ALIGNS = ["left", "center", "right"] as const;
const isSpan = (v: unknown) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= LIMITS.maxCellSpan;
const isColumnWidth = (v: unknown) => Number.isFinite(v) && (v as number) > 0 && (v as number) <= LIMITS.maxColumnWidth;
const oneOf = (list: readonly (string | number)[], v: unknown) => (list as readonly unknown[]).includes(v);

function fail(key: MessageKey<"errors">, params?: TranslateParams): never {
  throw new DocumentValidationError(key, params);
}

function checkNodeAttrs(node: JsonNode): void {
  const attrs = node.attrs ?? {};
  if (ALIGNABLE.has(node.type!) && !isNullish(attrs.textAlign) && !oneOf(TEXT_ALIGNS, attrs.textAlign)) {
    fail("docTextAlign", { value: String(attrs.textAlign) });
  }
  if (node.type === "heading" && !oneOf(HEADING_LEVELS, attrs.level)) {
    fail("docHeadingLevel", { value: String(attrs.level) });
  }
  if (node.type === "calendarDate") {
    if (!(Number.isSafeInteger(attrs.day) && Math.abs(attrs.day as number) <= LIMITS.maxWorldDay)) fail("docCalendarDate");
    if (!isNullish(attrs.label) && !(typeof attrs.label === "string" && attrs.label.length <= MAX_DATE_LABEL)) fail("docCalendarDateLabel");
    return;
  }
  if (node.type === "secret") {
    if (!isNullish(attrs.revealed) && typeof attrs.revealed !== "boolean") fail("docSecretState");
    return;
  }
  if (node.type === "tableRow") {
    if (!isNullish(attrs.height) && !(Number.isInteger(attrs.height) && (attrs.height as number) > 0 && (attrs.height as number) <= LIMITS.maxRowHeight)) fail("docRowHeight");
    return;
  }
  if (TABLE_CELLS.has(node.type!)) {
    for (const key of ["colspan", "rowspan"] as const) {
      if (!isNullish(attrs[key]) && !isSpan(attrs[key])) fail("docCellAttr", { attr: key });
    }
    if (!isNullish(attrs.colwidth) && !(Array.isArray(attrs.colwidth) && attrs.colwidth.every((w) => w === 0 || isColumnWidth(w)))) fail("docColumnWidth");
    if (!isNullish(attrs.align) && !oneOf(CELL_ALIGNS, attrs.align)) fail("docCellAlign", { value: String(attrs.align) });
    return;
  }
  if (node.type === "tableOfContents") {
    if (!isNullish(attrs.maxLevel) && !oneOf(HEADING_LEVELS, attrs.maxLevel)) fail("docTocDepth");
    for (const key of ["collapsed", "numbered"] as const) {
      if (!isNullish(attrs[key]) && typeof attrs[key] !== "boolean") fail("docTocOption");
    }
    return;
  }
  if (node.type === "mention") {
    if (!isMentionKind(attrs.kind)) fail("docMention");
    if (typeof attrs.id !== "string" || !MENTION_ID.test(attrs.id)) fail("docMentionTarget");
    if (!(typeof attrs.label === "string" && attrs.label.length <= MAX_MENTION_LABEL)) fail("docMentionLabel");
    if (!isNullish(attrs.campaign) && !(typeof attrs.campaign === "string" && MENTION_ID.test(attrs.campaign))) fail("docMentionCampaign");
    if (!isNullish(attrs.text) && !(typeof attrs.text === "string" && attrs.text.length <= MAX_MENTION_LABEL)) fail("docMentionText");
    return;
  }
  if (node.type !== "image") return;
  if (!isArticleImageSrc(attrs.src)) fail("docImageSrc");
  if (!isNullish(attrs.href) && !isValidHref(attrs.href)) fail("docImageHref");
  if (!isNullish(attrs.align) && !oneOf(IMAGE_ALIGNS, attrs.align)) fail("docImageAlign", { value: String(attrs.align) });
  for (const key of ["width", "height"] as const) {
    const v = attrs[key];
    if (!isNullish(v) && !(typeof v === "number" && Number.isFinite(v) && v > 0 && v <= MAX_IMAGE_DIMENSION)) fail("docImageAttr", { attr: key });
  }
  for (const key of ["alt", "title", "caption"] as const) {
    const v = attrs[key];
    if (!isNullish(v) && !(typeof v === "string" && v.length <= MAX_ALT_LENGTH)) fail("docImageAttr", { attr: key });
  }
}

function checkMark(mark: { type: string; attrs?: Record<string, unknown> }): void {
  if (!ALLOWED_MARK_TYPES.has(mark.type)) fail("docMarkType", { type: String(mark.type) });
  if (mark.type === "link" && !isValidHref(mark.attrs?.href)) fail("docLinkHref");
  if (mark.type === "secretText" && !isNullish(mark.attrs?.revealed) && typeof mark.attrs?.revealed !== "boolean") fail("docSecretState");
  if (mark.type !== "textStyle") return;
  const { color, fontFamily } = mark.attrs ?? {};
  if (!isNullish(color) && !(typeof color === "string" && HEX_COLOR.test(color))) fail("docTextColor");
  if (!isNullish(fontFamily) && !(typeof fontFamily === "string" && FONT_FAMILIES.has(fontFamily))) fail("docFont");
}

function walk(node: JsonNode, depth: number): void {
  if (depth > LIMITS.maxNestingDepth) {
    throw new DocumentValidationError("docNesting", { max: LIMITS.maxNestingDepth });
  }
  if (!node.type || !ALLOWED_NODE_TYPES.has(node.type)) {
    throw new DocumentValidationError("docNodeType", { type: String(node.type) });
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
    throw new DocumentValidationError("docTooLarge", { size: text.length });
  }
  if (typeof json !== "object" || json === null) {
    throw new DocumentValidationError("docNotObject");
  }
  const root = json as JsonNode;
  if (root.type !== "doc") {
    throw new DocumentValidationError("docRoot");
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
    if (node.type === "mention") {
      current += mentionDisplayText(node.attrs ?? {});
      return;
    }
    if (node.type === "calendarDate") {
      current += typeof node.attrs?.label === "string" ? node.attrs.label : "";
      return;
    }
    const blockTypes = new Set(["paragraph", "heading", "title", "listItem", "blockquote", "secret"]);
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
