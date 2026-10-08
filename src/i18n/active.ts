import { activeSettings } from "../server/settings/active";
import { createTranslator, type Translator } from "./translate";
import type { Namespace } from "./messages";

/**
 * `t()` for client helpers outside components (formatters, label lookups),
 * like the settings formatters: reads the language SettingsProvider set
 * while rendering. Components use `useT`; server code uses `serverT`.
 */
export function activeT<N extends Namespace>(ns: N): Translator<N> {
  return createTranslator(activeSettings().language, ns);
}
