import { describe, expect, it } from "vitest";
import { fromWorldDay, toWorldDay, validateDefinition, type CalendarDefinition } from "../src/server/calendars/engine";
import { calendarImpact, recurrenceBreak, shiftEntryNamed, type ImpactEntry } from "../src/server/calendars/impact";
import { ParseError, parseCelestialConfig, parseDefinition, parseProfileData, parseRecurrence } from "../src/server/calendars/parse";

// Calendar A of the acceptance scenarios: Alder 20 / Birch 15, five weekdays, no year zero, year 1 Alder 1 = day 0.
const A: CalendarDefinition = {
  weekdays: Array.from({ length: 5 }, (_, i) => ({ id: `w${i + 1}`, name: `W${i + 1}`, short: "" })),
  weekReset: "continuous",
  weekAnchor: { date: { year: 1, periodId: "alder", day: 1 }, weekdayId: "w1" },
  periods: [
    { id: "alder", name: "Alder", short: "", kind: "month", days: 20, inWeek: true, condition: null },
    { id: "birch", name: "Birch", short: "", kind: "month", days: 15, inWeek: true, condition: null },
  ],
  leapRules: [],
  year: { hasYearZero: false, suffix: "" },
  sync: { date: { year: 1, periodId: "alder", day: 1 }, worldDay: 0 },
};

const shorter: CalendarDefinition = { ...A, periods: A.periods.map((p) => (p.id === "birch" ? { ...p, days: 10 } : p)) };

const entry = (id: string, worldDay: number, extra: Partial<ImpactEntry> = {}): ImpactEntry => ({ id, title: id, worldDay, recurrence: { kind: "none" }, exceptions: {}, ...extra });

function impactOf(next: CalendarDefinition, entries: ImpactEntry[]) {
  return calendarImpact({ calendarId: "a", prev: A, next, currentDay: 19, entries, profiles: [], celestial: [], seasonName: () => "Season" });
}

describe("structural change impact", () => {
  it("shortening a month: physical days keep, labels move, named dates can become invalid", () => {
    const impact = impactOf(shorter, [entry("birch1", 20), entry("birch15", 34), entry("alder5", 4)]);
    // Alder is untouched and comes first: its entries don't change at all.
    expect(impact.entries.map((e) => e.id).sort()).toEqual(["birch15"]);
    const e = impact.entries[0];
    expect(e.before).toContain("15 Birch 1");
    expect(e.afterPhysical).toContain("5 Alder 2"); // day 34 is 30 + 4 → year 2, Alder 5
    expect("error" in e.named).toBe(true);
    // The current day's label (day 19 = Alder 20) is unchanged.
    expect(impact.currentDay.before).toBe(impact.currentDay.after);
    expect(impact.harmless).toBe(false);
  });

  it("a rename is harmless", () => {
    const renamed = { ...A, periods: A.periods.map((p) => (p.id === "alder" ? { ...p, name: "Oak" } : p)) };
    const impact = impactOf(renamed, [entry("x", 4)]);
    // The label changes but ids don't, so nothing moves — reported as a label change only.
    expect(impact.entries[0].named).toEqual({ worldDay: 4, label: expect.stringContaining("Oak") });
  });

  it("flags repeat rules that point at removed months or weekdays", () => {
    const noBirch = { ...A, periods: A.periods.filter((p) => p.id !== "birch") };
    expect(recurrenceBreak({ kind: "annual", calendarId: "a", interval: 1, periodId: "birch", day: 1, missing: "skip" }, "a", noBirch)?.key).toBe("problem.removedMonth");
    expect(recurrenceBreak({ kind: "annual", calendarId: "other", interval: 1, periodId: "birch", day: 1, missing: "skip" }, "a", noBirch)).toBeNull();
    const fourDays = { ...A, weekdays: A.weekdays.slice(0, 4) };
    expect(recurrenceBreak({ kind: "weekday", calendarId: "a", weekdayId: "w5" }, "a", fourDays)?.key).toBe("problem.removedWeekday");
  });

  it("Preserve Named Dates re-keys a series and its exceptions consistently", () => {
    // A longer Alder (25 days): Birch 1 of year 1 moves from day 20 to day 25.
    const longer = { ...A, periods: A.periods.map((p) => (p.id === "alder" ? { ...p, days: 25 } : p)) };
    const shifted = shiftEntryNamed(A, longer, { worldDay: 20, exceptions: { "55": { cancelled: true }, "20": { moveTo: 21 } } });
    expect(shifted.worldDay).toBe(toWorldDay(longer, { year: 1, periodId: "birch", day: 1 }));
    expect(fromWorldDay(longer, shifted.worldDay)).toEqual({ year: 1, periodId: "birch", day: 1 });
    // Day 55 was year 2 Birch 1 in A; the key follows that named date.
    expect(Object.keys(shifted.exceptions).map(Number)).toContain(toWorldDay(longer, { year: 2, periodId: "birch", day: 1 }));
    expect(shifted.exceptions[String(shifted.worldDay)].moveTo).toBe(toWorldDay(longer, { year: 1, periodId: "birch", day: 2 }));
  });
});

describe("request parsing", () => {
  it("parses a valid definition and keeps months inside the week", () => {
    const parsed = parseDefinition({ ...A, periods: [{ ...A.periods[0], inWeek: false }, A.periods[1]] });
    expect(parsed.periods[0].inWeek).toBe(true);
    expect(validateDefinition(parsed)).toEqual([]);
  });

  it("rejects malformed shapes with plain messages", () => {
    expect(() => parseDefinition(null)).toThrow(ParseError);
    expect(() => parseDefinition({ ...A, periods: [{ ...A.periods[0], days: 2.5 }] })).toThrow(/whole number/);
    expect(() => parseDefinition({ ...A, weekdays: "x" })).toThrow(/list/);
    expect(() => parseRecurrence({ kind: "everyDays", interval: 0 })).toThrow(/between 1/);
    expect(() => parseRecurrence({ kind: "condition", group: { match: "all", conditions: [] }, trigger: "enter" })).toThrow(/at least one/);
    expect(() => parseRecurrence({ kind: "eval", code: "x" })).toThrow(ParseError);
  });

  it("drops unknown keys from celestial configs and profiles", () => {
    const config = parseCelestialConfig({ phases: [{ id: "p", name: "Full", icon: "○", days: 3, extra: 1 }], anchor: { worldDay: 0, phaseId: "p" }, script: "no" });
    expect(config).toEqual({ phases: [{ id: "p", name: "Full", icon: "○", days: 3 }], anchor: { worldDay: 0, phaseId: "p" } });
    const profile = parseProfileData({ mode: "manual", memberships: [{ id: "m", seasonId: "s", start: { periodId: "birch", day: 10 }, end: { periodId: "alder", day: 5 } }] });
    expect(profile).toEqual({ mode: "manual", allowGaps: false, allowOverlaps: false, memberships: [{ id: "m", seasonId: "s", start: { periodId: "birch", day: 10 }, end: { periodId: "alder", day: 5 }, allYear: false }] });
  });
});
