import type { ScaleConfig, ScaleUnit } from "../scale/scale-config";

/**
 * Travel time over land, water and air (speeds and daily amounts after the
 * common tabletop travel tables). Pure: the Travel tool computes everything
 * on the client.
 *
 * RAW, a party on foot, mounted or in a land vehicle moves at its pace
 * (slow 2 / normal 3 / fast 4 mph, 8 hours a day); a mount's speed only
 * matters for a gallop (about an hour at twice the fast pace). Ships and
 * airships move at their own speed and, "depending on the vessel and the
 * size of the crew", up to 24 hours a day (the big crewed ships default to 24).
 * The optional "creature speed" houserule instead scales the pace by speed
 * (speed in feet ÷ 10 = mph at a normal pace, which is exact for 30 ft).
 */

export const PACES = ["slow", "normal", "fast"] as const;
export type Pace = (typeof PACES)[number];

export const PACE_MPH: Record<Pace, number> = { slow: 2, normal: 3, fast: 4 };

export type TravelGroup = "Land" | "Water" | "Air";

export interface TravelMode {
  key: string;
  label: string;
  group: TravelGroup;
  /** Pace-based (land) modes use the pace table; the others have a fixed speed. */
  fixedMph: number | null;
  /** Walking/flying speed in feet, for the creature-speed houserule. */
  speedFt: number | null;
  /** Can gallop (a riding animal). */
  mount: boolean;
  /** Hours a day it usually travels. */
  defaultHours: number;
  /** Ignores difficult terrain (on water or in the air). */
  ignoresTerrain: boolean;
  note?: string;
}

export const TRAVEL_MODES: readonly TravelMode[] = [
  { key: "foot", label: "On foot", group: "Land", fixedMph: null, speedFt: 30, mount: false, defaultHours: 8, ignoresTerrain: false },
  { key: "riding-horse", label: "Riding horse", group: "Land", fixedMph: null, speedFt: 60, mount: true, defaultHours: 8, ignoresTerrain: false },
  { key: "warhorse", label: "Warhorse", group: "Land", fixedMph: null, speedFt: 60, mount: true, defaultHours: 8, ignoresTerrain: false },
  { key: "pony", label: "Pony", group: "Land", fixedMph: null, speedFt: 40, mount: true, defaultHours: 8, ignoresTerrain: false },
  { key: "mule", label: "Donkey or mule", group: "Land", fixedMph: null, speedFt: 40, mount: true, defaultHours: 8, ignoresTerrain: false },
  { key: "camel", label: "Camel", group: "Land", fixedMph: null, speedFt: 50, mount: true, defaultHours: 8, ignoresTerrain: false },
  { key: "elephant", label: "Elephant", group: "Land", fixedMph: null, speedFt: 40, mount: true, defaultHours: 8, ignoresTerrain: false },
  { key: "wagon", label: "Cart, wagon or carriage", group: "Land", fixedMph: null, speedFt: 40, mount: false, defaultHours: 8, ignoresTerrain: false, note: "Drawn by draft horses (40 ft.); land vehicles choose a pace as normal." },
  { key: "rowboat", label: "Rowboat", group: "Water", fixedMph: 1.5, speedFt: null, mount: false, defaultHours: 8, ignoresTerrain: true },
  { key: "keelboat", label: "Keelboat", group: "Water", fixedMph: 1, speedFt: null, mount: false, defaultHours: 8, ignoresTerrain: true },
  { key: "longship", label: "Longship", group: "Water", fixedMph: 3, speedFt: null, mount: false, defaultHours: 24, ignoresTerrain: true },
  { key: "sailing-ship", label: "Sailing ship", group: "Water", fixedMph: 2, speedFt: null, mount: false, defaultHours: 24, ignoresTerrain: true },
  { key: "galley", label: "Galley", group: "Water", fixedMph: 4, speedFt: null, mount: false, defaultHours: 24, ignoresTerrain: true },
  { key: "warship", label: "Warship", group: "Water", fixedMph: 2.5, speedFt: null, mount: false, defaultHours: 24, ignoresTerrain: true },
  { key: "airship", label: "Airship", group: "Air", fixedMph: 8, speedFt: null, mount: false, defaultHours: 24, ignoresTerrain: true },
  { key: "flying-mount", label: "Flying mount", group: "Air", fixedMph: null, speedFt: 80, mount: true, defaultHours: 8, ignoresTerrain: true, note: "Set its fly speed below (uses the creature-speed rule)." },
  { key: "custom", label: "Custom speed", group: "Land", fixedMph: null, speedFt: null, mount: false, defaultHours: 8, ignoresTerrain: false },
];

export const modeOf = (key: string): TravelMode => TRAVEL_MODES.find((m) => m.key === key) ?? TRAVEL_MODES[0];

export interface TravelSettings {
  mode: string;
  pace: Pace;
  /** Houserule: scale the pace by the creature's speed instead of the fixed pace table. */
  useCreatureSpeed: boolean;
  /** Fly speed (flying mount) or walking speed override, in feet. */
  speedFt: number;
  /** "custom" mode: miles per hour. */
  customMph: number;
  hoursPerDay: number;
  /** A mounted gallop for one hour a day (twice the fast pace). */
  gallop: boolean;
  /** Share of the route that is difficult terrain (0..1): half speed there. */
  difficultShare: number;
  /** Water: current or wind, mph added to the ship's speed (negative against it). */
  currentMph: number;
  partySize: number;
  hotWeather: boolean;
  /** Miles in one "custom" map unit. */
  customUnitMiles: number;
}

export const DEFAULT_TRAVEL: TravelSettings = {
  mode: "foot",
  pace: "normal",
  useCreatureSpeed: false,
  speedFt: 80,
  customMph: 3,
  hoursPerDay: 8,
  gallop: false,
  difficultShare: 0,
  currentMph: 0,
  partySize: 4,
  hotWeather: false,
  customUnitMiles: 1,
};

const NUMBER_LIMITS: Record<"speedFt" | "customMph" | "hoursPerDay" | "difficultShare" | "currentMph" | "partySize" | "customUnitMiles", [number, number]> = {
  speedFt: [5, 300],
  customMph: [0.1, 500],
  hoursPerDay: [1, 24],
  difficultShare: [0, 1],
  currentMph: [-20, 20],
  partySize: [0, 1000],
  customUnitMiles: [0.0001, 100000],
};

/** Complete settings from untrusted JSON: every key validated (bad ones fall back to `base`). */
export function sanitizeTravelSettings(raw: unknown, base: TravelSettings = DEFAULT_TRAVEL): TravelSettings {
  const out: TravelSettings = { ...base };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.mode === "string" && TRAVEL_MODES.some((m) => m.key === r.mode)) out.mode = r.mode;
  if (typeof r.pace === "string" && (PACES as readonly string[]).includes(r.pace)) out.pace = r.pace as Pace;
  for (const key of ["useCreatureSpeed", "gallop", "hotWeather"] as const) if (typeof r[key] === "boolean") out[key] = r[key] as boolean;
  for (const [key, [min, max]] of Object.entries(NUMBER_LIMITS) as [keyof typeof NUMBER_LIMITS, [number, number]][]) {
    const v = r[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = Math.min(max, Math.max(min, v));
  }
  out.hoursPerDay = Math.round(out.hoursPerDay);
  out.partySize = Math.round(out.partySize);
  return out;
}

/** Miles in one unit of the map's calibration ("leagues" as the usual 3 miles). */
export const UNIT_MILES: Record<Exclude<ScaleUnit, "custom">, number> = {
  km: 0.621371,
  m: 0.000621371,
  mi: 1,
  ft: 1 / 5280,
  yd: 1 / 1760,
  leagues: 3,
};

export function unitToMiles(unit: ScaleUnit, settings: Pick<TravelSettings, "customUnitMiles">): number {
  return unit === "custom" ? settings.customUnitMiles : UNIT_MILES[unit];
}

/** Travel speed in mph on open ground, before terrain. */
export function baseMph(settings: TravelSettings): number {
  const mode = modeOf(settings.mode);
  if (mode.key === "custom") return Math.max(0, settings.customMph);
  if (mode.fixedMph !== null) return Math.max(0, mode.fixedMph + (mode.group === "Water" ? settings.currentMph : 0));
  const paceMph = PACE_MPH[settings.pace];
  const creatureSpeed = mode.key === "flying-mount" ? settings.speedFt : mode.speedFt;
  const houserule = settings.useCreatureSpeed || mode.key === "flying-mount";
  return houserule && creatureSpeed ? (paceMph * creatureSpeed) / 30 : paceMph;
}

export interface TravelPlan {
  miles: number;
  /** mph averaged over the route's terrain. */
  mph: number;
  milesPerDay: number;
  totalHours: number;
  /** Whole travel days, and the hours on the last (partial) one. */
  fullDays: number;
  extraHours: number;
  /** Days on the road, counting a partial last day. */
  daysOnRoad: number;
  /** Supplies for the whole party over the trip. */
  foodKg: number;
  waterL: number;
  gallopMiles: number;
}

const ONE_HOUR_GALLOP_MPH = PACE_MPH.fast * 2;
/** Per traveller per day: 1 lb of food and 1 gallon of water (doubled in hot weather). */
export const FOOD_KG_PER_DAY = 0.4536;
export const WATER_L_PER_DAY = 3.785;

/** The journey over `miles` with these settings; null when it can't move at all. */
export function planTravel(miles: number, settings: TravelSettings): TravelPlan | null {
  const mode = modeOf(settings.mode);
  const hours = Math.min(24, Math.max(1, Math.round(settings.hoursPerDay)));
  const open = baseMph(settings);
  if (!(open > 0) || !(miles >= 0)) return null;
  // Difficult terrain halves the speed over its share of the route.
  const difficult = mode.ignoresTerrain ? 0 : Math.min(1, Math.max(0, settings.difficultShare));
  const mph = open / (1 + difficult);
  // A gallop replaces one hour of the day at twice the fast pace (scaled like the rest by terrain).
  const gallop = mode.mount && mode.group !== "Air" && settings.gallop && !settings.useCreatureSpeed;
  const gallopMiles = gallop ? ONE_HOUR_GALLOP_MPH / (1 + difficult) : 0;
  const milesPerDay = gallop ? mph * (hours - 1) + gallopMiles : mph * hours;
  const days = milesPerDay > 0 ? miles / milesPerDay : 0;
  const fullDays = Math.floor(days + 1e-9);
  const lastDayMiles = Math.max(0, miles - fullDays * milesPerDay);
  const lastDayHours = () => {
    if (lastDayMiles <= 1e-9) return 0;
    if (!gallop) return lastDayMiles / mph;
    // The gallop hour comes first.
    return lastDayMiles <= gallopMiles ? lastDayMiles / gallopMiles : 1 + (lastDayMiles - gallopMiles) / mph;
  };
  const extraHours = Math.min(hours, lastDayHours());
  const totalHours = fullDays * hours + extraHours;
  const daysOnRoad = fullDays + (extraHours > 0 ? 1 : 0);
  const party = Math.max(0, Math.round(settings.partySize));
  return {
    miles,
    mph,
    milesPerDay,
    totalHours,
    fullDays,
    extraHours,
    daysOnRoad,
    foodKg: party * daysOnRoad * FOOD_KG_PER_DAY,
    waterL: party * daysOnRoad * WATER_L_PER_DAY * (settings.hotWeather ? 2 : 1),
    gallopMiles,
  };
}

/** "3 days 5 h", "6 h 30 min", "45 min". */
export function formatDuration(fullDays: number, extraHours: number): string {
  const parts: string[] = [];
  if (fullDays > 0) parts.push(`${fullDays} day${fullDays === 1 ? "" : "s"}`);
  const totalMinutes = Math.round(extraHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) parts.push(`${h} h`);
  if (m > 0 && fullDays === 0) parts.push(`${m} min`);
  return parts.join(" ") || "0 min";
}

/** Distance in miles expressed back in the map's unit. */
export function milesToUnit(miles: number, config: Pick<ScaleConfig, "unit">, settings: Pick<TravelSettings, "customUnitMiles">): number {
  return miles / unitToMiles(config.unit, settings);
}
