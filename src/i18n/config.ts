import { DEFAULT_SETTINGS, LANGUAGES, type Language } from "../server/settings/settings";

/** The UI follows the `language` app setting; en-US is the source text and the fallback. */
export const LOCALES = LANGUAGES;
export type Locale = Language;
export const DEFAULT_LOCALE: Locale = DEFAULT_SETTINGS.language;
