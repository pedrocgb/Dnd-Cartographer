import { activeT } from "../../i18n/active";
import { MESSAGES, type MessageKey } from "../../i18n/messages";
import type { Translator } from "../../i18n/translate";

type T = Translator<"character">;

const known = (key: string): key is MessageKey<"character"> => Object.hasOwn(MESSAGES["en-US"].character, key);

/**
 * A generated character's stored English value (gender, hairstyle, beard,
 * hair color) or species key in the user's language; a value from an older
 * list shows as stored.
 */
function named(group: string, value: string, t: T): string {
  const key = `${group}.${value}`;
  return known(key) ? t(key) : value;
}

export const genderLabel = (value: string, t: T = activeT("character")) => named("gender", value, t);
export const speciesLabel = (key: string, t: T = activeT("character")) => named("species", key, t);
export const beardLabel = (value: string, t: T = activeT("character")) => named("beard", value, t);

/** "Ponytail, auburn": the hairstyle and color as one line, empty without them. */
export function hairLabel(hairstyle: string | null, hairColor: string | null, t: T = activeT("character")): string {
  const style = hairstyle && named("hairstyle", hairstyle, t);
  const color = hairColor && (known(`hairColor.${hairColor}`) ? named("hairColor", hairColor, t) : hairColor.toLowerCase());
  return style && color ? t("hair.value", { style, color }) : (style || color || "");
}
