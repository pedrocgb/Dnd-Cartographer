import type { Background, Gender } from "../options";
import { BACKGROUND_TABLES, COMMON_CLOTHES } from "./backgrounds";
import { expand, type Rng, type Tables } from "./grammar";
import { SHARED_TABLES } from "./shared";

export interface Backstory {
  /** What they wear. */
  appearance: string;
  /** What they want right now. */
  want: string;
  quirk: string;
  fear: string;
  secret: string;
}

const APPEARANCE = "Wears {garment}, {condition}, with {accessory}.";

/** The shared tables with a background's own entries merged in (or the common clothes without one). */
export function tablesFor(background: Background | null): Tables {
  if (!background) return { ...SHARED_TABLES, ...COMMON_CLOTHES };
  const own = BACKGROUND_TABLES[background];
  return {
    ...SHARED_TABLES,
    garment: own.garment,
    accessory: own.accessory,
    wants: own.wants,
    quirks: [...SHARED_TABLES.quirks, ...own.quirks],
    fears: [...SHARED_TABLES.fears, ...own.fears],
    secrets: [...SHARED_TABLES.secrets, ...own.secrets],
  };
}

/** Rolls clothes, a current want, a quirk, a fear and a secret fitting the background. */
export function generateBackstory(background: Background | null, gender: Gender, rng: Rng = Math.random): Backstory {
  const tables = tablesFor(background);
  const roll = (template: string) => expand(template, tables, gender, rng);
  return {
    appearance: roll(APPEARANCE),
    want: roll("{wants}"),
    quirk: roll("{Quirks}"),
    fear: roll("{Fears}"),
    secret: roll("{secrets}"),
  };
}
