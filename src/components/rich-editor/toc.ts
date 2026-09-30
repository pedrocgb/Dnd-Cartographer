import { mentionDisplayText } from "../../server/mentions/kinds";

/** A heading as the table of contents lists it. */
export interface TocHeading {
  /** Document position of the heading node. */
  pos: number;
  level: number;
  text: string;
}

export interface TocEntry extends TocHeading {
  /** "1", "1.2", "1.2.1": its place in the outline. */
  number: string;
  children: TocEntry[];
}

interface NodeLike {
  type: { name: string };
  attrs: Record<string, unknown>;
  content: { size: number };
  textBetween: (from: number, to: number, blockSeparator?: string, leafText?: (leaf: NodeLike) => string) => string;
}
interface DocLike {
  descendants: (f: (node: NodeLike, pos: number) => boolean | void) => void;
}

/** Every heading up to `maxLevel`, in document order (mentions read as their text). */
export function collectHeadings(doc: DocLike, maxLevel: number): TocHeading[] {
  const out: TocHeading[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    const level = Number(node.attrs.level);
    if (level <= maxLevel) {
      const text = node.textBetween(0, node.content.size, " ", (leaf) => (leaf.type.name === "mention" ? mentionDisplayText(leaf.attrs) : "")).trim();
      out.push({ pos, level, text });
    }
    return false;
  });
  return out;
}

/**
 * The headings as an outline: each one is a child of the closest heading
 * before it with a lower level (an H3 right under an H1 nests under it;
 * an H2 with nothing above starts a new top-level entry).
 */
export function buildTocTree(headings: TocHeading[]): TocEntry[] {
  const roots: TocEntry[] = [];
  const stack: TocEntry[] = [];
  for (const h of headings) {
    while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
    const parent = stack[stack.length - 1];
    const siblings = parent ? parent.children : roots;
    const entry: TocEntry = { ...h, number: parent ? `${parent.number}.${siblings.length + 1}` : String(siblings.length + 1), children: [] };
    siblings.push(entry);
    stack.push(entry);
  }
  return roots;
}
