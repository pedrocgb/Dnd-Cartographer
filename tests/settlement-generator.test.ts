import { describe, it, expect } from "vitest";
import { LOCALES, type Locale } from "../src/i18n/config";
import { expand } from "../src/lib/character-on-demand/backstory/grammar";
import { NARRATIVES, slotKey, writeSummary } from "../src/lib/settlement-generator/narrative";
import type { LabelGroup } from "../src/lib/settlement-generator/labels";
import { MESSAGES } from "../src/i18n/messages";
import { pick, randInt, weightedPick, type Rng } from "../src/lib/random";
import { generateSettlement, type GeneratedSettlement } from "../src/lib/settlement-generator/generate";
import { resolveInputs } from "../src/lib/settlement-generator/inputs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pickName, type NamePool } from "../src/lib/settlement-generator/names";
import { parseNameList } from "../src/lib/settlement-generator/parse-names";
import {
  AGES,
  CLIMATES,
  CONDITIONS,
  DEFAULT_OPTIONS,
  FOUNDINGS,
  GROWTHS,
  PURPOSES,
  RECENT_CHANGES,
  GEOGRAPHIES,
  PROSPERITIES,
  SETTLEMENT_TYPES,
  TONES,
  type Purpose,
  type SettlementOptions,
} from "../src/lib/settlement-generator/options";
import { FOUNDING_DETAILS, changeAllowed } from "../src/lib/settlement-generator/origins";
import { contextOf, rollRules, ruleWeight, type Rule } from "../src/lib/settlement-generator/rules";
import { rollLayout } from "../src/lib/settlement-generator/layout";
import { POPULATION_BANDS, roundPopulation } from "../src/lib/settlement-generator/population";

/** A fixed sequence of rolls, repeated. */
function rolls(...values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

/** A seeded generator (mulberry32), so the statistical checks never flake. */
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POOL: NamePool = [{ tags: [], names: ["Testford", "Mockham"] }];

/** Resolves the options and rolls, like the tool does. */
const gen = (opts: Partial<SettlementOptions>, rng: Rng, locale: Locale = "en-US") =>
  generateSettlement(resolveInputs({ ...DEFAULT_OPTIONS, ...opts }, rng), POOL, rng, locale);

function rollMany(opts: Partial<SettlementOptions>, n = 2000, seed = 1): GeneratedSettlement[] {
  const rng = seeded(seed);
  return Array.from({ length: n }, () => gen(opts, rng));
}

const share = (list: GeneratedSettlement[], test: (s: GeneratedSettlement) => boolean) => list.filter(test).length / list.length;
const allPurposes = (s: GeneratedSettlement): Purpose[] => [s.purposes.primary, ...s.purposes.secondary];

describe("random helpers", () => {
  it("weightedPick never picks a weight of 0 and throws when nothing can win", () => {
    const rng = seeded(7);
    for (let i = 0; i < 200; i++) expect(weightedPick([["a", 0], ["b", 1], ["c", -2]], rng)).toBe("b");
    expect(() => weightedPick([["a", 0]], rng)).toThrow();
  });

  it("weightedPick follows the weights", () => {
    const rng = seeded(3);
    const picks = Array.from({ length: 4000 }, () => weightedPick([["a", 1], ["b", 3]], rng));
    expect(picks.filter((p) => p === "b").length / picks.length).toBeCloseTo(0.75, 1);
  });

  it("pick and randInt stay in range", () => {
    const rng = seeded(5);
    for (let i = 0; i < 200; i++) {
      expect(["x", "y"]).toContain(pick(["x", "y"], rng));
      const n = randInt(2, 4, rng);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
    }
  });
});

describe("resolveInputs", () => {
  it("keeps every picked option as is", () => {
    const opts: SettlementOptions = { type: "Town", geography: "Swamp", climate: "Polar", prosperity: "Wealthy", tone: "Grim" };
    const { inputs, randomized } = resolveInputs(opts, seeded(1));
    expect(inputs).toEqual(opts);
    expect(randomized).toEqual([]);
  });

  it("rolls only the random options and reports them", () => {
    const { inputs, randomized } = resolveInputs({ ...DEFAULT_OPTIONS, type: "City" }, seeded(2));
    expect(inputs.type).toBe("City");
    expect(randomized).toEqual(["geography", "climate", "prosperity", "tone"]);
    expect(GEOGRAPHIES).toContain(inputs.geography);
    expect(PROSPERITIES).toContain(inputs.prosperity);
    expect(TONES).toContain(inputs.tone);
  });

  it("never rolls a geography that a picked climate rules out, and vice versa", () => {
    const rng = seeded(4);
    for (let i = 0; i < 1000; i++) {
      expect(["Desert", "Oasis"]).not.toContain(resolveInputs({ ...DEFAULT_OPTIONS, climate: "Polar" }, rng).inputs.geography);
      expect(resolveInputs({ ...DEFAULT_OPTIONS, geography: "Tundra" }, rng).inputs.climate).toMatch(/Polar|Continental/);
      expect(resolveInputs({ ...DEFAULT_OPTIONS, geography: "Oasis" }, rng).inputs.climate).not.toMatch(/Polar|Temperate/);
    }
  });

  it("makes a random climate underground Subterranean, but keeps a picked one", () => {
    expect(resolveInputs({ ...DEFAULT_OPTIONS, geography: "Underground" }, seeded(1)).inputs.climate).toBe("Subterranean");
    expect(resolveInputs({ ...DEFAULT_OPTIONS, geography: "Underground", climate: "Arid" }, seeded(1)).inputs.climate).toBe("Arid");
  });

  it("lets picked inputs bend the random ones", () => {
    const rng = seeded(9);
    const roll = (opts: Partial<SettlementOptions>, n = 2000) => Array.from({ length: n }, () => resolveInputs({ ...DEFAULT_OPTIONS, ...opts }, rng).inputs);
    const rich = (i: { prosperity: string }) => i.prosperity === "Wealthy" || i.prosperity === "Exceptionally Rich";
    expect(roll({ tone: "Decadent" }).filter(rich).length).toBeGreaterThan(roll({ tone: "Grim" }).filter(rich).length * 3);
    const big = (i: { type: string }) => i.type === "City" || i.type === "Metropolis";
    expect(roll({ climate: "Polar" }).filter(big).length).toBeLessThan(roll({ climate: "Temperate" }).filter(big).length / 3);
  });
});

describe("generateSettlement", () => {
  it("keeps every combination of picked inputs coherent", () => {
    const rng = seeded(11);
    for (const type of SETTLEMENT_TYPES)
      for (const geography of GEOGRAPHIES)
        for (const climate of CLIMATES) {
          const s = gen({ type, geography, climate }, rng);
          const [min, max] = POPULATION_BANDS[type];
          expect(s.population).toBeGreaterThanOrEqual(min);
          expect(s.population).toBeLessThanOrEqual(max);
          expect(s.inputs).toMatchObject({ type, geography, climate });
          expect(FOUNDING_DETAILS[s.origins.founding]).toContain(s.origins.foundingDetail);
          expect(new Set(allPurposes(s)).size).toBe(allPurposes(s).length);
          expect(changeAllowed(s.origins.recentChange, contextOf(s.inputs, s.purposes, s.origins))).toBe(true);
        }
  });

  it("keeps population inside the type's band", () => {
    for (const s of rollMany({}, 3000)) {
      const [min, max] = POPULATION_BANDS[s.inputs.type];
      expect(s.population).toBeGreaterThanOrEqual(min);
      expect(s.population).toBeLessThanOrEqual(max);
    }
  });

  it("gives a homestead only a household's living and an encampment a recent founding", () => {
    for (const s of rollMany({ type: "Homestead" }, 1000)) {
      for (const p of allPurposes(s)) expect(["Trade", "Port", "Military", "Administrative", "Leisure"]).not.toContain(p);
      expect(s.purposes.secondary.length).toBeLessThanOrEqual(1);
    }
    for (const s of rollMany({ type: "Encampment" }, 1000)) expect(s.origins.age).toBe("Recent");
    for (const s of rollMany({ type: "Metropolis" }, 300)) expect(s.purposes.secondary.length).toBeGreaterThanOrEqual(3);
  });

  it("never has a harbor or port away from water, nor logging underground", () => {
    for (const geography of ["Plains", "Mountains", "Desert", "Oasis", "Steppe", "Canyon"] as const)
      for (const s of rollMany({ geography }, 400)) {
        expect(s.origins.founding).not.toBe("Harbor");
        expect(allPurposes(s)).not.toContain("Port");
      }
    for (const s of rollMany({ geography: "Underground" }, 1000)) expect(allPurposes(s)).not.toContain("Logging");
  });

  it("lets geography drive the primary purpose", () => {
    expect(share(rollMany({ geography: "Coast" }), (s) => ["Fishing", "Port"].includes(s.purposes.primary))).toBeGreaterThan(0.5);
    expect(share(rollMany({ geography: "Mountains" }), (s) => s.purposes.primary === "Mining")).toBeGreaterThan(0.4);
    expect(share(rollMany({ geography: "Forest" }), (s) => ["Logging", "Hunting"].includes(s.purposes.primary))).toBeGreaterThan(0.5);
    expect(share(rollMany({ geography: "Steppe" }), (s) => s.purposes.primary === "Herding")).toBeGreaterThan(0.35);
  });

  it("lets prosperity and tone drive the condition and the population", () => {
    const failing = (s: GeneratedSettlement) => s.origins.condition === "Declining" || s.origins.condition === "Partly Abandoned";
    const grim = rollMany({ prosperity: "Destitute", tone: "Grim" });
    const thriving = rollMany({ prosperity: "Exceptionally Rich", tone: "Lively" });
    expect(share(grim, failing)).toBeGreaterThan(0.6);
    expect(share(thriving, failing)).toBeLessThan(0.05);
    const median = (list: GeneratedSettlement[]) => list.map((s) => s.population).sort((a, b) => a - b)[list.length >> 1];
    expect(median(rollMany({ type: "Town", prosperity: "Exceptionally Rich" }))).toBeGreaterThan(median(rollMany({ type: "Town", prosperity: "Destitute" })));
  });

  it("only exhausts or reopens mines where people mine", () => {
    for (const s of rollMany({ prosperity: "Destitute", tone: "Grim" }, 3000))
      if (s.origins.recentChange === "Exhausted Mine" || s.origins.recentChange === "Reopened Mine")
        expect(allPurposes(s).includes("Mining") || s.origins.founding === "Mineral Deposit").toBe(true);
  });

  it("gives volcanic places their own details", () => {
    const volcanic = rollMany({ geography: "Volcanic", type: "Town" }, 3000);
    expect(volcanic.some((s) => s.origins.recentChange === "Eruption")).toBe(true);
    for (const s of rollMany({ geography: "Plains" }, 1000)) {
      expect(s.origins.recentChange).not.toBe("Eruption");
      expect(["Obsidian", "Ash-Rich Soil", "Fire Mountain", "Fungal Caverns"]).not.toContain(s.origins.foundingDetail);
    }
  });

  it("is reproducible with the same rolls", () => {
    expect(rollMany({}, 20, 42)).toEqual(rollMany({}, 20, 42));
  });
});

describe("names and numbers", () => {
  const CAMPS: NamePool = [
    { tags: ["Military"], names: ["Spear Camp", "Shield Camp"] },
    { tags: ["Mining"], names: ["Pick Camp", "Ore Camp"] },
    { tags: ["Trade"], names: ["Caravan Rest", "Market Tents"] },
  ];

  it("favors names whose group fits the primary purpose", () => {
    const rng = seeded(8);
    const picks = Array.from({ length: 3000 }, () => pickName(CAMPS, { primary: "Mining", secondary: [] }, rng));
    expect(picks.filter((n) => n.endsWith("Ore Camp") || n === "Pick Camp").length / picks.length).toBeGreaterThan(0.7);
    expect(new Set(picks).size).toBe(6);
  });

  it("steers clear of names to avoid, unless nothing else comes up", () => {
    const rng = seeded(9);
    const picks = Array.from({ length: 2000 }, () => pickName(POOL, { primary: "Farming", secondary: [] }, rng, new Set(["Testford"])));
    // Each pick rerolls a few times: with half the pool avoided, ~1/64 slip through.
    expect(picks.filter((n) => n === "Testford").length / picks.length).toBeLessThan(0.05);
    expect(pickName([{ tags: [], names: ["Only"] }], { primary: "Farming", secondary: [] }, rng, new Set(["Only"]))).toBe("Only");
  });

  it("parses a name list: category, sections, numbered rows only, no duplicates", () => {
    const md = [
      "# Title",
      "**Category:** Encampment  ",
      "## Military and garrison",
      "| No. | Name | Category | Camp type |",
      "| ---: | --- | --- | --- |",
      "| 1 | Ashbanner Camp | Encampment | Military |",
      "| 2 | ashbanner camp | Encampment | Military |",
      "## Mining and quarry",
      "| 3 | Pick \\| Shovel | Encampment | Mining |",
      "## Sources",
      "- [S01](https://example.com)",
    ].join("\n");
    const { category, sections } = parseNameList(md);
    expect(category).toBe("Encampment");
    expect([...sections]).toEqual([
      ["Military and garrison", ["Ashbanner Camp"]],
      ["Mining and quarry", ["Pick | Shovel"]],
    ]);
  });

  it("has a built name list for every type", () => {
    for (const type of SETTLEMENT_TYPES) {
      const file = path.join(import.meta.dirname, "../src/lib/settlement-generator/names", `${type.toLowerCase()}.json`);
      const pool = JSON.parse(readFileSync(file, "utf8")) as NamePool;
      const names = pool.flatMap((g) => g.names);
      expect(names.length, type).toBeGreaterThanOrEqual(200);
      expect(new Set(names.map((n) => n.toLowerCase())).size, type).toBe(names.length);
      for (const g of pool) for (const tag of g.tags) expect(PURPOSES).toContain(tag);
    }
  });

  it("rounds populations like people say them", () => {
    expect(roundPopulation(137)).toBe(137);
    expect(roundPopulation(734)).toBe(730);
    expect(roundPopulation(4_321)).toBe(4_300);
    expect(roundPopulation(23_740)).toBe(23_500);
  });
});

describe("summary", () => {
  const GROUPS: Record<string, readonly string[]> = {
    cond: CONDITIONS,
    purpose: PURPOSES,
    type: SETTLEMENT_TYPES,
    geo: GEOGRAPHIES,
    detail: Object.values(FOUNDING_DETAILS).flat(),
    age: [...AGES, "RuinsReused"],
    growth: GROWTHS,
    change: RECENT_CHANGES,
    prosperity: PROSPERITIES,
    tone: TONES,
  };

  it("has a phrase table for every value, in every language", () => {
    for (const locale of LOCALES)
      for (const [group, values] of Object.entries(GROUPS))
        for (const value of values) expect(NARRATIVES[locale].tables[slotKey(group, value)]?.length, `${locale} ${group} ${value}`).toBeGreaterThan(0);
  });

  it("has the same tables and entry counts in every language", () => {
    const counts = (locale: Locale) => Object.fromEntries(Object.entries(NARRATIVES[locale].tables).map(([k, v]) => [k, v.length]));
    for (const locale of LOCALES) {
      expect(counts(locale)).toEqual(counts("en-US"));
      expect(NARRATIVES[locale].templates.length).toBe(NARRATIVES["en-US"].templates.length);
    }
  });

  it("expands every entry for both noun genders, with nothing left over", () => {
    for (const locale of LOCALES)
      for (const entries of Object.values(NARRATIVES[locale].tables))
        for (const entry of entries)
          for (const gender of ["Male", "Female"] as const) expect(expand(entry, NARRATIVES[locale].tables, gender, Math.random)).not.toMatch(/[{}|]/);
  });

  it("writes a whole paragraph in the language asked for", () => {
    const rng = seeded(21);
    for (const locale of LOCALES)
      for (let i = 0; i < 300; i++) {
        const s = gen({}, rng, locale);
        expect(s.locale).toBe(locale);
        expect(s.summary.startsWith(s.name)).toBe(true);
        expect(s.summary).not.toMatch(/[{}|\u0001]/);
        expect(s.summary.split(/(?<=[.!?]) /).length).toBeGreaterThanOrEqual(5);
      }
  });

  it("agrees with the noun in pt-BR and doesn't repeat the ruins", () => {
    const base = { name: "Pedravelha", purposes: { primary: "Mining" as const, secondary: [] } };
    const origins = { founding: "Ruins" as const, foundingDetail: "Elven Ruins", age: "Built Over Ruins" as const, growth: "Gradual" as const, condition: "Overcrowded" as const, recentChange: "Fire" as const };
    const inputs = { type: "Hamlet" as const, geography: "Hills" as const, climate: "Temperate" as const, prosperity: "Poor" as const, tone: "Grim" as const };
    const camp = writeSummary({ ...base, inputs: { ...inputs, type: "Encampment" }, origins }, "pt-BR", rolls(0));
    expect(camp).toContain("um acampamento minerador superlotado");
    expect(camp).toContain("Foi fundado entre ruínas élficas, com as primeiras casas erguidas das pedras caídas.");
    expect(writeSummary({ ...base, inputs: { ...inputs, type: "City" }, origins }, "pt-BR", rolls(0))).toContain("uma cidade mineradora superlotada");
    expect(writeSummary({ ...base, inputs, origins }, "en-US", rolls(0))).toContain("Pedravelha is an overcrowded mining hamlet among rolling hills.");
  });
});

describe("labels", () => {
  it("words every value a settlement can hold, in every language", () => {
    const groups: Record<LabelGroup, readonly string[]> = {
      type: SETTLEMENT_TYPES,
      geography: GEOGRAPHIES,
      climate: [...CLIMATES, "Subterranean"],
      prosperity: PROSPERITIES,
      tone: TONES,
      purpose: PURPOSES,
      founding: FOUNDINGS,
      detail: Object.values(FOUNDING_DETAILS).flat(),
      age: AGES,
      growth: GROWTHS,
      condition: CONDITIONS,
      change: RECENT_CHANGES,
    };
    for (const locale of LOCALES)
      for (const [group, values] of Object.entries(groups))
        for (const value of values) expect(Object.hasOwn(MESSAGES[locale].settlement, `${group}.${value}`), `${locale} ${group}.${value}`).toBe(true);
  });
});

describe("rules", () => {
  type Ctx = { tone: string; purposes: string[] };
  const RULES: Rule<"a" | "b" | "c", Ctx>[] = [
    { key: "a", weight: 2, by: { tone: { Grim: 3 }, purposes: { Mining: 2, Trade: 0.5 } } },
    { key: "b", requires: (c) => c.tone !== "Grim" },
    { key: "c", by: { tone: { Grim: 0 } } },
  ];

  it("multiplies the base weight by every matching factor, once per list member", () => {
    expect(ruleWeight(RULES[0], { tone: "Grim", purposes: ["Mining", "Trade"] })).toBe(2 * 3 * 2 * 0.5);
    expect(ruleWeight(RULES[0], { tone: "Peaceful", purposes: [] })).toBe(2);
    expect(ruleWeight(RULES[1], { tone: "Grim", purposes: [] })).toBe(0);
  });

  it("rolls several different options and stops when none are left", () => {
    const picks = rollRules(RULES, { tone: "Grim", purposes: [] }, 3, seeded(1));
    expect(picks).toEqual(["a"]);
    expect(new Set(rollRules(RULES, { tone: "Lively", purposes: [] }, 3, seeded(2))).size).toBe(3);
  });
});

describe("layout", () => {
  /** A settlement and its layout, rolled like the tool does. */
  const lay = (opts: Partial<SettlementOptions>, rng: Rng) => {
    const s = gen(opts, rng);
    return { s, layout: rollLayout(contextOf(s.inputs, s.purposes, s.origins), rng) };
  };
  const layMany = (opts: Partial<SettlementOptions>, n = 1500, seed = 3) => {
    const rng = seeded(seed);
    return Array.from({ length: n }, () => lay(opts, rng));
  };

  it("rolls a whole layout for every type, geography and climate", () => {
    const rng = seeded(31);
    for (const type of SETTLEMENT_TYPES)
      for (const geography of GEOGRAPHIES)
        for (const climate of CLIMATES)
          for (let i = 0; i < 3; i++) {
            const { layout } = lay({ type, geography, climate }, rng);
            expect(new Set(layout.roads.map((r) => r.from)).size).toBe(layout.roads.length);
            expect(new Set(layout.outlying).size).toBe(layout.outlying.length);
          }
  });

  it("keeps docks by the water and bridges where there is something to cross", () => {
    for (const geography of ["Plains", "Desert", "Oasis", "Steppe", "Tundra", "Hills"] as const)
      for (const { layout } of layMany({ geography }, 200)) expect(layout.docks).toBeNull();
    for (const { layout } of layMany({ geography: "Coast" }, 300)) expect(layout.docks).not.toBeNull();
    for (const { s, layout } of layMany({ geography: "Desert" }, 300))
      if (s.origins.founding !== "Ford" && s.origins.recentChange !== "Destroyed Bridge") expect(layout.bridges).toBeNull();
    for (const { s, layout } of layMany({ geography: "Riverbank" }, 1500)) if (s.origins.recentChange === "Destroyed Bridge") expect(layout.bridges).toBe("Broken Bridge");
  });

  it("follows the place: tunnels underground, oasis pools in oases, sea lanes to islands", () => {
    const share2 = <T,>(list: T[], test: (x: T) => boolean) => list.filter(test).length / list.length;
    const under = layMany({ geography: "Underground" });
    expect(share2(under, ({ layout }) => layout.streets === "Tunnels and Galleries")).toBeGreaterThan(0.6);
    expect(share2(under, ({ layout }) => layout.materials === "Carved Rock")).toBeGreaterThan(0.6);
    for (const { layout } of under) expect(["Timber and Thatch", "Mud Brick", "Sod and Turf"]).not.toContain(layout.materials);
    expect(share2(layMany({ geography: "Oasis" }), ({ layout }) => layout.waterSource === "Oasis Pool")).toBeGreaterThan(0.6);
    expect(share2(layMany({ geography: "Island" }), ({ layout }) => layout.roads.some((r) => r.kind === "Sea Lane" || r.kind === "Ferry Landing"))).toBeGreaterThan(0.8);
    expect(share2(layMany({ geography: "Swamp", type: "Village" }), ({ layout }) => layout.streets === "Stilt Walkways")).toBeGreaterThan(0.4);
  });

  it("follows the origins and the people", () => {
    const share2 = <T,>(list: T[], test: (x: T) => boolean) => list.filter(test).length / list.length;
    const towns = layMany({ type: "Town" }, 3000);
    const grid = (planned: boolean) => share2(towns.filter(({ s }) => (s.origins.growth === "Planned") === planned), ({ layout }) => layout.streets === "Grid");
    expect(grid(true)).toBeGreaterThan(grid(false) * 5);
    const packed = (overcrowded: boolean) => share2(towns.filter(({ s }) => (s.origins.condition === "Overcrowded") === overcrowded), ({ layout }) => layout.density === "Packed");
    expect(packed(true)).toBeGreaterThan(packed(false) * 3);
    for (const { layout } of layMany({ type: "Homestead" }, 500)) {
      expect(layout.roads.length).toBe(1);
      expect(["Market Square", "Palace", "Guildhall", "Keep"]).not.toContain(layout.center);
      expect(["Sewers", "Public Bathhouses", "Night-Soil Carts"]).not.toContain(layout.sanitation);
    }
    for (const { layout } of layMany({ type: "Metropolis" }, 300)) expect(layout.roads.length).toBeGreaterThanOrEqual(6);
    const rich = layMany({ type: "City", prosperity: "Exceptionally Rich" });
    const poor = layMany({ type: "City", prosperity: "Destitute" });
    const stone = (list: typeof rich) => share2(list, ({ layout }) => layout.materials === "Dressed Stone");
    expect(stone(rich)).toBeGreaterThan(stone(poor) * 5);
    for (const { layout } of layMany({ type: "Encampment" }, 500))
      expect(["Market Square", "Palace", "Guildhall", "Village Green", "Communal Well", "Farmyard", "Crossroads Inn"]).not.toContain(layout.center);
  });

  it("never shows a mine head where nobody mines", () => {
    for (const { s, layout } of layMany({ geography: "Plains" }, 2000)) {
      const mining = s.purposes.primary === "Mining" || s.purposes.secondary.includes("Mining") || s.origins.founding === "Mineral Deposit";
      if (!mining) {
        expect(layout.center).not.toBe("Mine Head");
        expect(layout.outlying).not.toContain("Mine Head");
      }
    }
  });
});
