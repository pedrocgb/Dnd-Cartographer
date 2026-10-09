import { activeT } from "../../i18n/active";
import { MESSAGES, type MessageKey } from "../../i18n/messages";
import type { Translator } from "../../i18n/translate";

type T = Translator<"settlement">;

/** The groups of stored English values a generated settlement holds. */
export type LabelGroup = "type" | "geography" | "climate" | "prosperity" | "tone" | "purpose" | "founding" | "detail" | "age" | "growth" | "condition" | "change";

const known = (key: string): key is MessageKey<"settlement"> => Object.hasOwn(MESSAGES["en-US"].settlement, key);

/** A stored English value in the user's language; a value from an older list shows as stored. */
export function settlementLabel(group: LabelGroup, value: string, t: T = activeT("settlement")): string {
  const key = `${group}.${value}`;
  return known(key) ? t(key) : value;
}
