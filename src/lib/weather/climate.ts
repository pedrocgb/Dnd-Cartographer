import type { Climate, Season } from "./options";

/**
 * Typical lowland day for each climate and season, in °C, loosely after
 * real-world normals of each Köppen group (e.g. Temperate ≈ western Europe,
 * Continental ≈ Moscow or Minnesota, Dry ≈ hot deserts).
 * - high/low: average daily maximum and minimum.
 * - spread: how far a given day strays from them (standard deviation).
 * - precip: chance that it is raining or snowing at a given moment.
 * - clear: chance of a clear sky when it isn't.
 * - wind: average wind on the Beaufort scale.
 * - convective: summer-style showers and thunderstorms that build in the afternoon.
 */
export interface ClimateNormal {
  high: number;
  low: number;
  spread: number;
  precip: number;
  clear: number;
  wind: number;
  convective: boolean;
}

type Normals = Record<Season, ClimateNormal>;

const TROPICAL: Normals = {
  Spring: { high: 31, low: 23, spread: 1.5, precip: 0.4, clear: 0.3, wind: 2.2, convective: true },
  Summer: { high: 32, low: 24, spread: 1.5, precip: 0.55, clear: 0.2, wind: 2.2, convective: true },
  Autumn: { high: 31, low: 23, spread: 1.5, precip: 0.45, clear: 0.25, wind: 2.2, convective: true },
  Winter: { high: 29, low: 20, spread: 2, precip: 0.15, clear: 0.5, wind: 2.5, convective: true },
};

const DRY: Normals = {
  Spring: { high: 30, low: 14, spread: 3, precip: 0.05, clear: 0.75, wind: 3, convective: false },
  Summer: { high: 40, low: 25, spread: 2.5, precip: 0.03, clear: 0.85, wind: 3, convective: false },
  Autumn: { high: 31, low: 16, spread: 3, precip: 0.05, clear: 0.75, wind: 2.8, convective: false },
  Winter: { high: 20, low: 5, spread: 3, precip: 0.08, clear: 0.65, wind: 3, convective: false },
};

const TEMPERATE: Normals = {
  Spring: { high: 16, low: 6, spread: 3.5, precip: 0.3, clear: 0.3, wind: 3, convective: false },
  Summer: { high: 25, low: 14, spread: 3.5, precip: 0.22, clear: 0.4, wind: 2.6, convective: true },
  Autumn: { high: 16, low: 8, spread: 3.5, precip: 0.35, clear: 0.25, wind: 3.2, convective: false },
  Winter: { high: 7, low: 1, spread: 3.5, precip: 0.35, clear: 0.2, wind: 3.5, convective: false },
};

const CONTINENTAL: Normals = {
  Spring: { high: 13, low: 2, spread: 4.5, precip: 0.25, clear: 0.35, wind: 3.2, convective: false },
  Summer: { high: 27, low: 15, spread: 3.5, precip: 0.25, clear: 0.4, wind: 2.6, convective: true },
  Autumn: { high: 12, low: 2, spread: 4.5, precip: 0.27, clear: 0.3, wind: 3.2, convective: false },
  Winter: { high: -6, low: -15, spread: 5, precip: 0.25, clear: 0.35, wind: 3.2, convective: false },
};

const POLAR: Normals = {
  Spring: { high: -9, low: -18, spread: 5, precip: 0.15, clear: 0.4, wind: 4, convective: false },
  Summer: { high: 6, low: 0, spread: 3, precip: 0.25, clear: 0.25, wind: 3.6, convective: false },
  Autumn: { high: -6, low: -14, spread: 5, precip: 0.22, clear: 0.3, wind: 4.2, convective: false },
  Winter: { high: -25, low: -34, spread: 6, precip: 0.12, clear: 0.45, wind: 4.4, convective: false },
};

export const CLIMATE_NORMALS: Record<Climate, Normals> = {
  Tropical: TROPICAL,
  Dry: DRY,
  Temperate: TEMPERATE,
  Continental: CONTINENTAL,
  Polar: POLAR,
};

/** The year's average temperature: what caves settle at, and what the sea pulls coasts towards. */
export function annualMean(climate: Climate): number {
  const seasons = Object.values(CLIMATE_NORMALS[climate]);
  return seasons.reduce((sum, s) => sum + (s.high + s.low) / 2, 0) / seasons.length;
}

/** Beaufort scale: name and speed band in km/h (0 is calm, 12 hurricane force). */
export const BEAUFORT = [
  { force: "Calm", min: 0, max: 1 },
  { force: "Light air", min: 1, max: 5 },
  { force: "Light breeze", min: 6, max: 11 },
  { force: "Gentle breeze", min: 12, max: 19 },
  { force: "Moderate breeze", min: 20, max: 28 },
  { force: "Fresh breeze", min: 29, max: 38 },
  { force: "Strong breeze", min: 39, max: 49 },
  { force: "Near gale", min: 50, max: 61 },
  { force: "Gale", min: 62, max: 74 },
  { force: "Strong gale", min: 75, max: 88 },
  { force: "Storm", min: 89, max: 102 },
  { force: "Violent storm", min: 103, max: 117 },
  { force: "Hurricane force", min: 118, max: 140 },
] as const;
