import type { Rng } from "../random";
import { resolveInputs, type InputField, type ResolvedInputs } from "./inputs";
import { pickName, type SettlementName } from "./names";
import type { SettlementOptions } from "./options";
import { rollOrigins, type Origins } from "./origins";
import { rollPopulation } from "./population";
import { rollPurposes, type Purposes } from "./purposes";

export interface GeneratedSettlement {
  /** Bumped when later steps change the shape, so old history entries can be told apart. */
  version: 1;
  inputs: ResolvedInputs;
  /** The inputs that were left random and rolled. */
  randomized: InputField[];
  name: string;
  population: number;
  purposes: Purposes;
  origins: Origins;
}

/**
 * Rolls a settlement. The inputs come first, then everything else follows
 * from them in order: purposes, origins and condition, population, name.
 */
export function generateSettlement(opts: SettlementOptions, names: readonly SettlementName[], rng: Rng = Math.random): GeneratedSettlement {
  const { inputs, randomized } = resolveInputs(opts, rng);
  const purposes = rollPurposes(inputs, rng);
  const origins = rollOrigins(inputs, purposes, rng);
  const population = rollPopulation(inputs, origins.condition, rng);
  const themes = [...Object.values(inputs), purposes.primary, ...purposes.secondary];
  return { version: 1, inputs, randomized, name: pickName(names, themes, rng), population, purposes, origins };
}
