import type { Locale } from "../../../i18n/config";
import { activeSettings } from "../../../server/settings/active";
import type { Background, Gender } from "../options";
import { BACKGROUND_TABLES, COMMON_CLOTHES, type BackgroundTables } from "./backgrounds";
import { expand, type Rng, type Tables } from "./grammar";
import { SHARED_TABLES } from "./shared";
import { PT_BACKGROUND_TABLES, PT_COMMON_CLOTHES } from "./pt-BR/backgrounds";
import { PT_SHARED_TABLES } from "./pt-BR/shared";

export interface Backstory {
  /** What they wear. */
  appearance: string;
  /** What they want right now. */
  want: string;
  quirk: string;
  fear: string;
  secret: string;
}

/** One language's word tables. The backstory is written in a language when rolled, then kept as is. */
interface LocaleTables {
  appearance: string;
  shared: Tables & Record<"quirks" | "fears" | "secrets", readonly string[]>;
  common: Pick<BackgroundTables, "garment" | "accessory">;
  backgrounds: Record<Background, BackgroundTables>;
}

const LOCALE_TABLES: Record<Locale, LocaleTables> = {
  "en-US": { appearance: "Wears {garment}, {condition}, with {accessory}.", shared: SHARED_TABLES, common: COMMON_CLOTHES, backgrounds: BACKGROUND_TABLES },
  // pt-BR adjectives agree with "a roupa", so the condition reads apart from the garment.
  "pt-BR": { appearance: "Usa {garment}; a roupa está {condition}. Traz {accessory}.", shared: PT_SHARED_TABLES, common: PT_COMMON_CLOTHES, backgrounds: PT_BACKGROUND_TABLES },
};

/** The shared tables with a background's own entries merged in (or the common clothes without one). */
export function tablesFor(background: Background | null, locale: Locale = "en-US"): Tables {
  const { shared, common, backgrounds } = LOCALE_TABLES[locale];
  if (!background) return { ...shared, ...common };
  const own = backgrounds[background];
  return {
    ...shared,
    garment: own.garment,
    accessory: own.accessory,
    wants: own.wants,
    quirks: [...shared.quirks, ...own.quirks],
    fears: [...shared.fears, ...own.fears],
    secrets: [...shared.secrets, ...own.secrets],
  };
}

/** Rolls clothes, a current want, a quirk, a fear and a secret fitting the background, in the active language by default. */
export function generateBackstory(background: Background | null, gender: Gender, rng: Rng = Math.random, locale: Locale = activeSettings().language): Backstory {
  const tables = tablesFor(background, locale);
  const APPEARANCE = LOCALE_TABLES[locale].appearance;
  const roll = (template: string) => expand(template, tables, gender, rng);
  return {
    appearance: roll(APPEARANCE),
    want: roll("{wants}"),
    quirk: roll("{Quirks}"),
    fear: roll("{Fears}"),
    secret: roll("{secrets}"),
  };
}
