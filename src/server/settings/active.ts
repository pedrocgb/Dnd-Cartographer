import { DEFAULT_SETTINGS, type AppSettings } from "./settings";

/**
 * The settings formatting helpers (dayLabel, formatIsoDate…) read by default,
 * so their many call sites don't each thread the user's formats through.
 * SettingsProvider sets it while rendering, from settings loaded with the page
 * (server render and hydration agree). One user per app, so a module value is
 * enough; server-only code (API routes) passes formats explicitly instead.
 */
let active: AppSettings = DEFAULT_SETTINGS;

export function activeSettings(): AppSettings {
  return active;
}

export function setActiveSettings(settings: AppSettings) {
  active = settings;
}
