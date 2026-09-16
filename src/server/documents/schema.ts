/**
 * Server-side contract for rich-text documents. Kept independent of Tiptap's
 * own runtime so validating a saved document never requires spinning up an
 * editor instance — it's just a JSON node tree walk.
 */

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
]);

export const ALLOWED_MARK_TYPES = new Set(["bold", "italic", "strike", "underline", "link"]);

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

function walk(node: JsonNode, depth: number): void {
  if (depth > LIMITS.maxNestingDepth) {
    throw new DocumentValidationError(`Document nesting exceeds ${LIMITS.maxNestingDepth} levels.`);
  }
  if (!node.type || !ALLOWED_NODE_TYPES.has(node.type)) {
    throw new DocumentValidationError(`Unsupported node type: ${node.type}`);
  }
  for (const mark of node.marks ?? []) {
    if (!ALLOWED_MARK_TYPES.has(mark.type)) {
      throw new DocumentValidationError(`Unsupported mark type: ${mark.type}`);
    }
    if (mark.type === "link" && !isValidHref(mark.attrs?.href)) {
      throw new DocumentValidationError("Links must use http:, https:, or mailto:.");
    }
  }
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
    const blockTypes = new Set(["paragraph", "heading", "listItem", "blockquote"]);
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
