import { describe, it, expect } from "vitest";
import { generateWeatherDay, segmentsOf, warmthAt, type Rng, type WeatherDay, type WeatherHour } from "../src/lib/weather/generate";
import { DEFAULT_WEATHER_OPTIONS, GEOGRAPHY_NAMES, type WeatherOptions } from "../src/lib/weather/options";
import { BEAUFORT } from "../src/lib/weather/climate";
import { markAttached, parseWeatherHistory } from "../src/lib/weather/history";
import { readWeatherDay } from "../src/lib/weather/validate";
import { fromCelsius, fromKmh, toCelsius } from "../src/server/settings/units";
import { DEFAULT_SETTINGS, sanitizeSettingsPatch } from "../src/server/settings/settings";

/** A seeded generator (mulberry32), so the statistics below are the same on every run. */
function seeded(seed: number): Rng {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roll(overrides: Partial<WeatherOptions>, n = 400): WeatherDay[] {
  const rng = seeded(42);
  return Array.from({ length: n }, () => generateWeatherDay({ ...DEFAULT_WEATHER_OPTIONS, ...overrides }, rng));
}

const hoursOf = (days: WeatherDay[]) => days.flatMap((d) => d.hours);
const share = (hours: WeatherHour[], test: (h: WeatherHour) => boolean) => hours.filter(test).length / hours.length;
const at = (days: WeatherDay[], hour: number) => days.map((d) => d.hours[hour]);

describe("generateWeatherDay", () => {
  it("covers the whole day, hour by hour, in stretches without gaps", () => {
    for (const day of roll({ climate: "random", geography: "random", season: "random" }, 200)) {
      expect(day.hours.map((h) => h.hour)).toEqual([...Array(24).keys()]);
      expect(day.segments[0].start).toBe(0);
      expect(day.segments[day.segments.length - 1].end).toBe(24);
      for (let i = 1; i < day.segments.length; i++) expect(day.segments[i].start).toBe(day.segments[i - 1].end);
    }
  });

  it("hardly ever rains in a summer desert, and gets hot by afternoon", () => {
    const days = roll({ climate: "Dry", geography: "Desert", season: "Summer" });
    expect(share(hoursOf(days), (h) => h.precipitation !== null)).toBeLessThan(0.01);
    expect(share(at(days, 15), (h) => h.temp >= 35)).toBeGreaterThan(0.6);
  });

  it("is coldest around dawn and warmest in the afternoon", () => {
    const days = roll({ climate: "Temperate", geography: "Plain", season: "Summer" });
    const mean = (hour: number) => at(days, hour).reduce((s, h) => s + h.temp, 0) / days.length;
    expect(mean(15)).toBeGreaterThan(mean(6) + 5);
    expect(mean(6)).toBeLessThan(mean(0));
  });

  it("builds tropical storms in the afternoon rather than the morning", () => {
    const days = roll({ climate: "Tropical", geography: "Rainforest", season: "Summer" });
    const thunder = (hour: number) => share(at(days, hour), (h) => h.precipitation?.thunder === true);
    expect(thunder(15)).toBeGreaterThan(thunder(8) * 2);
  });

  it("brings fog at dawn and burns it off by afternoon", () => {
    const days = roll({ climate: "Temperate", geography: "Valley", season: "Autumn" }, 800);
    const fog = (hour: number) => share(at(days, hour), (h) => h.fog !== null);
    expect(fog(5)).toBeGreaterThan(fog(15) * 3);
  });

  it("rains in spells, not in scattered single hours", () => {
    const hours = hoursOf(roll({ climate: "Temperate", geography: "Coastal", season: "Autumn" }));
    const wet = hours.filter((h) => h.precipitation);
    const continued = wet.filter((h) => h.hour > 0 && hours[hours.indexOf(h) - 1].precipitation).length;
    expect(continued / wet.length).toBeGreaterThan(0.6);
  });

  it("never snows in the tropics and never rains in a polar winter", () => {
    expect(hoursOf(roll({ climate: "Tropical", geography: "random", season: "random" })).some((h) => h.precipitation?.type === "snow")).toBe(false);
    const polar = roll({ climate: "Polar", geography: "Plain", season: "Winter" });
    expect(hoursOf(polar).some((h) => h.precipitation?.type === "rain" || h.precipitation?.type === "drizzle")).toBe(false);
  });

  it("makes mountains colder than the plains below", () => {
    const meanHigh = (days: WeatherDay[]) => days.reduce((s, d) => s + d.high, 0) / days.length;
    const base = { climate: "Temperate", season: "Summer" } as const;
    expect(meanHigh(roll({ ...base, geography: "Mountain" }))).toBeLessThan(meanHigh(roll({ ...base, geography: "Plain" })) - 5);
  });

  it("keeps caves sheltered and steady", () => {
    for (const day of roll({ geography: "Cave", climate: "random", season: "random" }, 100)) {
      expect(day.high - day.low).toBeLessThan(2.5);
      for (const h of day.hours) {
        expect(h.precipitation).toBeNull();
        expect(h.beaufort).toBeLessThanOrEqual(1);
        expect(h.condition).toBe("underground");
      }
    }
  });

  it("respects the temperatures the user typed", () => {
    const [both] = roll({ minTemp: -3, maxTemp: 5 }, 1);
    expect([both.low, both.high]).toEqual([-3, 5]);
    const [onlyMin] = roll({ minTemp: 10 }, 1);
    expect(onlyMin.low).toBe(10);
    expect(onlyMin.high).toBeGreaterThan(10);
    const [onlyMax] = roll({ maxTemp: 0 }, 1);
    expect(onlyMax.high).toBe(0);
    expect(onlyMax.low).toBeLessThan(0);
  });

  it("keeps every hour consistent", () => {
    for (const day of roll({ climate: "random", geography: "random", season: "random" }, 300)) {
      for (const h of day.hours) {
        expect(h.temp).toBeGreaterThanOrEqual(day.low);
        expect(h.temp).toBeLessThanOrEqual(day.high);
        const band = BEAUFORT[h.beaufort];
        expect(h.windKmh).toBeGreaterThanOrEqual(band.min);
        expect(h.windKmh).toBeLessThanOrEqual(band.max);
        if (h.gustKmh !== null) expect(h.gustKmh).toBeGreaterThan(h.windKmh);
        if (h.fog) expect(h.beaufort).toBeLessThanOrEqual(2);
        if (h.beaufort === 0) expect(h.direction).toBe("Variable");
        if (h.precipitation?.type === "snow") expect(h.temp).toBeLessThanOrEqual(0.5);
        expect(h.effects.length).toBeGreaterThan(0);
        expect(h.effects.length).toBeLessThanOrEqual(3);
      }
      expect(day.effects.length).toBeGreaterThan(0);
      expect(day.effects.length).toBeLessThanOrEqual(3);
      expect(GEOGRAPHY_NAMES).toContain(day.geography);
    }
  });

  it("dates each day effect to the hours it holds for", () => {
    const day = roll({ climate: "Temperate", geography: "Coastal", season: "Autumn" }, 50).find((d) => d.hours.some((h) => h.precipitation?.type === "rain"))!;
    const muddy = day.effects.find((e) => e.text === "effect.rain" || e.text === "effect.heavyRain");
    if (muddy) for (const [start, end] of muddy.windows) for (let hour = start; hour < end; hour++) expect(day.hours[hour].precipitation?.type).toBe("rain");
  });
});

describe("weather helpers", () => {
  it("follows a daily temperature curve", () => {
    expect(warmthAt(6)).toBe(0);
    expect(warmthAt(15)).toBe(1);
    expect(warmthAt(12)).toBeGreaterThan(warmthAt(9));
    expect(warmthAt(22)).toBeLessThan(warmthAt(18));
  });

  it("merges neighbouring hours with the same weather", () => {
    const hours = [
      { hour: 0, condition: "clear", label: "Clear" },
      { hour: 1, condition: "clear", label: "Clear" },
      { hour: 2, condition: "rain", label: "Light rain" },
    ] as const;
    expect(segmentsOf(hours)).toEqual([
      { start: 0, end: 2, condition: "clear", label: "Clear" },
      { start: 2, end: 3, condition: "rain", label: "Light rain" },
    ]);
  });

  it("reads stored history, skipping anything malformed", () => {
    const [day] = roll({}, 1);
    expect(parseWeatherHistory(JSON.stringify([{ id: "a", createdAt: 1, day }]))).toHaveLength(1);
    expect(parseWeatherHistory(JSON.stringify([{ id: "a", createdAt: 1, day: { hours: [] } }]))).toEqual([]);
    expect(parseWeatherHistory("nope")).toEqual([]);
  });
});

describe("readWeatherDay", () => {
  const [day] = roll({ climate: "random", geography: "random", season: "random" }, 1);
  // A plain JSON copy: untyped on purpose, so the tests can write invalid values into it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const copy = (): any => JSON.parse(JSON.stringify(day));

  it("accepts any generated day as it is", () => {
    for (const d of roll({ climate: "random", geography: "random", season: "random" }, 100)) expect(readWeatherDay(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  it("drops unknown keys and recomputes the stretches", () => {
    const sent = { ...copy(), extra: "<script>", segments: [] };
    sent.hours[3].note = "x";
    const read = readWeatherDay(sent)!;
    expect(read).not.toHaveProperty("extra");
    expect(read.hours[3]).not.toHaveProperty("note");
    expect(read.segments).toEqual(day.segments);
  });

  it("rejects a tampered or incomplete day", () => {
    const tamper = (change: (d: ReturnType<typeof copy>) => void) => {
      const d = copy();
      change(d);
      return readWeatherDay(d);
    };
    expect(tamper((d) => d.hours.pop())).toBeNull();
    expect(tamper((d) => (d.climate = "Lava"))).toBeNull();
    expect(tamper((d) => (d.geography = "constructor"))).toBeNull();
    expect(tamper((d) => (d.hours[0].temp = 1e9))).toBeNull();
    expect(tamper((d) => (d.hours[5].sky = "x".repeat(500)))).toBeNull();
    expect(tamper((d) => (d.hours[2].hour = 7))).toBeNull();
    expect(tamper((d) => (d.effects = [{ text: "Hot", windows: [[5, 99]] }]))).toBeNull();
    expect(tamper((d) => ([d.low, d.high] = [10, 0]))).toBeNull();
    expect(readWeatherDay("nope")).toBeNull();
  });
});

describe("weather history attachments", () => {
  it("remembers each calendar copy of a day", () => {
    const [day] = roll({}, 1);
    const list = markAttached(markAttached([{ id: "a", createdAt: 1, day }], "a", "w1"), "a", "w2");
    expect(list[0].attachments).toEqual(["w1", "w2"]);
    expect(parseWeatherHistory(JSON.stringify(list))[0].attachments).toEqual(["w1", "w2"]);
    expect(parseWeatherHistory(JSON.stringify([{ ...list[0], attachments: [1] }]))).toEqual([]);
  });
});

describe("temperature and speed units", () => {
  it("converts between Celsius and Fahrenheit", () => {
    expect(fromCelsius(100, "fahrenheit")).toBe(212);
    expect(fromCelsius(-40, "fahrenheit")).toBe(-40);
    expect(toCelsius(32, "fahrenheit")).toBe(0);
    expect(toCelsius(21, "celsius")).toBe(21);
    expect(Math.round(fromKmh(100, "imperial"))).toBe(62);
  });

  it("stores the temperature unit as a setting", () => {
    expect(DEFAULT_SETTINGS.temperatureUnit).toBe("celsius");
    expect(sanitizeSettingsPatch({ temperatureUnit: "fahrenheit" })).toEqual({ patch: { temperatureUnit: "fahrenheit" } });
    expect(sanitizeSettingsPatch({ temperatureUnit: "kelvin" })).toEqual({ error: "invalidSettingValue", setting: "temperatureUnit" });
  });
});
