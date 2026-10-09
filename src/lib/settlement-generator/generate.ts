import type { Locale } from "../../i18n/config";
import { activeSettings } from "../../server/settings/active";
import type { Rng } from "../random";
import type { InputField, ResolvedInputs } from "./inputs";
import { pickName, type NamePool } from "./names";
import { writeSummary } from "./narrative";
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
 * Rolls a settlement from resolved inputs (see resolveInputs; the type's
 * names must be loaded for it). Everything follows from the inputs in order:
 * purposes, origins and condition, population, name, and a summary in the
 * active language by default. `avoid` holds names to steer clear of.
 */
export function generateSettlement(
  { inputs, randomized }: { inputs: ResolvedInputs; randomized: InputField[] },
  names: NamePool,
  rng: Rng = Math.random,
  locale: Locale = activeSettings().language,
  avoid: ReadonlySet<string> = new Set()
): GeneratedSettlement {
  const purposes = rollPurposes(inputs, rng);
  const origins = rollOrigins(inputs, purposes, rng);
  const population = rollPopulation(inputs, origins.condition, rng);
  const name = pickName(names, purposes, rng, avoid);
  const summary = writeSummary({ name, inputs, purposes, origins }, locale, rng);
  return { version: 1, inputs, randomized, name, population, purposes, origins, summary, locale };
}
