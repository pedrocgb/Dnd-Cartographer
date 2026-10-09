/**
 * Reads one settlement name list (docs/settlements-names-list/*.md): a
 * `**Category:**` line, `## Section` headings and numbered table rows whose
 * second cell is the name. Used by the build script only.
 */
export interface ParsedNameList {
  category: string;
  /** Names by section heading, in file order, without duplicates. */
  sections: Map<string, string[]>;
}

const CELL_SPLIT = /(?<!\\)\|/;

export function parseNameList(markdown: string): ParsedNameList {
  const category = /^\*\*Category:\*\*\s*(.+?)\s*$/m.exec(markdown)?.[1];
  if (!category) throw new Error("No **Category:** line.");
  const sections = new Map<string, string[]>();
  const seen = new Set<string>();
  let section = "";
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      section = heading[1];
      continue;
    }
    const cells = line.split(CELL_SPLIT).map((c) => c.trim());
    // "| 12 | Name | …": cells[0] is the empty text before the first pipe.
    if (cells.length < 4 || !/^\d+$/.test(cells[1])) continue;
    const name = cells[2].replace(/\\(.)/g, "$1");
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    sections.set(section, [...(sections.get(section) ?? []), name]);
  }
  return { category, sections };
}
