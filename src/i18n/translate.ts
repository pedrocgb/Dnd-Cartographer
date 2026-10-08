import { DEFAULT_LOCALE, type Locale } from "./config";
import { MESSAGES, type MessageKey, type Namespace } from "./messages";

export type TranslateParams = Record<string, string | number>;
export type Translator<N extends Namespace> = (key: MessageKey<N>, params?: TranslateParams) => string;

const pluralRules = new Map<Locale, Intl.PluralRules>();
function pluralCategory(locale: Locale, count: number): string {
  let rules = pluralRules.get(locale);
  if (!rules) pluralRules.set(locale, (rules = new Intl.PluralRules(locale)));
  return rules.select(count);
}

/**
 * The message for `key` in `locale`, falling back to en-US, then to the key
 * itself (a missing key shows up in the UI instead of crashing it).
 * `{name}` placeholders take `params`; a numeric `params.count` picks the
 * plural entry: `key_zero` (only for 0, when present), else `key_one` /
 * `key_other` by the locale's plural rules.
 */
export function translate<N extends Namespace>(locale: Locale, ns: N, key: MessageKey<N>, params?: TranslateParams): string {
  const dict = MESSAGES[locale]?.[ns] ?? {};
  const fallback = MESSAGES[DEFAULT_LOCALE][ns];
  const lookup = (k: string) => dict[k] ?? fallback[k];

  let template: string | undefined;
  const count = params?.count;
  if (typeof count === "number") {
    template = (count === 0 ? lookup(`${key}_zero`) : undefined) ?? lookup(`${key}_${pluralCategory(locale, count)}`) ?? lookup(`${key}_other`);
  }
  template ??= lookup(key) ?? key;

  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function createTranslator<N extends Namespace>(locale: Locale, ns: N): Translator<N> {
  return (key, params) => translate(locale, ns, key, params);
}
