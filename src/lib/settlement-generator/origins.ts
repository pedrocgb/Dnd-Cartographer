import { weightedPick, type Rng } from "../random";
import type { ResolvedInputs } from "./inputs";
import type { Purposes } from "./purposes";
import {
  AGES,
  CONDITIONS,
  FOUNDINGS,
  GROWTHS,
  type Age,
  type Condition,
  type Founding,
  type Geography,
  type Growth,
  type Prosperity,
  type Purpose,
  type RecentChange,
  type SettlementType,
  type Tone,
} from "./options";
import { rollRule, ruleAllowed, type Rule, type SettlementContext } from "./rules";
import { factor, type Weights } from "./weights";

export interface Origins {
  founding: Founding;
  /** What exactly drew the founders: which ore, which kind of ruins… (English key). */
  foundingDetail: string;
  age: Age;
  growth: Growth;
  condition: Condition;
  recentChange: RecentChange;
}

// ── Founding ────────────────────────────────────────────────────────────────

const FOUNDING_BASE: Partial<Record<Founding, number>> = { "Holy Site": 0.8, Ruins: 0.7, Decree: 0.6 };

/** Harbor 0 away from water deep enough for boats. */
const GEOGRAPHY_FOUNDING: Weights<Geography, Founding> = {
  Coast: { Harbor: 6, Crossroads: 0.6 },
  Riverbank: { Ford: 5, Harbor: 1, "Fertile Land": 1.5, Crossroads: 1.5 },
  "Lake Shore": { Harbor: 2.5, "Fertile Land": 2 },
  Plains: { "Fertile Land": 4, Crossroads: 3, Harbor: 0 },
  Hills: { Fortress: 2, "Mineral Deposit": 2, Harbor: 0 },
  Mountains: { "Mineral Deposit": 5, Fortress: 3, Ford: 1.5, "Fertile Land": 0.3, Harbor: 0 },
  Island: { Harbor: 6, Refuge: 1.5, Crossroads: 0.3 },
  Underground: { "Mineral Deposit": 5, Refuge: 4, Ruins: 2, "Holy Site": 1.5, Spring: 1.5, Ford: 0.2, "Fertile Land": 0.3, Crossroads: 0.5, Harbor: 0 },
  Forest: { "Hunting Grounds": 4, "Holy Site": 1.3, Harbor: 0 },
  Swamp: { Refuge: 4, "Hunting Grounds": 2, "Holy Site": 1.5, "Fertile Land": 0.4, Harbor: 0.3 },
  Desert: { Spring: 3, "Mineral Deposit": 2, Ruins: 2, Crossroads: 1.5, "Fertile Land": 0.1, Ford: 0.2, Harbor: 0 },
  Valley: { "Fertile Land": 3, Fortress: 1.5, Ford: 1.5, Harbor: 0 },
  "River Delta": { Harbor: 3, "Fertile Land": 3, Ford: 1.5 },
  Canyon: { Fortress: 3, "Mineral Deposit": 2, Refuge: 2, Ford: 1.5, "Fertile Land": 0.3, Harbor: 0 },
  Volcanic: { "Mineral Deposit": 3, "Holy Site": 3, Spring: 2, Harbor: 0 },
  Tundra: { "Hunting Grounds": 4, Refuge: 1.5, Harbor: 0.5, "Fertile Land": 0.05 },
  Oasis: { Spring: 8, Crossroads: 3, Harbor: 0 },
  Steppe: { Crossroads: 3, "Hunting Grounds": 2, "Fertile Land": 0.6, Harbor: 0 },
};

const PURPOSE_FOUNDING: Weights<Purpose, Founding> = {
  Farming: { "Fertile Land": 5 },
  Herding: { "Fertile Land": 3 },
  Fishing: { Harbor: 3 },
  Mining: { "Mineral Deposit": 6 },
  Logging: { "Hunting Grounds": 3 },
  Hunting: { "Hunting Grounds": 6 },
  Trade: { Crossroads: 4, Ford: 3, Harbor: 2 },
  Port: { Harbor: 6 },
  Military: { Fortress: 6 },
  Religious: { "Holy Site": 6 },
  Scholarly: { Ruins: 3, "Holy Site": 2, Decree: 2 },
  Crafting: { "Mineral Deposit": 2, Ford: 2 },
  Administrative: { Decree: 5, Crossroads: 2 },
  Refuge: { Refuge: 6 },
  Smuggling: { Harbor: 2, Refuge: 2 },
  Leisure: { Spring: 3, "Holy Site": 1.5 },
};

const TYPE_FOUNDING: Weights<SettlementType, Founding> = {
  Homestead: { Decree: 0.2, Crossroads: 0.4 },
  Encampment: { Ruins: 0.5, Decree: 0.5 },
  Metropolis: { Crossroads: 2, Harbor: 2, Decree: 1.5 },
};

interface Detail {
  key: string;
  weight?: number;
  /** Only rolled in these geographies. */
  only?: readonly Geography[];
  geography?: Partial<Record<Geography, number>>;
  prosperity?: Partial<Record<Prosperity, number>>;
}

const RICH = { Wealthy: 2, "Exceptionally Rich": 3 } as const;
const RIVERS: readonly Geography[] = ["Riverbank", "River Delta", "Valley", "Canyon", "Swamp", "Plains"];

const DETAILS: Record<Founding, readonly Detail[]> = {
  Ford: [
    { key: "Shallow Ford", geography: { Mountains: 0.3, Canyon: 0.3 } },
    { key: "Ancient Bridge" },
    { key: "Ferry Crossing", geography: { "River Delta": 2, "Lake Shore": 2 } },
    { key: "Mountain Pass", only: ["Mountains", "Hills", "Canyon", "Valley", "Volcanic"], weight: 2 },
  ],
  Harbor: [
    { key: "Deep Bay", geography: { Coast: 2 } },
    { key: "Hidden Cove", geography: { Island: 2, Coast: 1.5 } },
    { key: "River Mouth", only: ["Riverbank", "River Delta", "Coast", "Swamp"], geography: { "River Delta": 3 } },
    { key: "Sheltered Inlet" },
  ],
  "Mineral Deposit": [
    { key: "Silver", geography: { Mountains: 2 } },
    { key: "Iron", geography: { Mountains: 2, Hills: 2 } },
    { key: "Gold", weight: 0.6, prosperity: RICH },
    { key: "Copper" },
    { key: "Tin", weight: 0.6 },
    { key: "Salt", geography: { Desert: 3, Coast: 2, Steppe: 1.5 } },
    { key: "Gems", weight: 0.5, geography: { Underground: 3, Mountains: 1.5 }, prosperity: RICH },
    { key: "Coal", geography: { Hills: 2 } },
    { key: "Marble", weight: 0.6, geography: { Hills: 1.5 } },
    { key: "Sulfur", only: ["Volcanic", "Underground", "Desert"], geography: { Volcanic: 4 } },
    { key: "Obsidian", only: ["Volcanic"], weight: 3 },
    { key: "Mithral", weight: 0.15, geography: { Underground: 4, Mountains: 2 }, prosperity: RICH },
  ],
  "Fertile Land": [
    { key: "Black Soil", geography: { Plains: 2, Steppe: 2 } },
    { key: "Flood Plains", only: RIVERS, geography: { "River Delta": 3, Riverbank: 2 } },
    { key: "Terraced Slopes", only: ["Hills", "Mountains", "Valley", "Volcanic", "Island", "Canyon"] },
    { key: "Orchards and Groves" },
    { key: "Ash-Rich Soil", only: ["Volcanic"], weight: 4 },
    { key: "Fungal Caverns", only: ["Underground"], weight: 8 },
    { key: "Date Palms", only: ["Oasis", "Desert"], weight: 4 },
  ],
  "Holy Site": [
    { key: "Sacred Spring" },
    { key: "Standing Stones", geography: { Underground: 0.2 } },
    { key: "Site of a Miracle" },
    { key: "Saint's Tomb" },
    { key: "Fallen Star", geography: { Underground: 0.1 } },
    { key: "Fire Mountain", only: ["Volcanic"], weight: 5 },
  ],
  Fortress: [
    { key: "Border Keep" },
    { key: "Hilltop Fort", only: ["Hills", "Mountains", "Valley", "Plains", "Steppe", "Island", "Coast"] },
    { key: "Watchtower" },
    { key: "Legion Camp" },
  ],
  Crossroads: [
    { key: "Trade Roads" },
    { key: "Caravan Route", geography: { Desert: 4, Oasis: 4, Steppe: 3 } },
    { key: "Pilgrim Road" },
    { key: "River Junction", only: RIVERS, geography: { Riverbank: 3 } },
    { key: "Tunnel Junction", only: ["Underground"], weight: 8 },
  ],
  Refuge: [
    { key: "War" },
    { key: "Persecution" },
    { key: "Plague" },
    { key: "Natural Disaster" },
    { key: "Monsters" },
  ],
  "Hunting Grounds": [
    { key: "Great Herds", geography: { Plains: 3, Steppe: 4, Tundra: 3, Forest: 0.3 } },
    { key: "Deep Woods", geography: { Forest: 4, Tundra: 0.2, Desert: 0, Steppe: 0.1, Underground: 0 } },
    { key: "Fur-Rich Wilds", geography: { Tundra: 3, Mountains: 2 } },
    { key: "Teeming Waters", only: ["Coast", "Island", "Lake Shore", "Riverbank", "River Delta", "Swamp", "Tundra"] },
    { key: "Cave Beasts", only: ["Underground"], weight: 6 },
  ],
  Ruins: [
    { key: "Elven Ruins", geography: { Forest: 3, Underground: 0.2 } },
    { key: "Dwarven Hold", geography: { Mountains: 3, Underground: 4, Hills: 2 } },
    { key: "Fallen Empire" },
    { key: "Forgotten Temple" },
    { key: "Giant's Ruin", weight: 0.5 },
  ],
  Spring: [
    { key: "Fresh Spring" },
    { key: "Hot Springs", geography: { Volcanic: 5, Mountains: 2 } },
    { key: "Deep Well", geography: { Desert: 3, Oasis: 2, Steppe: 2 } },
  ],
  Decree: [
    { key: "Royal Charter" },
    { key: "Temple Decree" },
    { key: "Guild Charter" },
    { key: "Penal Colony", weight: 0.6 },
  ],
};

function detailWeight(d: Detail, inputs: ResolvedInputs): number {
  if (d.only && !d.only.includes(inputs.geography)) return 0;
  return (d.weight ?? 1) * (d.geography?.[inputs.geography] ?? 1) * (d.prosperity?.[inputs.prosperity] ?? 1);
}

function rollFounding(inputs: ResolvedInputs, purposes: Purposes, rng: Rng): { founding: Founding; foundingDetail: string } {
  const weight = (f: Founding) =>
    (FOUNDING_BASE[f] ?? 1) *
    factor(GEOGRAPHY_FOUNDING, inputs.geography, f) *
    factor(TYPE_FOUNDING, inputs.type, f) *
    factor(PURPOSE_FOUNDING, purposes.primary, f) *
    // Secondary purposes pull too, more gently.
    purposes.secondary.reduce((w, p) => w * Math.sqrt(factor(PURPOSE_FOUNDING, p, f)), 1);
  const founding = weightedPick(FOUNDINGS.map((f) => [f, weight(f)] as const), rng);
  const foundingDetail = weightedPick(DETAILS[founding].map((d) => [d.key, detailWeight(d, inputs)] as const), rng);
  return { founding, foundingDetail };
}

/** Every detail key, for tests and translations. */
export const FOUNDING_DETAILS: Readonly<Record<Founding, readonly string[]>> = Object.fromEntries(
  FOUNDINGS.map((f) => [f, DETAILS[f].map((d) => d.key)])
) as Record<Founding, string[]>;

// ── Age and growth ──────────────────────────────────────────────────────────

/** An encampment is always recent. */
const TYPE_AGE: Record<SettlementType, Record<Age, number>> = {
  Homestead: { Recent: 3, Generations: 3, Centuries: 1, Ancient: 0.2, "Built Over Ruins": 0.3 },
  Hamlet: { Recent: 2, Generations: 3, Centuries: 2, Ancient: 0.5, "Built Over Ruins": 0.5 },
  Village: { Recent: 1, Generations: 3, Centuries: 3, Ancient: 1, "Built Over Ruins": 1 },
  Town: { Recent: 0.7, Generations: 2, Centuries: 3, Ancient: 1.5, "Built Over Ruins": 1.5 },
  City: { Recent: 0.3, Generations: 1, Centuries: 3, Ancient: 2.5, "Built Over Ruins": 2 },
  Metropolis: { Recent: 0.1, Generations: 0.5, Centuries: 2.5, Ancient: 3, "Built Over Ruins": 2.5 },
  Encampment: { Recent: 1, Generations: 0, Centuries: 0, Ancient: 0, "Built Over Ruins": 0 },
};

const FOUNDING_AGE: Weights<Founding, Age> = {
  Ruins: { "Built Over Ruins": 8, Recent: 0.5 },
  Decree: { Recent: 1.5 },
  Refuge: { Recent: 1.5, Generations: 1.5 },
  "Holy Site": { Ancient: 2 },
};

const GROWTH_BASE: Record<Growth, number> = { Planned: 1, Gradual: 4, Migration: 1.5, Occupation: 1, Merged: 1.5, "Boom and Bust": 1 };

const FOUNDING_GROWTH: Weights<Founding, Growth> = {
  Fortress: { Occupation: 5, Planned: 2 },
  Decree: { Planned: 6 },
  "Mineral Deposit": { "Boom and Bust": 4, Migration: 2 },
  Refuge: { Migration: 5 },
  Crossroads: { Merged: 2, Gradual: 1.5 },
  "Holy Site": { Gradual: 1.5, Migration: 1.5 },
};

const AGE_GROWTH: Weights<Age, Growth> = {
  Recent: { Gradual: 0.3, Merged: 0.3, Migration: 2, Planned: 2 },
  Ancient: { Gradual: 2, Merged: 2 },
  "Built Over Ruins": { Planned: 1.5, Gradual: 1.5 },
};

const TYPE_GROWTH: Weights<SettlementType, Growth> = {
  Homestead: { Merged: 0, Occupation: 0.1, "Boom and Bust": 0.3 },
  Hamlet: { Occupation: 0.4 },
  Metropolis: { Merged: 2, Planned: 1.5 },
  Encampment: { Migration: 3, Occupation: 3, "Boom and Bust": 1.5, Merged: 0.5, Gradual: 0.2 },
};

const TONE_GROWTH: Weights<Tone, Growth> = {
  Peaceful: { Gradual: 1.5, Occupation: 0.3 },
  Oppressive: { Occupation: 2.5, Planned: 1.5 },
  Harsh: { Occupation: 1.5, "Boom and Bust": 1.5 },
};

// ── Condition ───────────────────────────────────────────────────────────────

const CONDITION_BASE: Record<Condition, number> = {
  Growing: 2,
  Stable: 3,
  Declining: 1.5,
  Recovering: 1,
  Overcrowded: 0.8,
  "Partly Abandoned": 0.6,
  Rebuilding: 0.6,
};

const PROSPERITY_CONDITION: Weights<Prosperity, Condition> = {
  Destitute: { Growing: 0.2, Stable: 0.5, Declining: 3, "Partly Abandoned": 3, Overcrowded: 1.5, Recovering: 1.2 },
  Poor: { Growing: 0.6, Declining: 2, "Partly Abandoned": 1.5, Recovering: 1.5 },
  Comfortable: { Growing: 1.5, Stable: 1.5, Declining: 0.5, "Partly Abandoned": 0.3 },
  Wealthy: { Growing: 2.5, Overcrowded: 1.3, Declining: 0.3, "Partly Abandoned": 0.15 },
  "Exceptionally Rich": { Growing: 3, Overcrowded: 1.5, Rebuilding: 0.5, Recovering: 0.3, Declining: 0.2, "Partly Abandoned": 0.1 },
};

const TONE_CONDITION: Weights<Tone, Condition> = {
  Peaceful: { Stable: 2.5, Declining: 0.6, "Partly Abandoned": 0.4 },
  Lively: { Growing: 2.5, Overcrowded: 2, "Partly Abandoned": 0.2 },
  Harsh: { Declining: 1.5, Recovering: 1.5, Rebuilding: 1.5, Growing: 0.6 },
  Grim: { Declining: 3, "Partly Abandoned": 3, Stable: 0.5, Growing: 0.2 },
  Mysterious: { "Partly Abandoned": 2.5, Declining: 1.5, Stable: 1.3 },
  Decadent: { Declining: 2, Overcrowded: 1.5, Stable: 1.2 },
  Oppressive: { Overcrowded: 2, Stable: 1.5, Rebuilding: 1.3 },
};

const TYPE_CONDITION: Weights<SettlementType, Condition> = {
  Homestead: { Overcrowded: 0.1 },
  Metropolis: { Overcrowded: 2, "Partly Abandoned": 0.3 },
  Encampment: { Growing: 2, Overcrowded: 2, Recovering: 0.5, "Partly Abandoned": 0.3, Rebuilding: 0.2 },
};

const GROWTH_CONDITION: Weights<Growth, Condition> = {
  "Boom and Bust": { Declining: 2, "Partly Abandoned": 2.5 },
  Migration: { Overcrowded: 2, Growing: 1.5 },
};

const AGE_CONDITION: Weights<Age, Condition> = {
  Recent: { Growing: 2, Recovering: 0.5, Declining: 0.4, "Partly Abandoned": 0.3, Rebuilding: 0.3 },
};

// ── Recent change ───────────────────────────────────────────────────────────

/** What the recent change can depend on: everything rolled before it. */
export type ChangeContext = Omit<SettlementContext, "recentChange">;

const has = (ctx: ChangeContext, ...purposes: Purpose[]) => purposes.some((p) => ctx.purposes.includes(p));
const mines = (ctx: ChangeContext) => has(ctx, "Mining") || ctx.founding === "Mineral Deposit";
const notHomestead = (ctx: ChangeContext) => ctx.type !== "Homestead";
/** Too few people for prisons, informers or a court. */
const beyondHamlet = (ctx: ChangeContext) => ctx.type !== "Homestead" && ctx.type !== "Hamlet";
const WATERSIDE: readonly Geography[] = ["Coast", "Riverbank", "Lake Shore", "Island", "River Delta", "Swamp", "Valley"];
const BRIDGED: readonly Geography[] = ["Riverbank", "River Delta", "Canyon", "Valley", "Swamp"];

const CHANGES: readonly Rule<RecentChange, ChangeContext>[] = [
  { key: "New Ruler", requires: notHomestead, by: { condition: { Rebuilding: 2, Stable: 1.2 }, tone: { Oppressive: 1.5 } } },
  {
    key: "Failed Harvest",
    requires: (c) => has(c, "Farming", "Herding"),
    by: { condition: { Declining: 2, Growing: 0.3 }, prosperity: { Destitute: 2, Poor: 2, "Exceptionally Rich": 0.3 }, tone: { Grim: 1.5 } },
  },
  { key: "Reopened Mine", requires: mines, weight: 1.5, by: { condition: { Recovering: 4, Growing: 2, Declining: 0.3, "Partly Abandoned": 0.5 } } },
  { key: "Exhausted Mine", requires: mines, weight: 1.5, by: { condition: { Declining: 5, "Partly Abandoned": 4, Growing: 0.1, Overcrowded: 0.2 } } },
  { key: "Destroyed Bridge", requires: (c) => BRIDGED.includes(c.geography) || c.founding === "Ford", by: { condition: { Rebuilding: 3, Declining: 1.5 } } },
  { key: "Refugees", by: { condition: { Overcrowded: 3, Growing: 1.5 }, purposes: { Refuge: 2 }, tone: { Grim: 1.3, Peaceful: 1.2 } } },
  { key: "Discovery", by: { condition: { Growing: 1.5 }, tone: { Mysterious: 3 }, purposes: { Scholarly: 2, Mining: 1.3 } } },
  {
    key: "Plague",
    by: {
      condition: { Overcrowded: 3, Declining: 1.5, "Partly Abandoned": 2 },
      prosperity: { Destitute: 2, Poor: 1.3 },
      tone: { Grim: 3, Peaceful: 0.5 },
      geography: { Swamp: 1.5, "River Delta": 1.3 },
    },
  },
  { key: "New Trade Route", requires: notHomestead, by: { condition: { Growing: 3, Recovering: 2, Declining: 0.3 }, purposes: { Trade: 1.5, Port: 1.3 } } },
  { key: "Lost Trade Route", requires: notHomestead, by: { condition: { Declining: 3, "Partly Abandoned": 2, Growing: 0.2 }, purposes: { Trade: 1.5, Port: 1.3 } } },
  {
    key: "Monsters",
    by: {
      tone: { Grim: 1.5, Harsh: 1.5, Mysterious: 1.3 },
      geography: { Forest: 2, Swamp: 2, Mountains: 2, Underground: 2, Tundra: 2 },
      condition: { "Partly Abandoned": 1.5 },
    },
  },
  { key: "Schism", requires: notHomestead, weight: 0.5, by: { purposes: { Religious: 6 }, tone: { Oppressive: 1.5, Mysterious: 1.3 } } },
  { key: "Fire", by: { condition: { Rebuilding: 3, Overcrowded: 2 }, geography: { Forest: 1.5 } } },
  {
    key: "Flood",
    requires: (c) => WATERSIDE.includes(c.geography),
    by: { condition: { Rebuilding: 2, Recovering: 2 }, geography: { "River Delta": 2, Swamp: 1.5 } },
  },
  {
    key: "Raid",
    by: { condition: { Rebuilding: 1.5, Recovering: 1.5 }, tone: { Harsh: 2.5, Grim: 1.5, Peaceful: 0.3 }, geography: { Steppe: 2, Coast: 1.3 } },
  },
  { key: "Disappearances", weight: 0.6, by: { tone: { Mysterious: 6, Grim: 2.5, Lively: 0.3 } } },
  {
    key: "Crackdown",
    requires: beyondHamlet,
    weight: 0.6,
    by: { tone: { Oppressive: 6, Decadent: 1.5, Peaceful: 0.2 }, purposes: { Smuggling: 2, Military: 1.3 } },
  },
  {
    key: "Festival",
    weight: 0.5,
    by: {
      tone: { Lively: 5, Peaceful: 2, Decadent: 2, Grim: 0.2, Oppressive: 0.4 },
      condition: { Growing: 1.5, "Partly Abandoned": 0.3 },
      purposes: { Religious: 1.5, Leisure: 2 },
    },
  },
  {
    key: "Windfall",
    by: {
      condition: { Growing: 2, Recovering: 1.5, Declining: 0.4 },
      prosperity: { Wealthy: 2, "Exceptionally Rich": 2, Destitute: 0.3 },
      tone: { Grim: 0.3 },
    },
  },
  {
    key: "Eruption",
    requires: (c) => c.geography === "Volcanic",
    weight: 2,
    by: { condition: { "Partly Abandoned": 2, Rebuilding: 2, Recovering: 1.5 } },
  },
];

/** Rolls why, when and how the settlement came to be, and how it is doing now. */
export function rollOrigins(inputs: ResolvedInputs, purposes: Purposes, rng: Rng): Origins {
  const { founding, foundingDetail } = rollFounding(inputs, purposes, rng);
  const age = weightedPick(AGES.map((a) => [a, TYPE_AGE[inputs.type][a] * factor(FOUNDING_AGE, founding, a)] as const), rng);
  const growth = weightedPick(
    GROWTHS.map(
      (g) =>
        [
          g,
          GROWTH_BASE[g] *
            factor(FOUNDING_GROWTH, founding, g) *
            factor(AGE_GROWTH, age, g) *
            factor(TYPE_GROWTH, inputs.type, g) *
            factor(TONE_GROWTH, inputs.tone, g),
        ] as const
    ),
    rng
  );
  const condition = weightedPick(
    CONDITIONS.map(
      (c) =>
        [
          c,
          CONDITION_BASE[c] *
            factor(PROSPERITY_CONDITION, inputs.prosperity, c) *
            factor(TONE_CONDITION, inputs.tone, c) *
            factor(TYPE_CONDITION, inputs.type, c) *
            factor(GROWTH_CONDITION, growth, c) *
            factor(AGE_CONDITION, age, c),
        ] as const
    ),
    rng
  );
  const ctx: ChangeContext = { ...inputs, primary: purposes.primary, purposes: [purposes.primary, ...purposes.secondary], founding, foundingDetail, age, growth, condition };
  const recentChange = rollRule(CHANGES, ctx, rng);
  return { founding, foundingDetail, age, growth, condition, recentChange };
}

/** Whether a recent change could have happened here; exported for tests. */
export function changeAllowed(change: RecentChange, ctx: ChangeContext): boolean {
  return ruleAllowed(CHANGES, change, ctx);
}
