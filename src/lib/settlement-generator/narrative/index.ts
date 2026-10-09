import type { Locale } from "../../../i18n/config";
import { expand } from "../../character-on-demand/backstory/grammar";
import type { Rng } from "../../random";
import type { ResolvedInputs } from "../inputs";
import type { Origins } from "../origins";
import type { Purposes } from "../purposes";
import { EN_NARRATIVE } from "./en-US";
import { PT_NARRATIVE } from "./pt-BR";
import type { NarrativeLocale } from "./types";

export const NARRATIVES: Record<Locale, NarrativeLocale> = { "en-US": EN_NARRATIVE, "pt-BR": PT_NARRATIVE };

/** The table of a rolled value: `slotKey("detail", "Saint's Tomb")` is "detail_SaintsTomb". */
export const slotKey = (group: string, value: string) => `${group}_${value.replace(/\W/g, "")}`;

/** Stands in for the name while expanding, so a name is never read as a template. */
const NAME = "\u0001";

export interface SummaryParts {
  name: string;
  inputs: ResolvedInputs;
  purposes: Purposes;
  origins: Origins;
}

/**
 * A short paragraph tying the rolls together, in one language. Each template
 * slot (`{cond}`, `{geo}`…) draws from the table of the value that was rolled,
 * so the text always matches the facts.
 */
export function writeSummary({ name, inputs, purposes, origins }: SummaryParts, locale: Locale, rng: Rng): string {
  const { templates, masculineTypes, tables } = NARRATIVES[locale];
  // Founded among ruins and built over them: say it once.
  const age = origins.founding === "Ruins" && origins.age === "Built Over Ruins" ? "RuinsReused" : origins.age;
  const values: Record<string, string> = {
    cond: origins.condition,
    purpose: purposes.primary,
    type: inputs.type,
    geo: inputs.geography,
    detail: origins.foundingDetail,
    age,
    growth: origins.growth,
    change: origins.recentChange,
    prosperity: inputs.prosperity,
    tone: inputs.tone,
  };
  const slots = Object.fromEntries(Object.entries(values).map(([group, value]) => [group, tables[slotKey(group, value)]]));
  const all = { ...tables, ...slots, name: [NAME] };
  const gender = masculineTypes.includes(inputs.type) ? "Male" : "Female";
  return templates
    .map((t) => expand(t, all, gender, rng))
    .join(" ")
    .replaceAll(NAME, name);
}
