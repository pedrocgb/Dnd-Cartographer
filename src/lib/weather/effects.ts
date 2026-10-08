import type { GeographyTraits, TimeOfDay } from "./options";
import type { WeatherHour } from "./generate";

/** One hour's conditions, as the rules read them. */
export type Conditions = Pick<WeatherHour, "temp" | "cover" | "fog" | "precipitation" | "beaufort" | "timeOfDay"> & { low: number; high: number; underground: boolean };

/** A day-level effect and the stretches of hours [start, end) it holds for. */
export interface DayEffect {
  /** A `weather` message key (`effect.*`); days saved before codes hold the English text. */
  text: string;
  windows: [number, number][];
}

type Traits = Required<GeographyTraits>;

interface Rule {
  when: (w: Conditions, t: Traits) => boolean;
  text: string;
}

const MAX_EFFECTS = 3;
const NIGHT: ReadonlySet<TimeOfDay> = new Set(["Evening", "Night", "Midnight"]);
const clearSky = (w: Conditions) => !w.precipitation && !w.fog && w.cover === "clear";

/**
 * What the weather means at the table, most pressing first: danger, then
 * visibility and footing, then comfort and flavour. Underground places
 * only ever get the underground rules. Texts are `weather` message keys,
 * worded on display (see `weatherText`).
 */
const UNDERGROUND_RULES: Rule[] = [
  { when: () => true, text: "effect.sheltered" },
  { when: (_, t) => t.volcanic, text: "effect.sulfurBelow" },
  { when: (w) => w.temp <= 0, text: "effect.caveIce" },
];

const RULES: Rule[] = [
  // Danger
  { when: (w) => w.precipitation?.type === "snow" && w.beaufort >= 7, text: "effect.whiteout" },
  { when: (w) => !!w.precipitation?.thunder, text: "effect.lightning" },
  { when: (w) => w.precipitation?.type === "hail", text: "effect.hail" },
  { when: (w) => w.beaufort >= 8, text: "effect.gale" },
  { when: (w, t) => t.dusty && !w.precipitation && w.beaufort >= 6, text: "effect.sandstorm" },
  { when: (w) => w.temp >= 35, text: "effect.heat" },
  { when: (w) => w.temp <= -20, text: "effect.frostbite" },
  // Visibility and footing
  { when: (w) => w.fog === "fog" || w.fog === "ice fog", text: "effect.fog" },
  { when: (w) => w.fog === "mist", text: "effect.mist" },
  { when: (w) => w.precipitation?.type === "rain" && w.precipitation.intensity === "heavy", text: "effect.heavyRain" },
  { when: (w) => w.precipitation?.type === "rain" && w.precipitation.intensity !== "heavy", text: "effect.rain" },
  { when: (w) => w.precipitation?.type === "drizzle", text: "effect.drizzle" },
  { when: (w) => w.precipitation?.type === "sleet", text: "effect.sleet" },
  { when: (w) => w.precipitation?.type === "snow" && w.precipitation.intensity === "heavy" && w.beaufort < 7, text: "effect.deepSnow" },
  { when: (w) => w.precipitation?.type === "snow" && w.precipitation.intensity !== "heavy", text: "effect.freshSnow" },
  { when: (w) => !w.precipitation && w.low <= 0 && w.temp <= 2, text: "effect.frost" },
  { when: (w, t) => t.maritime >= 0.5 && w.beaufort >= 5, text: "effect.roughWater" },
  { when: (w) => w.beaufort >= 6 && w.beaufort < 8, text: "effect.strongWind" },
  // Comfort and flavour
  { when: (_, t) => t.volcanic, text: "effect.sulfur" },
  { when: (w) => w.temp >= 28 && w.temp < 35, text: "effect.hot" },
  { when: (w) => w.temp <= -5 && w.temp > -20, text: "effect.bitterCold" },
  { when: (w) => clearSky(w) && NIGHT.has(w.timeOfDay) && w.low < 10, text: "effect.clearNight" },
  { when: (w) => clearSky(w) && !NIGHT.has(w.timeOfDay) && w.timeOfDay !== "Dusk", text: "effect.clearDay" },
];

const PLEASANT = "effect.pleasant";

const rulesFor = (underground: boolean) => (underground ? UNDERGROUND_RULES : RULES);

/** The most pressing effects (at most three) of one hour. */
export function practicalEffects(w: Conditions, t: Traits): string[] {
  const texts = rulesFor(w.underground)
    .filter((r) => r.when(w, t))
    .map((r) => r.text);
  return (texts.length ? texts : [PLEASANT]).slice(0, MAX_EFFECTS);
}

/** The day's most pressing effects (at most three), each with the hours it holds for. */
export function dayEffects(hours: readonly WeatherHour[], low: number, high: number, t: Traits): DayEffect[] {
  const out: DayEffect[] = [];
  for (const rule of rulesFor(t.underground)) {
    const windows: [number, number][] = [];
    for (const h of hours) {
      if (!rule.when({ ...h, low, high, underground: t.underground }, t)) continue;
      const last = windows[windows.length - 1];
      if (last && last[1] === h.hour) last[1] = h.hour + 1;
      else windows.push([h.hour, h.hour + 1]);
    }
    if (windows.length) out.push({ text: rule.text, windows });
    if (out.length === MAX_EFFECTS) break;
  }
  return out.length ? out : [{ text: PLEASANT, windows: [[0, 24]] }];
}
