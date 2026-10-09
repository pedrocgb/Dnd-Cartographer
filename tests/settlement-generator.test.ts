import { describe, it, expect } from "vitest";
import { pick, randInt, weightedPick, type Rng } from "../src/lib/random";
import { generateSettlement, type GeneratedSettlement } from "../src/lib/settlement-generator/generate";
import { resolveInputs } from "../src/lib/settlement-generator/inputs";
import { PLACEHOLDER_NAMES, pickName } from "../src/lib/settlement-generator/names";
import {
  CLIMATES,
  DEFAULT_OPTIONS,
  GEOGRAPHIES,
  PROSPERITIES,
  SETTLEMENT_TYPES,
  TONES,
  type Purpose,
  type SettlementOptions,
} from "../src/lib/settlement-generator/options";
import { FOUNDING_DETAILS, changeAllowed } from "../src/lib/settlement-generator/origins";
import { POPULATION_BANDS, roundPopulation } from "../src/lib/settlement-generator/population";

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

function rollMany(opts: Partial<SettlementOptions>, n = 2000, seed = 1): GeneratedSettlement[] {
  const rng = seeded(seed);
  return Array.from({ length: n }, () => generateSettlement({ ...DEFAULT_OPTIONS, ...opts }, PLACEHOLDER_NAMES, rng));
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
          const s = generateSettlement({ ...DEFAULT_OPTIONS, type, geography, climate }, PLACEHOLDER_NAMES, rng);
          const [min, max] = POPULATION_BANDS[type];
          expect(s.population).toBeGreaterThanOrEqual(min);
          expect(s.population).toBeLessThanOrEqual(max);
          expect(s.inputs).toMatchObject({ type, geography, climate });
          expect(FOUNDING_DETAILS[s.origins.founding]).toContain(s.origins.foundingDetail);
          expect(new Set(allPurposes(s)).size).toBe(allPurposes(s).length);
          const ctx = { inputs: s.inputs, purposes: s.purposes, founding: s.origins.founding, condition: s.origins.condition };
          expect(changeAllowed(s.origins.recentChange, ctx)).toBe(true);
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
  it("favors names whose tags match", () => {
    const rng = seeded(8);
    const picks = Array.from({ length: 2000 }, () => pickName(PLACEHOLDER_NAMES, ["Coast", "Port"], rng));
    expect(picks.filter((n) => n === "Gullhaven" || n === "Saltmere").length / picks.length).toBeGreaterThan(0.3);
  });

  it("rounds populations like people say them", () => {
    expect(roundPopulation(137)).toBe(137);
    expect(roundPopulation(734)).toBe(730);
    expect(roundPopulation(4_321)).toBe(4_300);
    expect(roundPopulation(23_740)).toBe(23_500);
  });
});
