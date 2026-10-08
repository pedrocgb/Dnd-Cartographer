import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseStoredSettings, REAL_DATE_FORMATS, sanitizeSettingsPatch } from "../src/server/settings/settings";
import { applyDateFormat, formatRealDate } from "../src/server/settings/date-format";
import { formatDate, type CalendarDefinition } from "../src/server/calendars/engine";
import { fromFeet, fromKg, fromLitres, fromMiles, measureExample, roundForInput, toFeet, toMiles } from "../src/server/settings/units";

describe("settings", () => {
  it("keeps known valid keys and ignores unknown ones", () => {
    expect(sanitizeSettingsPatch({ weightSystem: "imperial", trashRetentionDays: 30, theme: "pink" })).toEqual({ patch: { weightSystem: "imperial", trashRetentionDays: 30 } });
    expect(sanitizeSettingsPatch({ trashRetentionDays: null })).toEqual({ patch: { trashRetentionDays: null } });
  });

  it("rejects invalid values and bodies", () => {
    expect(sanitizeSettingsPatch({ lengthSystem: "cubits" })).toEqual({ error: "invalidSettingValue", setting: "lengthSystem" });
    expect(sanitizeSettingsPatch({ trashRetentionDays: 12 })).toEqual({ error: "invalidSettingValue", setting: "trashRetentionDays" });
    expect(sanitizeSettingsPatch({ realDateFormat: "DD/MM" })).toHaveProperty("error");
    expect(sanitizeSettingsPatch(null)).toHaveProperty("error");
    expect(sanitizeSettingsPatch([1])).toHaveProperty("error");
  });

  it("reads stored values over the defaults, dropping bad ones", () => {
    expect(parseStoredSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseStoredSettings({ language: "pt-BR", weightSystem: "stone", lastAutoPurgeAt: 5 })).toEqual({ ...DEFAULT_SETTINGS, language: "pt-BR" });
  });
});

describe("real-world dates", () => {
  const day = new Date(2026, 8, 7, 14, 5); // 7 September 2026, 14:05 local

  it("formats every preset", () => {
    const out = Object.fromEntries(REAL_DATE_FORMATS.map((f) => [f, formatRealDate(day, f)]));
    expect(out).toEqual({
      "DD/MM/YYYY": "07/09/2026",
      "MM/DD/YYYY": "09/07/2026",
      "YYYY/MM/DD": "2026/09/07",
      "YYYY/DD/MM": "2026/07/09",
      "DD-MM-YYYY": "07-09-2026",
      "DD.MM.YYYY": "07.09.2026",
      "YYYY-MM-DD": "2026-09-07",
      "D MMMM YYYY": "7 September 2026",
      "MMMM D, YYYY": "September 7, 2026",
    });
  });

  it("treats a bare ISO day as a calendar day and adds the time on request", () => {
    expect(formatRealDate("2026-01-31", "DD/MM/YYYY")).toBe("31/01/2026");
    expect(formatRealDate("2026-01-31", "DD/MM/YYYY", { withTime: true })).toBe("31/01/2026");
    expect(formatRealDate(day.getTime(), "YYYY-MM-DD", { withTime: true })).toBe("2026-09-07 14:05");
    expect(formatRealDate(null)).toBe("");
    expect(formatRealDate("not a date")).toBe("");
  });

  it("never reads a month name's letters as tokens", () => {
    expect(applyDateFormat("D MMMM YYYY", { day: 3, month: 12, monthName: "Deepwinter MM", year: "1 DR" })).toBe("3 Deepwinter MM 1 DR");
  });
});

describe("fantasy dates", () => {
  const def: CalendarDefinition = {
    weekdays: [],
    weekReset: "continuous",
    weekAnchor: { date: { year: 1, periodId: "alder", day: 1 }, weekdayId: "w1" },
    periods: [
      { id: "alder", name: "Alder", short: "Ald", kind: "month", days: 20, inWeek: true },
      { id: "birch", name: "Birch", short: "Bir", kind: "month", days: 15, inWeek: true },
    ],
    leapRules: [],
    year: { hasYearZero: false, suffix: "AR" },
    sync: { date: { year: 1, periodId: "alder", day: 1 }, worldDay: 0 },
  };
  const date = { year: 1024, periodId: "birch", day: 12 };

  it("keeps the old label by default", () => {
    expect(formatDate(def, date)).toBe("12 Birch 1024 AR");
    expect(formatDate(def, date, { short: true })).toBe("12 Bir 1024 AR");
  });

  it("reorders or numbers the month", () => {
    expect(formatDate(def, date, { format: "MMMM D, YYYY" })).toBe("Birch 12, 1024 AR");
    expect(formatDate(def, date, { format: "YYYY, D MMMM" })).toBe("1024 AR, 12 Birch");
    expect(formatDate(def, date, { format: "DD/MM/YYYY" })).toBe("12/02/1024 AR");
    expect(formatDate(def, date, { format: "YYYY/MM/DD" })).toBe("1024 AR/02/12");
  });
});

describe("units", () => {
  it("converts for display and back", () => {
    expect(fromMiles(10, "imperial")).toBe(10);
    expect(roundForInput(fromMiles(10, "metric"))).toBe(16.09);
    expect(toMiles(fromMiles(3, "metric"), "metric")).toBeCloseTo(3);
    expect(roundForInput(fromFeet(30, "metric"))).toBe(9.14);
    expect(toFeet(fromFeet(30, "metric"), "metric")).toBeCloseTo(30);
    expect(roundForInput(fromKg(1, "imperial"))).toBe(2.2);
    expect(roundForInput(fromLitres(3.785411784, "imperial"))).toBe(1);
  });

  it("picks field examples by what they measure", () => {
    const systems = { weightSystem: "imperial", lengthSystem: "metric" } as const;
    expect(measureExample("weight", systems)).toBe("e.g. 176 lb");
    expect(measureExample("height", systems)).toBe("e.g. 1.80 m");
  });
});

describe("number format", () => {
  it("writes app numbers with the chosen separators", async () => {
    const { formatDecimal, formatInteger } = await import("../src/server/settings/number-format");
    expect(formatDecimal(1_000_000.23, { format: "comma" })).toBe("1,000,000.23");
    expect(formatDecimal(1_000_000.23, { format: "point" })).toBe("1.000.000,23");
    expect(formatDecimal(1_000_000.23, { format: "space" })).toBe("1 000 000,23");
    expect(formatDecimal(1234.5, { format: "point", grouping: false })).toBe("1234,5");
    expect(formatInteger(12_000.4, "point")).toBe("12.000");
  });

  it("is a valid, defaulted setting", async () => {
    const { parseStoredSettings, sanitizeSettingsPatch } = await import("../src/server/settings/settings");
    expect(parseStoredSettings({}).numberFormat).toBe("comma");
    expect(sanitizeSettingsPatch({ numberFormat: "space" })).toEqual({ patch: { numberFormat: "space" } });
    expect(sanitizeSettingsPatch({ numberFormat: "dot" })).toEqual({ error: "invalidSettingValue", setting: "numberFormat" });
  });
});
