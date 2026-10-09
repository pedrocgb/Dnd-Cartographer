import type { Locale } from "../../i18n/config";
import { activeSettings } from "../../server/settings/active";
import type { Rng } from "../random";
import { resolveInputs, type InputField, type ResolvedInputs } from "./inputs";
import { pickName, type SettlementName } from "./names";
import { writeSummary } from "./narrative";
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
  /** Written in `locale` when rolled, then kept as is. */
  summary: string;
  locale: Locale;
}

/**
 * Rolls a settlement. The inputs come first, then everything else follows
 * from them in order: purposes, origins and condition, population, name,
 * and a summary in the active language by default.
 */
export function generateSettlement(
  opts: SettlementOptions,
  names: readonly SettlementName[],
  rng: Rng = Math.random,
  locale: Locale = activeSettings().language
): GeneratedSettlement {
  const { inputs, randomized } = resolveInputs(opts, rng);
  const purposes = rollPurposes(inputs, rng);
  const origins = rollOrigins(inputs, purposes, rng);
  const population = rollPopulation(inputs, origins.condition, rng);
  const name = pickName(names, [...Object.values(inputs), purposes.primary, ...purposes.secondary], rng);
  const summary = writeSummary({ name, inputs, purposes, origins }, locale, rng);
  return { version: 1, inputs, randomized, name, population, purposes, origins, summary, locale };
}
