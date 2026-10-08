import type { Background } from "../../../options";
import type { BackgroundTables } from "../../backgrounds/types";
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
import { wayfarer } from "./wayfarer";

export { PT_COMMON_CLOTHES } from "./common";

/** pt-BR version of `BACKGROUND_TABLES` (see `../../backgrounds/types.ts` and `../shared.ts` for the writing rules). */
export const PT_BACKGROUND_TABLES: Record<Background, BackgroundTables> = {
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
