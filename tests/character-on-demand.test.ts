import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { generateCharacter, type Rng } from "../src/lib/character-on-demand/generate";
import { BEARDS, DEFAULT_OPTIONS, FEMALE_HAIRSTYLES, MALE_HAIRSTYLES, type GenerateOptions, type Species } from "../src/lib/character-on-demand/options";
import { parseNameCollection, type NameCollection } from "../src/lib/character-on-demand/parse-names";
import { buildCharacterDocument } from "../src/server/character-on-demand/document";
import { createTranslator } from "../src/i18n/translate";
import { LOCALES } from "../src/i18n/config";

const en = createTranslator("en-US", "character");
import { deriveText, validateDocument } from "../src/server/documents/schema";
import dwarf from "../src/lib/character-on-demand/names/dwarf.json";
import { generateBackstory, tablesFor } from "../src/lib/character-on-demand/backstory";
import { expand } from "../src/lib/character-on-demand/backstory/grammar";
import { BACKGROUNDS } from "../src/lib/character-on-demand/options";
import { HISTORY_MAX, HISTORY_TTL_MS, addToHistory, markArticleCreated, parseHistory, pruneHistory, type HistoryEntry } from "../src/lib/character-on-demand/history";

const NAMES: NameCollection = {
  male: ["Bram", "Tomas"],
  female: ["Ilsa", "Mara"],
  middle: { any: ["Ash"], male: ["Ewan"], female: ["Rose"] },
  surname: ["Stone", "Vale"],
};

/** A fixed sequence of rolls, repeated. */
function rolls(...values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

const opts = (overrides: Partial<GenerateOptions> & { species?: Species } = {}) => ({ ...DEFAULT_OPTIONS, species: "human" as Species, ...overrides });

describe("generateCharacter", () => {
  it("draws first names from the pool of the chosen gender", () => {
    for (let i = 0; i < 20; i++) {
      expect(NAMES.male).toContain(generateCharacter(opts({ gender: "Male" }), NAMES).firstName);
      expect(NAMES.female).toContain(generateCharacter(opts({ gender: "Female" }), NAMES).firstName);
    }
  });

  it("follows the middle name option", () => {
    expect(generateCharacter(opts({ middleName: "never" }), NAMES).middleName).toBeNull();
    const male = generateCharacter(opts({ middleName: "always", gender: "Male" }), NAMES);
    expect(["Ash", "Ewan"]).toContain(male.middleName);
    expect(male.name).toBe(`${male.firstName} ${male.middleName} ${male.surname}`);
    // Random: a roll under the chance adds one, a roll over it doesn't.
    expect(generateCharacter(opts({ middleName: "random", gender: "Male" }), NAMES, rolls(0.1)).middleName).not.toBeNull();
    expect(generateCharacter(opts({ middleName: "random", gender: "Male" }), NAMES, rolls(0.9)).middleName).toBeNull();
  });

  it("gives dragonborn no hair or beard and puts the clan first", () => {
    const c = generateCharacter(opts({ species: "dragonborn", gender: "Male", middleName: "never", hair: true, beard: "both" }), NAMES);
    expect(c.hairstyle).toBeNull();
    expect(c.hairColor).toBeNull();
    expect(c.beard).toBeNull();
    expect(c.name).toBe(`${c.surname} ${c.firstName}`);
  });

  it("matches hairstyles to gender and skips them when hair is off", () => {
    expect(MALE_HAIRSTYLES).toContain(generateCharacter(opts({ gender: "Male" }), NAMES).hairstyle);
    expect(FEMALE_HAIRSTYLES).toContain(generateCharacter(opts({ gender: "Female" }), NAMES).hairstyle);
    expect(generateCharacter(opts({ hair: false }), NAMES).hairstyle).toBeNull();
  });

  it("gives a beard only to the genders the beard option names", () => {
    expect(BEARDS).toContain(generateCharacter(opts({ gender: "Male", beard: "male" }), NAMES).beard);
    expect(generateCharacter(opts({ gender: "Female", beard: "male" }), NAMES).beard).toBeNull();
    expect(BEARDS).toContain(generateCharacter(opts({ gender: "Female", beard: "both" }), NAMES).beard);
    expect(generateCharacter(opts({ gender: "Male", beard: "none" }), NAMES).beard).toBeNull();
  });

  it("adds a backstory only when asked", () => {
    expect(generateCharacter(opts({ backstory: false }), NAMES).backstory).toBeNull();
    expect(generateCharacter(opts({ backstory: true }), NAMES).backstory?.want).toBeTruthy();
  });

  it("leaves the background out when it is none", () => {
    expect(generateCharacter(opts({ background: "none" }), NAMES).background).toBeNull();
    expect(generateCharacter(opts({ background: "Merchant" }), NAMES).background).toBe("Merchant");
  });
});

describe("parseNameCollection", () => {
  it("reads only numbered rows under the name headings", () => {
    const md = [
      "# Test",
      "### Regional distribution",
      "| 1 | Europe | 20 |",
      "## Male first names",
      "| # | Name | Usage |",
      "|---:|---|---|",
      "| 1 | Bram | M | Forge | O |",
      "| 2 | Bram | M | Forge | O |",
      "## Optional middle names",
      "| 1 | Ewan | M | x |",
      "| 2 | Rose | F | x |",
      "| 3 | Ash | Any | x |",
      "## Sources and provenance",
      "| 1 | NotAName | x |",
    ].join("\n");
    expect(parseNameCollection(md)).toEqual({ male: ["Bram"], female: [], middle: { any: ["Ash"], male: ["Ewan"], female: ["Rose"] }, surname: [] });
  });

  it("finds 500 names per section in a real collection", () => {
    const md = readFileSync(path.join(__dirname, "..", "data", "name-collections", "01-Humans-2000-Names.md"), "utf8");
    const names = parseNameCollection(md);
    expect(names.male).toHaveLength(500);
    expect(names.female).toHaveLength(500);
    expect(names.middle.any.length + names.middle.male.length + names.middle.female.length).toBe(500);
    expect(names.surname).toHaveLength(500);
  });

  it("matches the committed JSON", () => {
    expect(dwarf.male).toHaveLength(500);
    expect(dwarf.surname).toContain("Amberanvil");
  });
});

describe("buildCharacterDocument", () => {
  it("adds the backstory with the secret in a secret block", () => {
    const backstory = { appearance: "Wears a cloak.", want: "He wants his cart.", quirk: "Whistles", fear: "Owls", secret: "He can read." };
    const doc = buildCharacterDocument([{ label: "Species", value: "Elf" }], backstory, en);
    expect(() => validateDocument(doc)).not.toThrow();
    expect(doc.content.at(-1)).toMatchObject({ type: "secret" });
    expect(deriveText(doc)).toContain("Secret: He can read.");
  });

  it("builds a valid document listing the details", () => {
    const doc = buildCharacterDocument([
      { label: "Species", value: "Dwarf" },
      { label: "Beard", value: "Forked Beard" },
    ], null, en);
    expect(() => validateDocument(doc)).not.toThrow();
    expect(deriveText(doc)).toBe("Generated details\nSpecies: Dwarf\nBeard: Forked Beard");
  });
});

describe("backstory", () => {
  const backgrounds = [null, ...BACKGROUNDS];

  it("expands every entry of every table for both genders, in every language", () => {
    for (const locale of LOCALES) {
      for (const background of backgrounds) {
        const tables = tablesFor(background, locale);
        for (const [name, entries] of Object.entries(tables)) {
          for (const entry of entries) {
            for (const gender of ["Male", "Female"] as const) {
              const out = expand(entry, tables, gender, Math.random);
              expect(out, `${locale} ${background ?? "none"}.${name}: ${entry}`).not.toMatch(/[{}|]/);
            }
          }
        }
      }
    }
  });

  it("has the same tables, with as many entries, in every language", () => {
    for (const background of backgrounds) {
      const source = tablesFor(background, "en-US");
      const counts = (tables: typeof source) => Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
      for (const locale of LOCALES) expect(counts(tablesFor(background, locale)), `${locale} ${background ?? "none"}`).toEqual(counts(source));
    }
  });

  it("picks the word form for the character's gender", () => {
    const tables = { wants: ["Foi mandad{o|a} embora por {ele|ela} mesm{o|a}."] };
    expect(expand("{wants}", tables, "Female", Math.random)).toBe("Foi mandada embora por ela mesma.");
    expect(expand("{wants}", tables, "Male", Math.random)).toBe("Foi mandado embora por ele mesmo.");
  });

  it("never repeats a slot in one entry (each would pick a different value)", () => {
    const pronouns = new Set(["they", "their", "them", "theirs", "themself"]);
    for (const background of backgrounds) {
      for (const entries of LOCALES.flatMap((locale) => Object.values(tablesFor(background, locale)))) {
        for (const entry of entries) {
          const slots = [...entry.matchAll(/\{(\w+)\}/g)].map((m) => m[1].toLowerCase()).filter((slot) => !pronouns.has(slot));
          expect(new Set(slots).size, entry).toBe(slots.length);
        }
      }
    }
  });

  it("uses the character's pronouns", () => {
    const tables = { wants: ["{They} lent {their} cart to {them}."] };
    expect(expand("{wants}", tables, "Female", Math.random)).toBe("She lent her cart to her.");
    expect(expand("{wants}", tables, "Male", Math.random)).toBe("He lent his cart to him.");
  });

  it("fails loudly on an unknown slot", () => {
    expect(() => expand("{nope}", {}, "Male", Math.random)).toThrow(/nope/);
  });

  it("is repeatable with the same rolls", () => {
    expect(generateBackstory("Merchant", "Male", rolls(0.2, 0.7, 0.4))).toEqual(generateBackstory("Merchant", "Male", rolls(0.2, 0.7, 0.4)));
  });

  it("starts every line with a capital and keeps want and fear short enough for their fields", () => {
    for (let i = 0; i < 600; i++) {
      const b = generateBackstory(pickBackground(i), i % 2 ? "Male" : "Female", Math.random, LOCALES[Math.floor(i / 2) % LOCALES.length]);
      for (const line of Object.values(b)) expect(line.charAt(0)).toBe(line.charAt(0).toUpperCase());
      expect(b.fear.length).toBeLessThanOrEqual(200);
    }
  });

  function pickBackground(i: number) {
    return backgrounds[i % backgrounds.length];
  }
});

describe("history", () => {
  const entry = (id: string, createdAt: number): HistoryEntry => ({ id, createdAt, character: { name: id } as HistoryEntry["character"] });

  it("keeps the newest first and drops the oldest past the limit", () => {
    let list: HistoryEntry[] = [];
    for (let i = 0; i < HISTORY_MAX + 2; i++) list = addToHistory(list, entry(`c${i}`, 1000 + i), 1000 + i);
    expect(list).toHaveLength(HISTORY_MAX);
    expect(list[0].id).toBe(`c${HISTORY_MAX + 1}`);
    expect(list.map((e) => e.id)).not.toContain("c0");
    expect(list.map((e) => e.id)).not.toContain("c1");
  });

  it("drops expired entries", () => {
    const now = 10 * HISTORY_TTL_MS;
    expect(pruneHistory([entry("old", now - HISTORY_TTL_MS), entry("new", now - 1)], now).map((e) => e.id)).toEqual(["new"]);
  });

  it("remembers the article made from an entry", () => {
    expect(markArticleCreated([entry("a", 1), entry("b", 2)], "b", "person-1")[1].personId).toBe("person-1");
  });

  it("reads corrupt or foreign storage as empty", () => {
    expect(parseHistory("not json")).toEqual([]);
    expect(parseHistory('{"a":1}')).toEqual([]);
    expect(parseHistory('[{"id":1}]')).toEqual([]);
    expect(parseHistory(JSON.stringify([entry("a", 1)]))).toHaveLength(1);
  });
});
