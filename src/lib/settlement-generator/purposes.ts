import { randInt, weightedPick, type Rng } from "../random";
import type { ResolvedInputs } from "./inputs";
import { PURPOSES, type Geography, type Prosperity, type Purpose, type ResolvedClimate, type SettlementType, type Tone } from "./options";
import { factor, type Weights } from "./weights";

export interface Purposes {
  primary: Purpose;
  secondary: Purpose[];
}

const BASE: Record<Purpose, number> = {
  Farming: 2.5,
  Herding: 1.5,
  Fishing: 1,
  Mining: 1,
  Logging: 1,
  Hunting: 0.8,
  Trade: 2,
  Port: 0.6,
  Military: 1,
  Religious: 1,
  Scholarly: 0.4,
  Crafting: 1.2,
  Administrative: 0.5,
  Refuge: 0.4,
  Smuggling: 0.3,
  Leisure: 0.3,
};

/** Port 0 away from navigable water. */
const GEOGRAPHY_PURPOSE: Weights<Geography, Purpose> = {
  Coast: { Fishing: 10, Port: 7, Smuggling: 3, Trade: 1.5, Farming: 0.4, Herding: 0.4, Logging: 0.3, Hunting: 0.3, Mining: 0.2 },
  Riverbank: { Fishing: 2.5, Port: 2, Trade: 2, Farming: 1.5, Crafting: 1.3 },
  "Lake Shore": { Fishing: 6, Leisure: 2, Port: 1.5 },
  Plains: { Farming: 2.5, Herding: 2, Trade: 1.3, Mining: 0.2, Logging: 0.2, Fishing: 0.1, Port: 0 },
  Hills: { Herding: 2.5, Mining: 2, Military: 1.3, Fishing: 0.1, Port: 0 },
  Mountains: { Mining: 6, Military: 2, Herding: 1.3, Religious: 1.3, Farming: 0.3, Fishing: 0.1, Port: 0 },
  Island: { Fishing: 10, Port: 5, Smuggling: 3, Trade: 1.3, Herding: 0.6, Farming: 0.5, Logging: 0.4, Mining: 0.4 },
  Underground: {
    Mining: 6, Crafting: 3, Refuge: 3, Smuggling: 2, Religious: 1.5, Military: 1.5,
    Farming: 0.1, Herding: 0.2, Fishing: 0.2, Hunting: 0.4, Leisure: 0.5, Logging: 0, Port: 0,
  },
  Forest: { Logging: 6, Hunting: 4, Religious: 1.2, Farming: 0.6, Mining: 0.4, Fishing: 0.3, Port: 0 },
  Swamp: {
    Refuge: 3, Hunting: 2.5, Smuggling: 2.5, Fishing: 2, Religious: 1.3,
    Farming: 0.4, Herding: 0.4, Logging: 0.5, Military: 0.5, Port: 0.2, Mining: 0.1,
  },
  Desert: { Trade: 3, Mining: 2, Religious: 1.5, Military: 1.3, Herding: 1.2, Farming: 0.1, Fishing: 0, Port: 0, Logging: 0 },
  Valley: { Farming: 3, Herding: 1.8, Religious: 1.2, Fishing: 0.4, Port: 0 },
  "River Delta": { Fishing: 5, Port: 4, Farming: 3, Trade: 2.5, Smuggling: 1.5, Mining: 0.1, Logging: 0.5 },
  Canyon: { Mining: 3, Military: 2, Refuge: 2, Smuggling: 1.5, Farming: 0.3, Fishing: 0.2, Logging: 0.2, Port: 0 },
  Volcanic: { Mining: 4, Religious: 2.5, Crafting: 2, Scholarly: 1.5, Farming: 0.8, Fishing: 0.3, Port: 0 },
  Tundra: { Hunting: 5, Herding: 2.5, Fishing: 1.5, Logging: 0.3, Port: 0.3, Leisure: 0.2, Farming: 0.05 },
  Oasis: { Trade: 5, Leisure: 2, Farming: 1.5, Religious: 1.3, Mining: 0.3, Fishing: 0, Port: 0, Logging: 0 },
  Steppe: { Herding: 5, Trade: 2, Hunting: 2, Military: 1.5, Farming: 0.4, Fishing: 0.1, Logging: 0.1, Port: 0 },
};

const CLIMATE_PURPOSE: Weights<ResolvedClimate, Purpose> = {
  Tropical: { Farming: 1.3, Fishing: 1.2, Logging: 1.3, Herding: 0.7 },
  Arid: { Trade: 1.5, Herding: 1.2, Farming: 0.4, Fishing: 0.6, Logging: 0.2 },
  Temperate: { Farming: 1.3 },
  Continental: { Logging: 1.3, Herding: 1.2 },
  Polar: { Hunting: 2.5, Fishing: 1.8, Logging: 0.4, Leisure: 0.3, Farming: 0.15 },
};

/** A homestead is one household's living; 0 rules out what it can't be. */
const TYPE_PURPOSE: Weights<SettlementType, Purpose> = {
  Homestead: {
    Farming: 2.5, Herding: 2, Hunting: 1.8, Fishing: 1.5, Logging: 1.5, Refuge: 1, Mining: 0.5, Religious: 0.3,
    Crafting: 0.2, Smuggling: 0.2, Scholarly: 0.1, Trade: 0, Port: 0, Military: 0, Administrative: 0, Leisure: 0,
  },
  Hamlet: { Farming: 2, Herding: 1.5, Trade: 0.4, Port: 0.2, Scholarly: 0.2, Leisure: 0.2, Administrative: 0 },
  Village: { Port: 0.6, Scholarly: 0.4, Administrative: 0.2 },
  Town: { Trade: 1.5, Crafting: 1.5, Farming: 0.7 },
  City: {
    Trade: 2.5, Crafting: 2, Administrative: 2, Scholarly: 2, Port: 1.5, Leisure: 1.5, Religious: 1.3,
    Refuge: 0.5, Logging: 0.3, Farming: 0.2, Herding: 0.2, Hunting: 0.1,
  },
  Metropolis: {
    Trade: 3, Administrative: 3, Scholarly: 2.5, Leisure: 2.5, Crafting: 2, Port: 2, Religious: 1.5,
    Fishing: 0.4, Mining: 0.4, Refuge: 0.2, Logging: 0.1, Farming: 0.05, Herding: 0.05, Hunting: 0,
  },
  Encampment: {
    Military: 4, Refuge: 4, Mining: 2, Logging: 2, Hunting: 2, Herding: 2, Trade: 1.5, Smuggling: 1.5, Religious: 1,
    Fishing: 0.8, Scholarly: 0.5, Leisure: 0.3, Crafting: 0.3, Port: 0.2, Farming: 0.1, Administrative: 0,
  },
};

const PROSPERITY_PURPOSE: Weights<Prosperity, Purpose> = {
  Destitute: { Refuge: 2.5, Farming: 1.2, Administrative: 0.5, Scholarly: 0.4, Leisure: 0.1 },
  Poor: { Farming: 1.3, Herding: 1.2, Leisure: 0.3 },
  Comfortable: { Trade: 1.3, Crafting: 1.2 },
  Wealthy: { Leisure: 2, Trade: 1.8, Administrative: 1.4, Scholarly: 1.4, Mining: 1.3, Refuge: 0.4 },
  "Exceptionally Rich": { Leisure: 3, Trade: 2.2, Administrative: 1.6, Scholarly: 1.6, Mining: 1.5, Farming: 0.6, Refuge: 0.2 },
};

const TONE_PURPOSE: Weights<Tone, Purpose> = {
  Peaceful: { Farming: 1.5, Religious: 1.3, Military: 0.4, Smuggling: 0.3 },
  Lively: { Trade: 2, Leisure: 2, Port: 1.4 },
  Harsh: { Military: 1.8, Mining: 1.4, Hunting: 1.4, Leisure: 0.3 },
  Grim: { Refuge: 1.8, Mining: 1.5, Military: 1.3, Leisure: 0.2 },
  Mysterious: { Scholarly: 2.5, Religious: 2, Smuggling: 1.5 },
  Decadent: { Leisure: 3.5, Smuggling: 2.5, Trade: 1.5 },
  Oppressive: { Military: 2.5, Administrative: 2, Mining: 1.4 },
};

/** Trades that grow up around the primary one. */
const AFFINITY: Weights<Purpose, Purpose> = {
  Farming: { Herding: 2.5, Trade: 1.2, Religious: 1.2 },
  Herding: { Farming: 2, Crafting: 1.5 },
  Fishing: { Port: 2, Trade: 1.5 },
  Mining: { Crafting: 3, Trade: 1.5, Military: 1.5 },
  Logging: { Crafting: 2.5, Hunting: 2, Trade: 1.2 },
  Hunting: { Logging: 2, Trade: 1.2, Herding: 1.2 },
  Trade: { Port: 2, Crafting: 2, Leisure: 1.5 },
  Port: { Trade: 3, Fishing: 2, Smuggling: 2 },
  Military: { Administrative: 2, Crafting: 1.5, Religious: 1.2 },
  Religious: { Scholarly: 2.5, Leisure: 1.5, Trade: 1.3 },
  Scholarly: { Religious: 2, Administrative: 1.5, Crafting: 1.3 },
  Crafting: { Trade: 2.5, Mining: 1.5 },
  Administrative: { Military: 2, Trade: 2, Scholarly: 1.5 },
  Refuge: { Farming: 1.5, Military: 1.5, Religious: 1.5 },
  Smuggling: { Port: 2.5, Trade: 2, Leisure: 2 },
  Leisure: { Trade: 2, Smuggling: 2, Religious: 1.2 },
};

/** How many secondary purposes, min and max. */
const SECONDARY_COUNT: Record<SettlementType, readonly [number, number]> = {
  Homestead: [0, 1],
  Hamlet: [0, 1],
  Village: [1, 2],
  Town: [1, 2],
  City: [2, 3],
  Metropolis: [3, 4],
  Encampment: [0, 1],
};

/** Raises the geography factors so the land, more than anything else, decides what people do. */
const GEOGRAPHY_SHARPNESS = 1.5;

export function purposeWeight(purpose: Purpose, inputs: ResolvedInputs): number {
  return (
    BASE[purpose] *
    factor(GEOGRAPHY_PURPOSE, inputs.geography, purpose) ** GEOGRAPHY_SHARPNESS *
    factor(CLIMATE_PURPOSE, inputs.climate, purpose) *
    factor(TYPE_PURPOSE, inputs.type, purpose) *
    factor(PROSPERITY_PURPOSE, inputs.prosperity, purpose) *
    factor(TONE_PURPOSE, inputs.tone, purpose)
  );
}

/** One primary purpose, then a few secondary ones that suit both the place and the primary. */
export function rollPurposes(inputs: ResolvedInputs, rng: Rng): Purposes {
  const weights = new Map(PURPOSES.map((p) => [p, purposeWeight(p, inputs)]));
  const primary = weightedPick([...weights], rng);
  const [min, max] = SECONDARY_COUNT[inputs.type];
  const secondary: Purpose[] = [];
  for (let n = randInt(min, max, rng); secondary.length < n; ) {
    const left = PURPOSES.filter((p) => p !== primary && !secondary.includes(p) && weights.get(p)! > 0);
    if (!left.length) break;
    secondary.push(weightedPick(left.map((p) => [p, weights.get(p)! * factor(AFFINITY, primary, p)] as const), rng));
  }
  return { primary, secondary };
}
