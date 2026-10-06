/**
 * Turns the markdown name lists in data/name-collections into one compact
 * JSON per species (names only), which Character On Demand imports lazily.
 * Re-run (`npm run names:build`) only when the markdown changes.
 */
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parseNameCollection } from "../src/lib/character-on-demand/parse-names";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "data", "name-collections");
const TARGET = path.join(ROOT, "src", "lib", "character-on-demand", "names");

/** File name word to species key, e.g. "Dwarves" to "dwarf". */
const SPECIES: Record<string, string> = {
  Humans: "human",
  Elves: "elf",
  Dwarves: "dwarf",
  Halflings: "halfling",
  Orcs: "orc",
  Dragonborn: "dragonborn",
  Gnomes: "gnome",
  Tieflings: "tiefling",
};

await mkdir(TARGET, { recursive: true });
for (const file of await readdir(SOURCE)) {
  const word = /^\d+-(\w+)-/.exec(file)?.[1];
  const species = word && SPECIES[word];
  if (!species) continue;
  const names = parseNameCollection(await readFile(path.join(SOURCE, file), "utf8"));
  const middle = names.middle.any.length + names.middle.male.length + names.middle.female.length;
  if (!names.male.length || !names.female.length || !middle || !names.surname.length) throw new Error(`${file}: a name section is empty.`);
  await writeFile(path.join(TARGET, `${species}.json`), JSON.stringify(names) + "\n");
  console.log(`${species}: ${names.male.length} male, ${names.female.length} female, ${middle} middle, ${names.surname.length} surnames`);
}
