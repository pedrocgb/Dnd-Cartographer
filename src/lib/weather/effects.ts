import type { GeographyTraits, TimeOfDay } from "./options";
import type { WeatherHour } from "./generate";

/** One hour's conditions, as the rules read them. */
export type Conditions = Pick<WeatherHour, "temp" | "cover" | "fog" | "precipitation" | "beaufort" | "timeOfDay"> & { low: number; high: number; underground: boolean };

/** A day-level effect and the stretches of hours [start, end) it holds for. */
export interface DayEffect {
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
 * only ever get the underground rules.
 */
const UNDERGROUND_RULES: Rule[] = [
  { when: () => true, text: "Sheltered from the weather above; the air is still and the temperature barely changes" },
  { when: (_, t) => t.volcanic, text: "A faint smell of sulfur drifts up from below" },
  { when: (w) => w.temp <= 0, text: "Ice coats the cave walls and the floor is treacherous" },
];

const RULES: Rule[] = [
  // Danger
  { when: (w) => w.precipitation?.type === "snow" && w.beaufort >= 7, text: "Visibility near zero; travelling without shelter is life-threatening" },
  { when: (w) => !!w.precipitation?.thunder, text: "Lightning makes high ground, lone trees and metal armour dangerous" },
  { when: (w) => w.precipitation?.type === "hail", text: "Hailstones can injure the unprotected, spook animals and ruin crops" },
  { when: (w) => w.beaufort >= 8, text: "Gale-force winds knock riders off balance, ground flyers and make ranged attacks nearly useless" },
  { when: (w, t) => t.dusty && !w.precipitation && w.beaufort >= 6, text: "Blowing sand and dust sting the eyes and swallow the horizon" },
  { when: (w) => w.temp >= 35, text: "Heat exhaustion is a real risk; travellers need twice the water" },
  { when: (w) => w.temp <= -20, text: "Frostbite threatens exposed skin within minutes; a fire at night is essential" },
  // Visibility and footing
  { when: (w) => w.fog === "fog" || w.fog === "ice fog", text: "Visibility drops to a few dozen paces; easy to get lost or ambushed" },
  { when: (w) => w.fog === "mist", text: "A soft mist blurs distant landmarks and muffles sound" },
  { when: (w) => w.precipitation?.type === "rain" && w.precipitation.intensity === "heavy", text: "Roads turn to mud, streams rise and visibility drops to a few hundred paces" },
  { when: (w) => w.precipitation?.type === "rain" && w.precipitation.intensity !== "heavy", text: "Exposed paths turn muddy and distant landmarks are obscured" },
  { when: (w) => w.precipitation?.type === "drizzle", text: "Everything slowly gets damp; bowstrings and parchment need covering" },
  { when: (w) => w.precipitation?.type === "sleet", text: "Ice glazes roads and rigging; footing is treacherous" },
  { when: (w) => w.precipitation?.type === "snow" && w.precipitation.intensity === "heavy" && w.beaufort < 7, text: "Deep snow halves travel speed and buries tracks quickly" },
  { when: (w) => w.precipitation?.type === "snow" && w.precipitation.intensity !== "heavy", text: "Fresh snow shows every track clearly" },
  { when: (w) => !w.precipitation && w.low <= 0 && w.temp <= 2, text: "Puddles and ponds are frozen; frost makes stone slippery" },
  { when: (w, t) => t.maritime >= 0.5 && w.beaufort >= 5, text: "Rough water: sailing is slow and small boats should stay ashore" },
  { when: (w) => w.beaufort >= 6 && w.beaufort < 8, text: "Strong wind throws arrows off course and carries voices away" },
  // Comfort and flavour
  { when: (_, t) => t.volcanic, text: "A faint smell of sulfur hangs in the air" },
  { when: (w) => w.temp >= 28 && w.temp < 35, text: "Hot work: armour is stifling and rests in the shade are welcome" },
  { when: (w) => w.temp <= -5 && w.temp > -20, text: "Bitter cold: breath steams and fingers numb without gloves" },
  { when: (w) => clearSky(w) && NIGHT.has(w.timeOfDay) && w.low < 10, text: "Clear skies let the heat escape: a cold night, but good stargazing" },
  { when: (w) => clearSky(w) && !NIGHT.has(w.timeOfDay) && w.timeOfDay !== "Dusk", text: "Clear skies and long sight lines; distant landmarks are easy to spot" },
];

const PLEASANT = "Pleasant conditions for travel";

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
