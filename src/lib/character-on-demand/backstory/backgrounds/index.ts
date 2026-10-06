import type { Background } from "../../options";
import { acolyte } from "./acolyte";
import { artisan } from "./artisan";
import { charlatan } from "./charlatan";
import { criminal } from "./criminal";
import { entertainer } from "./entertainer";
import { farmer } from "./farmer";
import { guard } from "./guard";
import { guide } from "./guide";
import { hermit } from "./hermit";
import { merchant } from "./merchant";
import { noble } from "./noble";
import { sage } from "./sage";
import { sailor } from "./sailor";
import { scribe } from "./scribe";
import { soldier } from "./soldier";
import type { BackgroundTables } from "./types";
import { wayfarer } from "./wayfarer";

export type { BackgroundTables };

/** Clothes for a character without a background. */
export const COMMON_CLOTHES: Pick<BackgroundTables, "garment" | "accessory"> = {
  garment: [
    "a plain linen shirt and wool trousers",
    "a hooded cloak over simple clothes",
    "a homespun tunic",
    "a leather jerkin",
    "a long coat with deep pockets",
    "a quilted vest over a loose shirt",
    "a hand-me-down coat with someone else's initials",
    "a knitted jumper and sturdy breeches",
    "a cloak dyed a cheerful yellow",
    "a patched travelling coat",
  ],
  accessory: [
    "a walking stick",
    "a battered satchel",
    "a knitted scarf",
    "a pair of mismatched gloves",
    "a wide-brimmed hat",
    "a belt pouch that jingles",
    "a carved wooden pendant",
    "a lucky ribbon tied at the wrist",
    "a pipe stuck in the hatband",
    "a small dog that follows at a distance",
  ],
};

export const BACKGROUND_TABLES: Record<Background, BackgroundTables> = {
  Acolyte: acolyte,
  Artisan: artisan,
  Charlatan: charlatan,
  Criminal: criminal,
  Entertainer: entertainer,
  Farmer: farmer,
  Guard: guard,
  Guide: guide,
  Hermit: hermit,
  Merchant: merchant,
  Noble: noble,
  Sage: sage,
  Sailor: sailor,
  Scribe: scribe,
  Soldier: soldier,
  Wayfarer: wayfarer,
};
