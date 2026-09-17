// Extracts hyperlinks from a Tiptap/ProseMirror JSON document and
// classifies them against this app's own internal URL shapes
// (`/maps/:mapId` and `/maps/:mapId?marker=:markerId`, exactly what
// MarkerPanel's "Copy link" button produces) so a plain rich-text
// hyperlink pointing at another marker/map can be recognized as an
// internal reference instead of an opaque external URL.

interface ProseMirrorNode {
  type?: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: ProseMirrorNode[];
}

export interface ExtractedLink {
  href: string;
  text: string;
}

export function extractLinksFromJson(jsonText: string): ExtractedLink[] {
  let doc: ProseMirrorNode;
  try {
    doc = JSON.parse(jsonText);
  } catch {
    return [];
  }
  const links: ExtractedLink[] = [];
  function walk(node: ProseMirrorNode | undefined) {
    if (!node) return;
    const linkMark = node.marks?.find((m) => m.type === "link");
    const href = linkMark?.attrs?.href;
    if (typeof href === "string" && href) links.push({ href, text: node.text ?? href });
    node.content?.forEach(walk);
  }
  walk(doc);
  return links;
}

export type ClassifiedHref =
  | { kind: "marker"; mapId: string; markerId: string }
  | { kind: "map"; mapId: string }
  | { kind: "external" };

export function classifyHref(href: string): ClassifiedHref {
  try {
    const url = new URL(href, "http://localhost");
    const match = url.pathname.match(/\/maps\/([^/]+)/);
    if (match) {
      const markerId = url.searchParams.get("marker");
      if (markerId) return { kind: "marker", mapId: match[1], markerId };
      return { kind: "map", mapId: match[1] };
    }
  } catch {
    // fall through to external
  }
  return { kind: "external" };
}
