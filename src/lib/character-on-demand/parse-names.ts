/** The name pools of one species, as stored in `names/<species>.json`. */
export interface NameCollection {
  male: string[];
  female: string[];
  /** Middle names; humans tag theirs by gender, fantasy species use `any`. */
  middle: { any: string[]; male: string[]; female: string[] };
  surname: string[];
}

const SECTIONS: Record<string, "male" | "female" | "middle" | "surname"> = {
  "male first names": "male",
  "female first names": "female",
  "optional middle names": "middle",
  "surnames and clan names": "surname",
};

/**
 * Reads one `data/name-collections` markdown file: only the numbered table
 * rows (`| 12 | Name | Usage | …`) under the four name headings count, so the
 * prose, contents list and other tables (Humans' regional distribution) are skipped.
 */
export function parseNameCollection(markdown: string): NameCollection {
  const out: NameCollection = { male: [], female: [], middle: { any: [], male: [], female: [] }, surname: [] };
  const seen = new Set<string>();
  let section: (typeof SECTIONS)[string] | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("#")) {
      section = SECTIONS[line.replace(/^#+\s*/, "").trim().toLowerCase()] ?? null;
      continue;
    }
    if (!section || !/^\|\s*\d+\s*\|/.test(line)) continue;
    const [, name, usage] = line.split("|").slice(1).map((c) => c.trim());
    if (!name || seen.has(`${section}:${name}`)) continue;
    seen.add(`${section}:${name}`);
    if (section !== "middle") out[section].push(name);
    else if (usage === "M") out.middle.male.push(name);
    else if (usage === "F") out.middle.female.push(name);
    else out.middle.any.push(name);
  }
  return out;
}
