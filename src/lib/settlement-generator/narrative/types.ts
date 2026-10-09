import type { Tables } from "../../character-on-demand/backstory/grammar";
import type { SettlementType } from "../options";

/** One language's summary: sentence templates over `{group}` slots, and the phrase tables they draw from. */
export interface NarrativeLocale {
  templates: readonly string[];
  /** Types whose noun is grammatically masculine; `{masc|fem}` agrees with it. */
  masculineTypes: readonly SettlementType[];
  tables: Tables;
}
