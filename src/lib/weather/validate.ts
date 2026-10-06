import { CLIMATES, GEOGRAPHIES, SEASONS, TIMES_OF_DAY } from "./options";
import { segmentsOf, type Condition, type Precipitation, type WeatherDay, type WeatherHour } from "./generate";
import type { DayEffect } from "./effects";

const CONDITIONS: readonly Condition[] = ["clear", "partly", "cloudy", "fog", "drizzle", "rain", "sleet", "storm", "snow", "dust", "underground"];
const COVERS = ["clear", "partly", "mostly", "overcast"] as const;
const FOGS = ["fog", "mist", "ice fog"] as const;
const PRECIP_TYPES = ["drizzle", "rain", "sleet", "snow", "hail"] as const;
const INTENSITIES = ["light", "moderate", "heavy"] as const;
const MAX_TEXT = 200;
const MAX_EFFECTS = 5;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= MAX_TEXT;
const oneOf = <T>(list: readonly T[], v: unknown): v is T => list.includes(v as T);
const texts = (v: unknown): v is string[] => Array.isArray(v) && v.length <= MAX_EFFECTS && v.every(text);

function readPrecipitation(v: unknown): Precipitation | null | undefined {
  if (v === null) return null;
  if (!isObj(v) || !oneOf(PRECIP_TYPES, v.type) || !oneOf(INTENSITIES, v.intensity) || typeof v.thunder !== "boolean") return undefined;
  return { type: v.type, intensity: v.intensity, thunder: v.thunder };
}

function readHour(v: unknown, hour: number): WeatherHour | null {
  if (!isObj(v) || v.hour !== hour || !oneOf(TIMES_OF_DAY, v.timeOfDay) || !num(v.temp, -100, 80)) return null;
  const precipitation = readPrecipitation(v.precipitation);
  if (precipitation === undefined) return null;
  if (!(v.cover === null || oneOf(COVERS, v.cover)) || !(v.fog === null || oneOf(FOGS, v.fog))) return null;
  if (!Number.isInteger(v.beaufort) || !num(v.beaufort, 0, 12) || !num(v.windKmh, 0, 200) || !(v.gustKmh === null || num(v.gustKmh, 0, 300))) return null;
  if (![v.direction, v.windForce, v.sky, v.precipitationLabel, v.label].every(text) || !oneOf(CONDITIONS, v.condition) || !texts(v.effects)) return null;
  return {
    hour,
    timeOfDay: v.timeOfDay,
    temp: v.temp as number,
    cover: v.cover as WeatherHour["cover"],
    fog: v.fog as WeatherHour["fog"],
    precipitation,
    beaufort: v.beaufort as number,
    windKmh: v.windKmh as number,
    gustKmh: v.gustKmh as number | null,
    direction: v.direction as string,
    windForce: v.windForce as string,
    sky: v.sky as string,
    precipitationLabel: v.precipitationLabel as string,
    condition: v.condition,
    label: v.label as string,
    effects: [...(v.effects as string[])],
  };
}

function readEffect(v: unknown): DayEffect | null {
  if (!isObj(v) || !text(v.text) || !Array.isArray(v.windows) || v.windows.length > 24) return null;
  const windows = v.windows.filter((w): w is [number, number] => Array.isArray(w) && w.length === 2 && Number.isInteger(w[0]) && Number.isInteger(w[1]) && w[0] >= 0 && w[0] < w[1] && w[1] <= 24);
  return windows.length === v.windows.length ? { text: v.text, windows: windows.map(([a, b]) => [a, b]) } : null;
}

/**
 * A generated day sent by a client, rebuilt field by field from what the
 * generator can produce (unknown keys dropped, segments recomputed); null
 * when anything is off. Keeps the stored JSON to the shape the app renders.
 */
export function readWeatherDay(raw: unknown): WeatherDay | null {
  if (!isObj(raw) || !oneOf(CLIMATES, raw.climate) || !oneOf(SEASONS, raw.season) || typeof raw.geography !== "string" || !Object.hasOwn(GEOGRAPHIES, raw.geography)) return null;
  if (typeof raw.underground !== "boolean" || !num(raw.low, -100, 80) || !num(raw.high, -100, 80) || (raw.low as number) > (raw.high as number)) return null;
  if (!Array.isArray(raw.hours) || raw.hours.length !== 24 || !Array.isArray(raw.effects) || raw.effects.length > MAX_EFFECTS) return null;
  const hours = raw.hours.map(readHour);
  const effects = raw.effects.map(readEffect);
  if (hours.some((h) => !h) || effects.some((e) => !e)) return null;
  const valid = hours as WeatherHour[];
  return {
    climate: raw.climate,
    geography: raw.geography,
    season: raw.season,
    underground: raw.underground,
    low: raw.low as number,
    high: raw.high as number,
    hours: valid,
    segments: segmentsOf(valid),
    effects: effects as DayEffect[],
  };
}
