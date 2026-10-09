import { weightedPick, type Rng } from "../random";
import {
  CLIMATES,
  GEOGRAPHIES,
  PROSPERITIES,
  SETTLEMENT_TYPES,
  TONES,
  type Climate,
  type Geography,
  type Prosperity,
  type ResolvedClimate,
  type SettlementOptions,
  type SettlementType,
  type Tone,
} from "./options";
import type { Weights } from "./weights";

export interface ResolvedInputs {
  type: SettlementType;
  geography: Geography;
  climate: ResolvedClimate;
  prosperity: Prosperity;
  tone: Tone;
}
export type InputField = keyof ResolvedInputs;

/** Resolution order: each random input is weighted by every input known before it. */
const ORDER: readonly InputField[] = ["type", "geography", "climate", "prosperity", "tone"];

const VALUES: Record<InputField, readonly string[]> = {
  type: SETTLEMENT_TYPES,
  geography: GEOGRAPHIES,
  climate: CLIMATES,
  prosperity: PROSPERITIES,
  tone: TONES,
};

/** How common each value is before the other inputs bend it (×1 when missing). */
const BASE: Record<InputField, Partial<Record<string, number>>> = {
  type: { Homestead: 1.5, Hamlet: 3, Village: 4, Town: 3, City: 1.5, Metropolis: 0.5, Encampment: 1 },
  geography: { Underground: 0.5, Volcanic: 0.5, Oasis: 0.6, Canyon: 0.7, Tundra: 0.7 },
  climate: { Temperate: 1.5, Polar: 0.6 },
  prosperity: { Destitute: 1, Poor: 3, Modest: 4, Comfortable: 3, Wealthy: 1.5, "Exceptionally Rich": 0.5 },
  tone: {},
};

const GEOGRAPHY_TYPE: Weights<Geography, SettlementType> = {
  Coast: { City: 1.5, Metropolis: 2 },
  Riverbank: { Town: 1.3, City: 1.5, Metropolis: 2 },
  "Lake Shore": { Town: 1.2, City: 1.2 },
  Plains: { Village: 1.3, Town: 1.2, City: 1.2 },
  Hills: { Hamlet: 1.3, Village: 1.2, City: 0.7, Metropolis: 0.4 },
  Mountains: { Homestead: 1.3, Hamlet: 1.3, Encampment: 1.3, City: 0.5, Metropolis: 0.2 },
  Island: { City: 0.8, Metropolis: 0.6 },
  Underground: { Homestead: 0.3, Hamlet: 0.6, Encampment: 1.5, Metropolis: 0.6 },
  Forest: { Homestead: 1.5, Hamlet: 1.5, City: 0.5, Metropolis: 0.2 },
  Swamp: { Homestead: 1.3, Hamlet: 1.5, Town: 0.6, City: 0.3, Metropolis: 0.1 },
  Desert: { Homestead: 0.5, Encampment: 3, City: 0.6, Metropolis: 0.3 },
  Valley: { Village: 1.4, Town: 1.2 },
  "River Delta": { Village: 1.2, City: 1.8, Metropolis: 2.5 },
  Canyon: { Hamlet: 1.3, Encampment: 1.5, City: 0.4, Metropolis: 0.15 },
  Volcanic: { Homestead: 0.6, Encampment: 2, City: 0.4, Metropolis: 0.15 },
  Tundra: { Homestead: 1.3, Encampment: 2.5, Town: 0.5, City: 0.2, Metropolis: 0.05 },
  Oasis: { Homestead: 0.4, Encampment: 2, Town: 1.3, City: 0.8, Metropolis: 0.4 },
  Steppe: { Homestead: 1.2, Encampment: 3, City: 0.5, Metropolis: 0.3 },
};

/** 0 rules a pair out when either side is random: no random oasis in a polar climate. */
const GEOGRAPHY_CLIMATE: Weights<Geography, Climate> = {
  Riverbank: { Polar: 0.4 },
  "Lake Shore": { Arid: 0.3 },
  Plains: { Polar: 0.4 },
  Hills: { Polar: 0.5 },
  Mountains: { Polar: 1.2 },
  Island: { Tropical: 1.5 },
  Forest: { Tropical: 2, Temperate: 1.5, Continental: 1.5, Arid: 0.05, Polar: 0.3 },
  Swamp: { Tropical: 2.5, Temperate: 1.5, Continental: 0.7, Arid: 0, Polar: 0.05 },
  Desert: { Arid: 5, Tropical: 0.5, Continental: 1, Temperate: 0, Polar: 0 },
  Valley: { Arid: 0.5, Polar: 0.5 },
  "River Delta": { Tropical: 1.5, Arid: 0.6, Polar: 0.1 },
  Canyon: { Arid: 2.5, Polar: 0.3 },
  Volcanic: { Polar: 0.6 },
  Tundra: { Polar: 6, Continental: 1, Tropical: 0, Arid: 0, Temperate: 0 },
  Oasis: { Arid: 3, Tropical: 0.3, Continental: 0.1, Temperate: 0, Polar: 0 },
  Steppe: { Continental: 3, Arid: 1.5, Temperate: 0.8, Tropical: 0.3, Polar: 0.4 },
};

const CLIMATE_TYPE: Weights<ResolvedClimate, SettlementType> = {
  Tropical: { Metropolis: 0.7 },
  Arid: { Encampment: 1.8, City: 0.7, Metropolis: 0.5 },
  Temperate: { Village: 1.2, Town: 1.2, City: 1.2, Metropolis: 1.3 },
  Polar: { Homestead: 1.3, Encampment: 1.8, Town: 0.6, City: 0.3, Metropolis: 0.1 },
};

const TYPE_PROSPERITY: Weights<SettlementType, Prosperity> = {
  Homestead: { Destitute: 1.2, Wealthy: 0.4, "Exceptionally Rich": 0.15 },
  Hamlet: { Wealthy: 0.6, "Exceptionally Rich": 0.25 },
  Village: { "Exceptionally Rich": 0.5 },
  City: { Comfortable: 1.3, Wealthy: 1.5, "Exceptionally Rich": 1.5 },
  Metropolis: { Destitute: 0.5, Comfortable: 1.3, Wealthy: 2, "Exceptionally Rich": 2.5 },
  Encampment: { Destitute: 2, Poor: 2, Comfortable: 0.6, Wealthy: 0.3, "Exceptionally Rich": 0.1 },
};

const WATERSIDE_WEALTH = { Destitute: 0.7, Comfortable: 1.3, Wealthy: 1.4, "Exceptionally Rich": 1.4 };
const BARREN_WEALTH = { Destitute: 1.6, Poor: 1.5, Wealthy: 0.6, "Exceptionally Rich": 0.4 };
const GEOGRAPHY_PROSPERITY: Weights<Geography, Prosperity> = {
  Coast: WATERSIDE_WEALTH,
  Riverbank: WATERSIDE_WEALTH,
  "River Delta": WATERSIDE_WEALTH,
  "Lake Shore": { Comfortable: 1.2 },
  Valley: { Comfortable: 1.2 },
  Plains: { Comfortable: 1.2 },
  Hills: { Poor: 1.2, Wealthy: 1.2 },
  Mountains: { Poor: 1.2, Wealthy: 1.2 },
  Desert: BARREN_WEALTH,
  Tundra: BARREN_WEALTH,
  Swamp: BARREN_WEALTH,
  Canyon: BARREN_WEALTH,
  Volcanic: { Destitute: 1.3, Poor: 1.3 },
  Oasis: { Wealthy: 1.3 },
  Steppe: { Poor: 1.3, Wealthy: 0.7 },
};

const CLIMATE_PROSPERITY: Weights<ResolvedClimate, Prosperity> = {
  Arid: { Poor: 1.3 },
  Temperate: { Comfortable: 1.2 },
  Polar: { Destitute: 1.5, Poor: 1.5, Wealthy: 0.6, "Exceptionally Rich": 0.4 },
};

const TONE_PROSPERITY: Weights<Tone, Prosperity> = {
  Peaceful: { Destitute: 0.4, Modest: 1.4, Comfortable: 1.6, Wealthy: 1.1 },
  Lively: { Destitute: 0.5, Comfortable: 1.5, Wealthy: 1.4 },
  Harsh: { Destitute: 1.8, Poor: 2, Comfortable: 0.6, Wealthy: 0.4, "Exceptionally Rich": 0.3 },
  Grim: { Destitute: 2.5, Poor: 2, Comfortable: 0.5, Wealthy: 0.4, "Exceptionally Rich": 0.3 },
  Decadent: { Destitute: 1.2, Poor: 0.6, Modest: 0.6, Wealthy: 2.5, "Exceptionally Rich": 3.5 },
  Oppressive: { Destitute: 1.3, Poor: 1.6, Wealthy: 1.2 },
};

const GEOGRAPHY_TONE: Weights<Geography, Tone> = {
  Coast: { Lively: 1.5 },
  Riverbank: { Lively: 1.3 },
  "Lake Shore": { Peaceful: 1.5 },
  Plains: { Peaceful: 1.3 },
  Hills: { Peaceful: 1.3 },
  Mountains: { Harsh: 1.8 },
  Island: { Peaceful: 1.3, Mysterious: 1.3 },
  Underground: { Mysterious: 2, Oppressive: 1.5, Lively: 0.6, Peaceful: 0.7 },
  Forest: { Mysterious: 1.8, Peaceful: 1.2 },
  Swamp: { Mysterious: 2.5, Grim: 2, Lively: 0.4, Decadent: 0.5 },
  Desert: { Harsh: 2.5, Lively: 0.6 },
  Valley: { Peaceful: 1.6 },
  "River Delta": { Lively: 1.4, Decadent: 1.3 },
  Canyon: { Harsh: 1.8, Mysterious: 1.4 },
  Volcanic: { Harsh: 2, Grim: 1.8, Peaceful: 0.4 },
  Tundra: { Harsh: 3, Grim: 1.5, Lively: 0.5, Decadent: 0.2 },
  Oasis: { Lively: 1.5, Decadent: 1.3 },
  Steppe: { Harsh: 2, Decadent: 0.4 },
};

const TYPE_TONE: Weights<SettlementType, Tone> = {
  Homestead: { Peaceful: 2, Lively: 0.5, Decadent: 0.1, Oppressive: 0.3 },
  Hamlet: { Peaceful: 1.6, Decadent: 0.3 },
  Village: { Peaceful: 1.3, Decadent: 0.5 },
  Town: { Lively: 1.2 },
  City: { Lively: 1.3, Decadent: 1.6, Oppressive: 1.4, Peaceful: 0.6 },
  Metropolis: { Lively: 1.5, Decadent: 2.5, Oppressive: 1.6, Peaceful: 0.4 },
  Encampment: { Harsh: 2.2, Grim: 1.4, Peaceful: 0.6, Decadent: 0.3 },
};

const CLIMATE_TONE: Weights<ResolvedClimate, Tone> = {
  Tropical: { Lively: 1.4, Decadent: 1.3 },
  Arid: { Harsh: 1.6 },
  Temperate: { Peaceful: 1.3 },
  Continental: { Harsh: 1.2 },
  Polar: { Harsh: 2.5, Grim: 1.4, Lively: 0.6, Decadent: 0.4 },
};

/** Each table bends both of its inputs: whichever one is rolled second. */
const PAIRS: readonly { a: InputField; b: InputField; table: Weights<string, string> }[] = [
  { a: "geography", b: "type", table: GEOGRAPHY_TYPE },
  { a: "geography", b: "climate", table: GEOGRAPHY_CLIMATE },
  { a: "climate", b: "type", table: CLIMATE_TYPE },
  { a: "type", b: "prosperity", table: TYPE_PROSPERITY },
  { a: "geography", b: "prosperity", table: GEOGRAPHY_PROSPERITY },
  { a: "climate", b: "prosperity", table: CLIMATE_PROSPERITY },
  { a: "tone", b: "prosperity", table: TONE_PROSPERITY },
  { a: "geography", b: "tone", table: GEOGRAPHY_TONE },
  { a: "type", b: "tone", table: TYPE_TONE },
  { a: "climate", b: "tone", table: CLIMATE_TONE },
];

/** The odds of `value` for `field`, given the inputs already known. */
export function inputWeight(field: InputField, value: string, known: Partial<ResolvedInputs>): number {
  let weight = BASE[field][value] ?? 1;
  for (const { a, b, table } of PAIRS) {
    const other = a === field ? known[b] : b === field ? known[a] : undefined;
    if (other === undefined) continue;
    weight *= (a === field ? table[value]?.[other] : table[other]?.[value]) ?? 1;
  }
  return weight;
}

/**
 * Turns the options into concrete inputs. Picked options are kept as they
 * are; random ones are rolled in ORDER, each weighted by everything known so
 * far (picked options count from the start). A random climate underground is
 * "Subterranean".
 */
export function resolveInputs(opts: SettlementOptions, rng: Rng): { inputs: ResolvedInputs; randomized: InputField[] } {
  const known: Partial<ResolvedInputs> = {};
  const randomized = ORDER.filter((field) => opts[field] === "random");
  for (const field of ORDER) if (opts[field] !== "random") Object.assign(known, { [field]: opts[field] });
  for (const field of randomized) {
    const value =
      field === "climate" && known.geography === "Underground"
        ? "Subterranean"
        : weightedPick(
            VALUES[field].map((v) => [v, inputWeight(field, v, known)] as const),
            rng
          );
    Object.assign(known, { [field]: value });
  }
  return { inputs: known as ResolvedInputs, randomized };
}
