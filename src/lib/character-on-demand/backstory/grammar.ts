import type { Gender } from "../options";

/** Named word lists; an entry may itself contain `{slots}`. */
export type Tables = Readonly<Record<string, readonly string[]>>;

export type Rng = () => number;

const PRONOUNS: Record<Gender, Record<string, string>> = {
  Male: { they: "he", their: "his", them: "him", theirs: "his", themself: "himself" },
  Female: { they: "she", their: "her", them: "her", theirs: "hers", themself: "herself" },
};

const SLOT = /\{(\w+)\}/g;
const MAX_DEPTH = 6;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Fills every `{slot}` of a template with a random entry of the table of the
 * same name, recursively. `{They}`/`{their}`… are the character's pronouns;
 * a capitalized slot (`{Item}`) capitalizes what it picks. An unknown slot
 * throws, so a typo in the tables fails the tests instead of reaching a character.
 */
export function expand(template: string, tables: Tables, gender: Gender, rng: Rng, depth = 0): string {
  if (depth > MAX_DEPTH) throw new Error(`Backstory template nests too deep: ${template}`);
  return template.replace(SLOT, (_, slot: string) => {
    const key = slot.charAt(0).toLowerCase() + slot.slice(1);
    const pronoun = PRONOUNS[gender][key];
    const options = tables[key];
    if (pronoun === undefined && !options?.length) throw new Error(`Unknown backstory slot {${slot}}`);
    const value = pronoun ?? expand(options![Math.floor(rng() * options!.length)], tables, gender, rng, depth + 1);
    return slot === key ? value : capitalize(value);
  });
}
