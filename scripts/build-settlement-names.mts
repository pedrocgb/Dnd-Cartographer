/**
 * Turns the markdown name lists in docs/settlements-names-list into one
 * compact JSON per settlement type, which the Settlement Generator imports
 * lazily (only the rolled type's list is ever downloaded).
 * Re-run (`npm run settlement-names:build`) only when the markdown changes.
 */
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parseNameList } from "../src/lib/settlement-generator/parse-names";
import type { NameGroup } from "../src/lib/settlement-generator/names";
import { SETTLEMENT_TYPES, type Purpose, type SettlementType } from "../src/lib/settlement-generator/options";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "docs", "settlements-names-list");
const TARGET = path.join(ROOT, "src", "lib", "settlement-generator", "names");

/** The lists' **Category:** to settlement type. */
const CATEGORY: Record<string, SettlementType> = {
  Homestead: "Homestead",
  Hamlet: "Hamlet",
  Village: "Village",
  Town: "Town",
  City: "City",
  "Metropolis / Capital": "Metropolis",
  Encampment: "Encampment",
};

/** Encampment sections to the purposes whose camps they name; other lists have a single "Names" section. */
const SECTION_PURPOSES: Record<string, Purpose[]> = {
  Names: [],
  "Military and garrison": ["Military"],
  "Caravan and trader": ["Trade"],
  "Explorer, frontier, and expedition": ["Scholarly"],
  "Hunter and trapper": ["Hunting"],
  "Mercenary and bounty hunter": ["Military"],
  "Mining and quarry": ["Mining"],
  "Outlaw, smuggler, and rebel": ["Smuggling"],
  "Pilgrim and religious": ["Religious"],
  "Refugee and displaced community": ["Refuge"],
  "Timber, herder, and seasonal worker": ["Logging", "Herding", "Farming", "Fishing"],
};

await mkdir(TARGET, { recursive: true });
const built = new Set<SettlementType>();
for (const file of (await readdir(SOURCE)).filter((f) => f.endsWith(".md"))) {
  const { category, sections } = parseNameList(await readFile(path.join(SOURCE, file), "utf8"));
  const type = CATEGORY[category];
  if (!type) throw new Error(`${file}: unknown category "${category}".`);
  const groups: NameGroup[] = [...sections].map(([section, names]) => {
    const tags = SECTION_PURPOSES[section];
    if (!tags) throw new Error(`${file}: no purposes for section "${section}".`);
    return { tags, names };
  });
  const total = groups.reduce((n, g) => n + g.names.length, 0);
  if (!total) throw new Error(`${file}: no names.`);
  await writeFile(path.join(TARGET, `${type.toLowerCase()}.json`), JSON.stringify(groups) + "\n");
  built.add(type);
  console.log(`${type}: ${total} names in ${groups.length} group(s)`);
}
const missing = SETTLEMENT_TYPES.filter((t) => !built.has(t));
if (missing.length) throw new Error(`No name list for: ${missing.join(", ")}.`);
