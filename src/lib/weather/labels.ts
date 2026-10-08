import { activeT } from "../../i18n/active";
import { MESSAGES, type MessageKey } from "../../i18n/messages";
import type { Translator } from "../../i18n/translate";

type Key = MessageKey<"weather">;
type T = Translator<"weather">;

const known = (key: string): key is Key => Object.hasOwn(MESSAGES["en-US"].weather, key);

/**
 * A stored weather text in the user's language: a message key (`sky.*`,
 * `precip.*`, `effect.*`) is worded; English text from a day saved before
 * codes is shown as stored.
 */
export function weatherText(value: string, t: T = activeT("weather")): string {
  return known(value) ? t(value) : value;
}

/** A stored English name (climate, season, geography, time of day, compass point) in the user's language. */
function named(group: string, value: string, t: T): string {
  const key = `${group}.${value}`;
  return known(key) ? t(key) : value;
}

export const climateLabel = (value: string, t: T = activeT("weather")) => named("climate", value, t);
export const seasonLabel = (value: string, t: T = activeT("weather")) => named("season", value, t);
export const geographyLabel = (value: string, t: T = activeT("weather")) => named("geography", value, t);
export const timeOfDayLabel = (value: string, t: T = activeT("weather")) => named("timeOfDay", value, t);
export const directionLabel = (value: string, t: T = activeT("weather")) => named("direction", value, t);
/** The Beaufort name of a force (0–12). */
export const beaufortLabel = (force: number, t: T = activeT("weather")) => named("beaufort", String(force), t);
