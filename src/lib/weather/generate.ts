import { BEAUFORT, CLIMATE_NORMALS, annualMean } from "./climate";
import { dayEffects, practicalEffects, type DayEffect } from "./effects";
import {
  CLIMATES,
  CONVECTIVE_TIMES,
  DARK_TIMES,
  GEOGRAPHIES,
  GEOGRAPHY_NAMES,
  SEASONS,
  type Climate,
  type Geography,
  type GeographyTraits,
  type Season,
  type TimeOfDay,
  type WeatherOptions,
} from "./options";

export type Rng = () => number;

export type SkyCover = "clear" | "partly" | "mostly" | "overcast";
export type PrecipType = "drizzle" | "rain" | "sleet" | "snow" | "hail";
export type Intensity = "light" | "moderate" | "heavy";
/** What an hour looks like at a glance: the timeline's colour. */
export type Condition = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "sleet" | "storm" | "snow" | "dust" | "underground";

export interface Precipitation {
  type: PrecipType;
  intensity: Intensity;
  thunder: boolean;
}

export interface WeatherHour {
  /** 0–23: this reading covers hour:00 to hour:59. */
  hour: number;
  timeOfDay: TimeOfDay;
  /** °C. */
  temp: number;
  cover: SkyCover | null;
  fog: "fog" | "mist" | "ice fog" | null;
  precipitation: Precipitation | null;
  /** Beaufort number (0–12). */
  beaufort: number;
  /** km/h; gusts null when the air is (nearly) still. */
  windKmh: number;
  gustKmh: number | null;
  /** An English compass point or "Variable", worded on display. */
  direction: string;
  /** The Beaufort name in English; the display words `beaufort` instead. */
  windForce: string;
  /**
   * `sky`, `precipitationLabel`, `label` and `effects` are `weather` message
   * keys (`sky.*`, `precip.*`, `effect.*`), worded on display by `weatherText`.
   * Days saved before that hold English text, which is shown as stored.
   */
  sky: string;
  precipitationLabel: string;
  condition: Condition;
  /** What the timeline calls this hour; neighbouring hours with the same label form one stretch. */
  label: string;
  effects: string[];
}

/** A stretch of hours [start, end) with the same weather. */
export interface Segment {
  start: number;
  end: number;
  condition: Condition;
  label: string;
}

export interface WeatherDay {
  climate: Climate;
  geography: Geography;
  season: Season;
  underground: boolean;
  /** °C: the day's low and high. */
  low: number;
  high: number;
  hours: WeatherHour[];
  segments: Segment[];
  effects: DayEffect[];
}

/** Which part of the day each hour belongs to. */
export const HOUR_TIMES: readonly TimeOfDay[] = [
  "Midnight", "Night", "Night", "Night", "Night", "Dawn", "Sunrise",
  "Morning", "Morning", "Morning", "Morning", "Noon", "Noon", "Noon",
  "Afternoon", "Afternoon", "Afternoon", "Afternoon", "Sunset", "Dusk",
  "Evening", "Evening", "Evening", "Night",
];

const DIRECTIONS = ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"];

const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)];
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
/** A standard normal roll (Box–Muller). */
const gauss = (rng: Rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
const round1 = (n: number) => Math.round(n * 10) / 10;

export function traitsOf(geography: Geography): Required<GeographyTraits> {
  return { elevation: 0, maritime: 0, wet: 1, diurnal: 1, wind: 1, fog: 1, funnel: false, underground: false, volcanic: false, dusty: false, ...GEOGRAPHIES[geography] };
}

/**
 * Where the day's temperature curve stands at an hour: 0 at its coldest
 * (around sunrise, 06:00), 1 at its warmest (mid-afternoon, 15:00).
 */
export function warmthAt(hour: number): number {
  if (hour >= 6 && hour <= 15) return (1 - Math.cos((Math.PI * (hour - 6)) / 9)) / 2;
  const sinceWarmest = (hour < 6 ? hour + 24 : hour) - 15;
  return (1 + Math.cos((Math.PI * sinceWarmest) / 15)) / 2;
}

/**
 * The chance a spell (of rain, of fog) starts in an hour, so that with
 * spells ending at `stop` per hour the weather spends `share` of its time in them.
 */
const startChance = (share: number, stop: number) => clamp((share * stop) / (1 - share), 0, 0.95);

function rollCover(clearChance: number, rng: Rng): SkyCover {
  const r = rng();
  if (r < clearChance) return "clear";
  const rest = (r - clearChance) / (1 - clearChance);
  return rest < 0.4 ? "partly" : rest < 0.7 ? "mostly" : "overcast";
}

const COVERS: SkyCover[] = ["clear", "partly", "mostly", "overcast"];
/** One step of cloud cover towards a target. */
const stepToward = (from: SkyCover, to: SkyCover): SkyCover => COVERS[COVERS.indexOf(from) + Math.sign(COVERS.indexOf(to) - COVERS.indexOf(from))];

/** Clouds keep the day's heat in at night and the sun out by day: the low-to-high gap shrinks. */
const COVER_RANGE: Record<SkyCover, number> = { clear: 1.15, partly: 1, mostly: 0.85, overcast: 0.7 };
const INTENSITIES: Intensity[] = ["light", "moderate", "heavy"];

/** A spell of rain or snow: its strength drifts, its kind is set when it starts. */
interface Spell {
  intensity: Intensity;
  drizzle: boolean;
  hail: boolean;
}

const shiftIntensity = (spell: Spell, step: number): Spell => ({ ...spell, intensity: INTENSITIES[clamp(INTENSITIES.indexOf(spell.intensity) + step, 0, 2)] });

function rollIntensity(climate: Climate, wet: number, rng: Rng): Intensity {
  const heavyBias = (climate === "Tropical" ? 0.15 : 0) + (wet > 1.4 ? 0.1 : 0);
  const r = rng();
  return r < 0.5 - heavyBias ? "light" : r < 0.85 - heavyBias / 2 ? "moderate" : "heavy";
}

/**
 * Rolls a whole day of weather, hour by hour, following real-world rules for
 * the climate, geography and season: temperatures from climate normals bent
 * by height and nearby water along a daily curve, rain and fog in spells that
 * last a few hours (more often when and where they belong), snow when the hour
 * is cold enough, wind on the Beaufort scale drifting from hour to hour, and
 * what it all means for travellers.
 */
export function generateWeatherDay(opts: WeatherOptions, rng: Rng = Math.random): WeatherDay {
  const climate = opts.climate === "random" ? pick(CLIMATES, rng) : opts.climate;
  const geography = opts.geography === "random" ? pick(GEOGRAPHY_NAMES, rng) : opts.geography;
  const season = opts.season === "random" ? pick(SEASONS, rng) : opts.season;
  const t = traitsOf(geography);
  const n = CLIMATE_NORMALS[climate][season];
  const clearChance = clamp(n.clear / Math.max(1, t.wet), 0.05, 0.95);

  // The day's character: wet days and dry days come in clusters, averaging out to the climate's rain.
  const wetDay = rng() < 0.45;
  const dayWet = wetDay ? 1.85 : 0.3;
  const dayCover: SkyCover = wetDay ? (rng() < 0.6 ? "overcast" : "mostly") : rollCover(clearChance, rng);

  // The day's low and high.
  let mean: number;
  let range: number;
  if (t.underground) {
    mean = annualMean(climate) + gauss(rng) * 1.5; // caves keep to the year's average, all day and all year
    range = 1 + rng();
  } else {
    mean = (n.high + n.low) / 2;
    mean += (annualMean(climate) - mean) * 0.3 * t.maritime; // the sea evens out the seasons
    mean += t.elevation + gauss(rng) * n.spread;
    range = (n.high - n.low) * t.diurnal * (1 - 0.35 * t.maritime) * COVER_RANGE[dayCover] * (0.85 + 0.3 * rng());
  }
  let low = round1(mean - range / 2);
  let high = round1(mean + range / 2);
  if (opts.minTemp !== null && opts.maxTemp !== null) [low, high] = [Math.min(opts.minTemp, opts.maxTemp), Math.max(opts.minTemp, opts.maxTemp)];
  else if (opts.minTemp !== null) [low, high] = [opts.minTemp, round1(opts.minTemp + range)];
  else if (opts.maxTemp !== null) [low, high] = [round1(opts.maxTemp - range), opts.maxTemp];

  const hours: WeatherHour[] = [];
  let spell: Spell | null = null;
  let fogSpell: "fog" | "mist" | null = null;
  let cover: SkyCover = dayCover;
  let windAnomaly = gauss(rng) * 1.1;
  let directionIndex = Math.floor(rng() * DIRECTIONS.length);

  for (let hour = 0; hour < 24; hour++) {
    const timeOfDay = HOUR_TIMES[hour];
    const dark = DARK_TIMES.has(timeOfDay);
    const convectiveNow = n.convective && CONVECTIVE_TIMES.has(timeOfDay);

    // Rain or snow: spells averaging about four hours, as often as the place and hour allow. The
    // climate's chance is for any given moment of a wet season; in real climates rain falls in
    // roughly a tenth to a quarter of all hours, so the share of hours is scaled down to match.
    let precipShare = n.precip * t.wet * dayWet * 0.6;
    if (n.convective) precipShare *= convectiveNow ? 1.4 : 0.75;
    if (climate === "Dry" && !dark) precipShare *= 0.5; // desert days: rising heat, but air too dry to rain
    precipShare = clamp(precipShare, 0, 0.85);
    if (t.underground) spell = null;
    else if (spell) {
      if (rng() < 0.25) spell = null;
      else if (rng() < 0.25) spell = shiftIntensity(spell, rng() < 0.5 ? -1 : 1);
    } else if (rng() < startChance(precipShare, 0.25)) {
      const intensity = rollIntensity(climate, t.wet, rng);
      spell = { intensity, drizzle: intensity === "light" && (t.maritime >= 0.5 || t.fog >= 1.4) && rng() < 0.5, hail: climate !== "Tropical" && rng() < 0.15 };
    }

    const warmth = warmthAt(hour);
    const temp = round1(clamp(low + warmth * (high - low) + gauss(rng) * 0.4 - (spell ? 1 : 0), low, high));

    let precipitation: Precipitation | null = null;
    if (spell) {
      const thunder = n.convective && temp >= 16 && rng() < (convectiveNow ? 0.45 : 0.12);
      const intensity = thunder && spell.intensity === "light" ? "moderate" : spell.intensity;
      let type: PrecipType = temp <= 0.5 ? "snow" : temp <= 2.5 ? "sleet" : "rain";
      if (type === "rain" && thunder && spell.hail) type = "hail";
      else if (type === "rain" && spell.drizzle && !thunder) type = "drizzle";
      precipitation = { type, intensity, thunder };
    }

    // Clouds drift slowly, a step at a time; rain needs a heavy sky and leaves one behind.
    if (precipitation) cover = "overcast";
    else if (hours[hour - 1]?.precipitation) cover = "mostly";
    else if (rng() < 0.15) cover = stepToward(cover, rollCover(clearChance, rng));

    // Fog: still, damp air, at night and early in the day; it burns off as the day warms.
    let fog: WeatherHour["fog"] = null;
    if (!t.underground && !precipitation) {
      const damp = n.precip * t.wet > 0.15 ? 1 : 0.3;
      const timing = dark || timeOfDay === "Sunrise" || timeOfDay === "Morning" ? 1 : 0.2;
      const fogShare = clamp(0.16 * t.fog * damp * timing, 0, 0.8);
      if (fogSpell && rng() < 0.35 + (1 - timing) * 0.4) fogSpell = null;
      else if (!fogSpell && rng() < startChance(fogShare, 0.35)) fogSpell = rng() < 0.5 ? "fog" : "mist";
      if (fogSpell) fog = temp <= -15 ? "ice fog" : fogSpell;
    } else fogSpell = null;

    // Wind: the hour's typical strength, plus a gust of chance that lingers from hour to hour.
    let windMean = n.wind * t.wind;
    if (precipitation?.thunder) windMean += 2;
    else if (precipitation?.intensity === "heavy") windMean += 1;
    if (convectiveNow) windMean += 0.4;
    if (dark && t.maritime < 0.5) windMean -= 0.5; // land winds die down at night
    windAnomaly = 0.75 * windAnomaly + gauss(rng) * 0.6;
    const stormy = precipitation?.thunder || precipitation?.intensity === "heavy";
    let beaufort = clamp(Math.round(windMean + windAnomaly), 0, stormy ? (climate === "Tropical" ? 12 : 11) : 8);
    if (fog) beaufort = Math.min(beaufort, 2);
    if (t.underground) beaufort = Math.min(beaufort, 1);
    const band = BEAUFORT[beaufort];
    const windKmh = Math.round(band.min + rng() * (band.max - band.min));
    let gustKmh: number | null = null;
    if (beaufort >= 2) {
      const factor = (t.funnel || t.wind < 0.8 ? 1.5 + rng() * 0.5 : 1.3 + rng() * 0.35) + (precipitation?.thunder ? 0.3 : 0);
      gustKmh = Math.max(windKmh + 5, Math.round(windKmh * factor));
    }
    if (rng() < 0.15) directionIndex = (directionIndex + (rng() < 0.5 ? 7 : 1)) % 8; // wind veers or backs a little

    const reading = {
      hour,
      timeOfDay,
      temp,
      cover: t.underground ? null : cover,
      fog,
      precipitation,
      beaufort,
      windKmh,
      gustKmh,
      direction: beaufort === 0 ? "Variable" : DIRECTIONS[directionIndex],
      windForce: band.force,
      underground: t.underground,
    };
    const sky = skyLabel(reading, t, dark);
    const precipitationLabel = precipLabel(precipitation, beaufort, t.underground);
    const condition = conditionOf(reading, t);
    hours.push({
      hour,
      timeOfDay,
      temp,
      cover: reading.cover,
      fog,
      precipitation,
      beaufort,
      windKmh,
      gustKmh,
      direction: reading.direction,
      windForce: band.force,
      sky,
      precipitationLabel,
      condition,
      label: precipitation ? precipitationLabel : condition === "clear" ? "sky.clear" : sky,
      effects: practicalEffects({ ...reading, low, high }, t),
    });
  }

  return { climate, geography, season, underground: t.underground, low, high, hours, segments: segmentsOf(hours), effects: dayEffects(hours, low, high, t) };
}

type Reading = Pick<WeatherHour, "cover" | "fog" | "precipitation" | "beaufort"> & { underground: boolean };

function conditionOf(w: Reading, t: Required<GeographyTraits>): Condition {
  const p = w.precipitation;
  if (w.underground) return "underground";
  if (p?.thunder || p?.type === "hail") return "storm";
  if (p?.type === "snow") return "snow";
  if (p?.type === "sleet") return "sleet";
  if (p?.type === "drizzle") return "drizzle";
  if (p) return "rain";
  if (w.fog) return "fog";
  if (t.dusty && w.beaufort >= 6) return "dust";
  if (w.cover === "clear") return "clear";
  return w.cover === "partly" ? "partly" : "cloudy";
}

function skyLabel(w: Reading, t: Required<GeographyTraits>, dark: boolean): string {
  if (w.underground) return "sky.underground";
  if (w.precipitation?.thunder) return "sky.thunderclouds";
  if (w.precipitation) return w.precipitation.type === "snow" && w.beaufort >= 7 ? "sky.whiteout" : "sky.overcast";
  if (w.fog) return w.fog === "ice fog" ? "sky.iceFog" : w.fog === "fog" ? "sky.fog" : "sky.mist";
  if (t.dusty && w.beaufort >= 8) return "sky.sandstorm";
  if (t.dusty && w.beaufort >= 6) return "sky.dustHaze";
  if (w.cover === "clear") return dark ? "sky.clearStarry" : "sky.clear";
  return `sky.${w.cover!}`;
}

function precipLabel(p: Precipitation | null, beaufort: number, underground: boolean): string {
  if (underground) return "precip.dripping";
  if (!p) return "precip.none";
  if (p.type === "snow" && beaufort >= 7) return "precip.blizzard";
  if (p.type === "hail") return "precip.hail";
  // Thunder needs warm air, so only rain carries it.
  return `precip.${p.type}.${p.intensity}${p.thunder ? ".thunder" : ""}`;
}

/** Neighbouring hours with the same label, merged into stretches. */
export function segmentsOf(hours: readonly Pick<WeatherHour, "hour" | "condition" | "label">[]): Segment[] {
  const segments: Segment[] = [];
  for (const h of hours) {
    const last = segments[segments.length - 1];
    if (last && last.label === h.label && last.condition === h.condition) last.end = h.hour + 1;
    else segments.push({ start: h.hour, end: h.hour + 1, condition: h.condition, label: h.label });
  }
  return segments;
}

/** "07:00" for 7; 24 is the end of the day. */
export const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
