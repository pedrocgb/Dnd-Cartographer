import type { Climate as WeatherClimate, Geography as WeatherGeography } from "../weather/options";

/**
 * Options and rolled values of the Settlement Generator. Values are stored in
 * English and worded on display (see labels.ts).
 */

/** The Settlement article's Settlement Type options, minus "Other". */
export const SETTLEMENT_TYPES = ["Homestead", "Hamlet", "Village", "Town", "City", "Metropolis", "Encampment"] as const;
export type SettlementType = (typeof SETTLEMENT_TYPES)[number];

export const GEOGRAPHIES = [
  "Coast",
  "Riverbank",
  "Lake Shore",
  "Plains",
  "Hills",
  "Mountains",
  "Island",
  "Underground",
  "Forest",
  "Swamp",
  "Desert",
  "Valley",
  "River Delta",
  "Canyon",
  "Volcanic",
  "Tundra",
  "Oasis",
  "Steppe",
] as const;
export type Geography = (typeof GEOGRAPHIES)[number];

export const CLIMATES = ["Tropical", "Arid", "Temperate", "Continental", "Polar"] as const;
export type Climate = (typeof CLIMATES)[number];
/** An underground settlement whose climate was left random lives apart from the sky's. */
export type ResolvedClimate = Climate | "Subterranean";

export const PROSPERITIES = ["Destitute", "Poor", "Modest", "Comfortable", "Wealthy", "Exceptionally Rich"] as const;
export type Prosperity = (typeof PROSPERITIES)[number];

export const TONES = ["Peaceful", "Lively", "Harsh", "Grim", "Mysterious", "Decadent", "Oppressive"] as const;
export type Tone = (typeof TONES)[number];

export type Choice<T> = T | "random";

export interface SettlementOptions {
  type: Choice<SettlementType>;
  geography: Choice<Geography>;
  climate: Choice<Climate>;
  prosperity: Choice<Prosperity>;
  tone: Choice<Tone>;
}

export const DEFAULT_OPTIONS: SettlementOptions = {
  type: "random",
  geography: "random",
  climate: "random",
  prosperity: "random",
  tone: "random",
};

export const PURPOSES = [
  "Farming",
  "Herding",
  "Fishing",
  "Mining",
  "Logging",
  "Hunting",
  "Trade",
  "Port",
  "Military",
  "Religious",
  "Scholarly",
  "Crafting",
  "Administrative",
  "Refuge",
  "Smuggling",
  "Leisure",
] as const;
export type Purpose = (typeof PURPOSES)[number];

export const FOUNDINGS = [
  "Ford",
  "Harbor",
  "Mineral Deposit",
  "Fertile Land",
  "Holy Site",
  "Fortress",
  "Crossroads",
  "Refuge",
  "Hunting Grounds",
  "Ruins",
  "Spring",
  "Decree",
] as const;
export type Founding = (typeof FOUNDINGS)[number];

export const AGES = ["Recent", "Generations", "Centuries", "Ancient", "Built Over Ruins"] as const;
export type Age = (typeof AGES)[number];

export const GROWTHS = ["Planned", "Gradual", "Migration", "Occupation", "Merged", "Boom and Bust"] as const;
export type Growth = (typeof GROWTHS)[number];

export const CONDITIONS = ["Growing", "Stable", "Declining", "Recovering", "Overcrowded", "Partly Abandoned", "Rebuilding"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const RECENT_CHANGES = [
  "New Ruler",
  "Failed Harvest",
  "Reopened Mine",
  "Exhausted Mine",
  "Destroyed Bridge",
  "Refugees",
  "Discovery",
  "Plague",
  "New Trade Route",
  "Lost Trade Route",
  "Monsters",
  "Schism",
  "Fire",
  "Flood",
  "Raid",
  "Disappearances",
  "Crackdown",
  "Festival",
  "Windfall",
  "Eruption",
] as const;
export type RecentChange = (typeof RECENT_CHANGES)[number];

/** The closest Weather Generator geography, for later links to the weather tools. */
export const WEATHER_GEOGRAPHY: Record<Geography, WeatherGeography> = {
  Coast: "Coastal",
  Riverbank: "Riverside",
  "Lake Shore": "Lakeside",
  Plains: "Plain",
  Hills: "Hill",
  Mountains: "Mountain",
  Island: "Island",
  Underground: "Cavern",
  Forest: "Forest",
  Swamp: "Swamp",
  Desert: "Desert",
  Valley: "Valley",
  "River Delta": "Delta",
  Canyon: "Canyon",
  Volcanic: "Volcano",
  Tundra: "Tundra",
  Oasis: "Oasis",
  Steppe: "Steppe",
};

/** The Weather Generator's climate; it calls Arid "Dry". */
export const WEATHER_CLIMATE: Record<Climate, WeatherClimate> = {
  Tropical: "Tropical",
  Arid: "Dry",
  Temperate: "Temperate",
  Continental: "Continental",
  Polar: "Polar",
};
