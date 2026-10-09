import type { Rng } from "../random";
import type { ResolvedInputs } from "./inputs";
import type { Condition, Geography, Prosperity, ResolvedClimate, SettlementType } from "./options";

/** Fewest and most people for each type; a rolled population never leaves its band. */
export const POPULATION_BANDS: Record<SettlementType, readonly [number, number]> = {
  Homestead: [3, 30],
  Encampment: [15, 800],
  Hamlet: [30, 150],
  Village: [150, 1_000],
  Town: [1_000, 8_000],
  City: [8_000, 40_000],
  Metropolis: [40_000, 200_000],
};

// Shifts of the percentile inside the band (0 = bottom, 1 = top).
const PROSPERITY_SHIFT: Record<Prosperity, number> = {
  Destitute: -0.25,
  Poor: -0.12,
  Modest: 0,
  Comfortable: 0.08,
  Wealthy: 0.14,
  "Exceptionally Rich": 0.2,
};
const CONDITION_SHIFT: Record<Condition, number> = {
  Growing: 0.1,
  Stable: 0,
  Declining: -0.15,
  Recovering: -0.1,
  Overcrowded: 0.3,
  "Partly Abandoned": -0.35,
  Rebuilding: -0.15,
};
const CLIMATE_SHIFT: Partial<Record<ResolvedClimate, number>> = { Polar: -0.2, Arid: -0.1, Temperate: 0.05 };
const GEOGRAPHY_SHIFT: Partial<Record<Geography, number>> = {
  Coast: 0.1,
  Riverbank: 0.1,
  "River Delta": 0.12,
  Plains: 0.05,
  Mountains: -0.1,
  Canyon: -0.1,
  Volcanic: -0.1,
  Swamp: -0.1,
  Desert: -0.15,
  Tundra: -0.2,
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Rounds like people would say it: exact under 200, then to the nearest 10, 50 or 500. */
export function roundPopulation(n: number): number {
  const step = n < 200 ? 1 : n < 1_000 ? 10 : n < 10_000 ? 50 : 500;
  return Math.round(n / step) * step;
}

/**
 * The population, on a log scale inside the type's band: prosperity,
 * condition, climate and geography move it up or down, noise does the rest.
 */
export function rollPopulation(inputs: ResolvedInputs, condition: Condition, rng: Rng): number {
  const [min, max] = POPULATION_BANDS[inputs.type];
  const noise = (rng() + rng() + rng()) / 3 - 0.5; // bell-shaped, -0.5..0.5
  const percentile = clamp(
    0.5 +
      PROSPERITY_SHIFT[inputs.prosperity] +
      CONDITION_SHIFT[condition] +
      (CLIMATE_SHIFT[inputs.climate] ?? 0) +
      (GEOGRAPHY_SHIFT[inputs.geography] ?? 0) +
      noise * 0.8,
    0.02,
    0.98
  );
  const raw = Math.exp(Math.log(min) + percentile * (Math.log(max) - Math.log(min)));
  return clamp(roundPopulation(raw), min, max);
}
