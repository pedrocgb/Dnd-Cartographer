/**
 * App-wide preferences: one JSON blob per world (`app_settings.data`).
 * Pure (no DB) so the client, the server and the tests share it.
 */

export const LANGUAGES = ["en-US", "pt-BR"] as const;
export type Language = (typeof LANGUAGES)[number];

export const UNIT_SYSTEMS = ["metric", "imperial"] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const TEMPERATURE_UNITS = ["celsius", "fahrenheit"] as const;
export type TemperatureUnit = (typeof TEMPERATURE_UNITS)[number];

/** Real-world date layouts; tokens: DD/D day, MM month number, MMMM month name, YYYY year. */
export const REAL_DATE_FORMATS = [
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY/MM/DD",
  "YYYY/DD/MM",
  "DD-MM-YYYY",
  "DD.MM.YYYY",
  "YYYY-MM-DD",
  "D MMMM YYYY",
  "MMMM D, YYYY",
] as const;
export type RealDateFormat = (typeof REAL_DATE_FORMATS)[number];

/** Fantasy-calendar date layouts: named month ("Alder") or its number, in day/month/year order. */
export const WORLD_DATE_FORMATS = ["D MMMM YYYY", "MMMM D, YYYY", "YYYY, D MMMM", "YYYY, MMMM D", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY/MM/DD"] as const;
export type WorldDateFormat = (typeof WORLD_DATE_FORMATS)[number];

/**
 * How numbers the app writes are grouped and split: comma 1,000,000.23 ·
 * point 1.000.000,23 · space 1 000 000,23 (the international style).
 */
export const NUMBER_FORMATS = ["comma", "point", "space"] as const;
export type NumberFormat = (typeof NUMBER_FORMATS)[number];

export const TRASH_RETENTION_DAYS = [7, 30, 90] as const;
/** null: never auto-delete. */
export type TrashRetention = (typeof TRASH_RETENTION_DAYS)[number] | null;

export interface AppSettings {
  /** Stored only: the UI isn't translated yet. */
  language: Language;
  weightSystem: UnitSystem;
  /** Lengths and distances. */
  lengthSystem: UnitSystem;
  temperatureUnit: TemperatureUnit;
  realDateFormat: RealDateFormat;
  worldDateFormat: WorldDateFormat;
  /** Numbers the app writes (areas, distances, totals); what the user types stays as written. */
  numberFormat: NumberFormat;
  trashRetentionDays: TrashRetention;
  /** The current in-world date (default calendar) in the middle of the top bar. */
  showWorldDate: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "en-US",
  weightSystem: "metric",
  lengthSystem: "metric",
  temperatureUnit: "celsius",
  realDateFormat: "DD/MM/YYYY",
  worldDateFormat: "D MMMM YYYY",
  numberFormat: "comma",
  trashRetentionDays: null,
  showWorldDate: false,
};

const oneOf = <T,>(values: readonly T[], value: unknown): value is T => values.includes(value as T);

const VALIDATORS: { [K in keyof AppSettings]: (value: unknown) => value is AppSettings[K] } = {
  language: (v): v is Language => oneOf(LANGUAGES, v),
  weightSystem: (v): v is UnitSystem => oneOf(UNIT_SYSTEMS, v),
  lengthSystem: (v): v is UnitSystem => oneOf(UNIT_SYSTEMS, v),
  temperatureUnit: (v): v is TemperatureUnit => oneOf(TEMPERATURE_UNITS, v),
  realDateFormat: (v): v is RealDateFormat => oneOf(REAL_DATE_FORMATS, v),
  worldDateFormat: (v): v is WorldDateFormat => oneOf(WORLD_DATE_FORMATS, v),
  numberFormat: (v): v is NumberFormat => oneOf(NUMBER_FORMATS, v),
  trashRetentionDays: (v): v is TrashRetention => v === null || oneOf(TRASH_RETENTION_DAYS, v),
  showWorldDate: (v): v is boolean => typeof v === "boolean",
};

const KEYS = Object.keys(VALIDATORS) as (keyof AppSettings)[];

/** A PATCH body's known, valid keys; `error` names the first invalid one. Unknown keys are ignored. */
export function sanitizeSettingsPatch(body: unknown): { patch: Partial<AppSettings> } | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid request body." };
  const patch: Record<string, unknown> = {};
  for (const key of KEYS) {
    if (!(key in body)) continue;
    const value = (body as Record<string, unknown>)[key];
    if (!VALIDATORS[key](value)) return { error: `Invalid value for ${key}.` };
    patch[key] = value;
  }
  return { patch: patch as Partial<AppSettings> };
}

/** Stored values over the defaults; invalid or unknown stored values are dropped. */
export function parseStoredSettings(stored: unknown): AppSettings {
  const settings: AppSettings = { ...DEFAULT_SETTINGS };
  if (stored && typeof stored === "object") {
    for (const key of KEYS) {
      const value = (stored as Record<string, unknown>)[key];
      if (VALIDATORS[key](value)) (settings as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return settings;
}
