import { describe, expect, it } from "vitest";
import {
  dateError,
  fromWorldDay,
  matchesYear,
  toWorldDay,
  validateDefinition,
  weekdayIndex,
  yearLength,
  type CalendarDefinition,
  type LocalDate,
} from "../src/server/calendars/engine";
import { evaluateCelestial, nextPhaseStart, normalizeSchedule, overrideOverlap, scheduleStarts, splitCycle, type AppearanceSchedule, type CelestialConfig } from "../src/server/calendars/celestial";
import { activeSeasons, profileIssues, type SeasonProfileData } from "../src/server/calendars/seasons";
import { expandSeries, occurrenceStarts, type EvalContext } from "../src/server/calendars/recurrence";

// Acceptance fixtures (invented, not production defaults).
const weekdays = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `w${i + 1}`, name: `W${i + 1}`, short: `W${i + 1}` }));

const A: CalendarDefinition = {
  weekdays: weekdays(5),
  weekReset: "continuous",
  weekAnchor: { date: { year: 1, periodId: "alder", day: 1 }, weekdayId: "w1" },
  periods: [
    { id: "alder", name: "Alder", short: "Ald", kind: "month", days: 20, inWeek: true },
    { id: "birch", name: "Birch", short: "Bir", kind: "month", days: 15, inWeek: true },
  ],
  leapRules: [],
  year: { hasYearZero: false, suffix: "" },
  sync: { date: { year: 1, periodId: "alder", day: 1 }, worldDay: 0 },
};

const B: CalendarDefinition = {
  weekdays: weekdays(6),
  weekReset: "continuous",
  weekAnchor: { date: { year: 10, periodId: "m1", day: 1 }, weekdayId: "w1" },
  periods: ["m1", "m2", "m3"].map((id, i) => ({ id, name: `Month ${i + 1}`, short: `M${i + 1}`, kind: "month" as const, days: 10, inWeek: true })),
  leapRules: [],
  year: { hasYearZero: false, suffix: "" },
  sync: { date: { year: 10, periodId: "m1", day: 1 }, worldDay: 0 },
};

const date = (year: number, periodId: string, day: number): LocalDate => ({ year, periodId, day });

describe("core chronology", () => {
  it("both acceptance calendars are valid", () => {
    expect(validateDefinition(A)).toEqual([]);
    expect(validateDefinition(B)).toEqual([]);
  });

  it("maps shared days across calendars", () => {
    expect(fromWorldDay(A, 19)).toEqual(date(1, "alder", 20));
    expect(fromWorldDay(B, 19)).toEqual(date(10, "m2", 10));
    expect(fromWorldDay(A, 20)).toEqual(date(1, "birch", 1));
    expect(fromWorldDay(B, 20)).toEqual(date(10, "m3", 1));
    expect(fromWorldDay(A, 35)).toEqual(date(2, "alder", 1));
    expect(fromWorldDay(B, 35)).toEqual(date(11, "m1", 6));
  });

  it("goes before the epoch without a year zero", () => {
    expect(fromWorldDay(A, -1)).toEqual(date(-1, "birch", 15));
    expect(dateError(A, date(0, "alder", 1))).toMatch(/no year 0/);
  });

  it("round-trips across boundaries and negative days", () => {
    for (let d = -200; d <= 200; d++) {
      expect(toWorldDay(A, fromWorldDay(A, d))).toBe(d);
      expect(toWorldDay(B, fromWorldDay(B, d))).toBe(d);
    }
  });

  it("handles far years in bounded time", () => {
    const far = date(900000, "birch", 3);
    expect(fromWorldDay(A, toWorldDay(A, far))).toEqual(far);
  });

  it("rejects nonexistent exact dates", () => {
    expect(dateError(A, date(1, "alder", 21))).toMatch(/20 days/);
    expect(dateError(A, date(1, "nope", 1))).toMatch(/doesn't exist/);
    expect(validateDefinition({ ...A, periods: [{ ...A.periods[0], days: 0 }] }).length).toBeGreaterThan(0);
    expect(validateDefinition({ ...A, periods: [] })[0].message).toMatch(/at least one month/);
  });
});

describe("special days and leap rules", () => {
  const festival: CalendarDefinition = {
    ...A,
    periods: [A.periods[0], { id: "fest", name: "Festival", short: "Fest", kind: "special", days: 2, inWeek: false }, A.periods[1]],
  };

  it("keeps festival days outside the week but inside physical time", () => {
    expect(weekdayIndex(festival, date(1, "alder", 20))).toBe(4); // W5
    expect(weekdayIndex(festival, date(1, "fest", 1))).toBeNull();
    expect(weekdayIndex(festival, date(1, "birch", 1))).toBe(0); // W1
    expect(fromWorldDay(festival, 20)).toEqual(date(1, "fest", 1));
    expect(fromWorldDay(festival, 22)).toEqual(date(1, "birch", 1));
    expect(yearLength(festival, 1)).toBe(37);
  });

  it("adds a leap day every fourth year", () => {
    const leap: CalendarDefinition = { ...A, leapRules: [{ id: "l", name: "Leap", periodId: "birch", days: 1, rule: { every: 4, offset: 0 } }] };
    expect(yearLength(leap, 4)).toBe(36);
    expect(yearLength(leap, 5)).toBe(35);
    for (let d = -300; d <= 300; d++) expect(toWorldDay(leap, fromWorldDay(leap, d))).toBe(d);
  });

  it("intersects a conditional month with a leap day rule", () => {
    const cond: CalendarDefinition = {
      ...A,
      periods: [...A.periods, { id: "extra", name: "Extra", short: "Ext", kind: "month", days: 5, inWeek: true, condition: { every: 4, offset: 0 } }],
      leapRules: [{ id: "l", name: "Leap", periodId: "extra", days: 1, rule: { every: 6, offset: 0 } }],
    };
    expect(yearLength(cond, 12)).toBe(41); // both
    expect(yearLength(cond, 8)).toBe(40); // month only
    expect(yearLength(cond, 6)).toBe(35); // leap day but no month
  });

  it("supports Gregorian-style exceptions", () => {
    const rule = { every: 4, offset: 0, exceptions: [{ every: 100, offset: 0, include: false }, { every: 400, offset: 0, include: true }] };
    expect([1900, 2000, 2024, 2023].map((y) => matchesYear(rule, y))).toEqual([false, true, true, false]);
  });
});

describe("moon phases", () => {
  const phases = [
    { id: "new", name: "New", icon: "●", days: 2 },
    { id: "wax", name: "Waxing", icon: "◑", days: 3 },
    { id: "full", name: "Full", icon: "○", days: 1 },
    { id: "wan", name: "Waning", icon: "◐", days: 2 },
  ];
  const moon: CelestialConfig = { phases, anchor: { worldDay: 0, phaseId: "new" } };
  const phaseOn = (config: CelestialConfig, d: number) => evaluateCelestial("moon", config, d, () => null)[0]?.id;

  it("cycles through durations, including before the anchor", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, -1].map((d) => phaseOn(moon, d))).toEqual(["new", "new", "wax", "wax", "wax", "full", "wan", "wan", "new", "wan"]);
  });

  it("applies overrides then resumes the base cycle", () => {
    const withOverride = { ...moon, overrides: [{ id: "o", start: 3, end: 4, stateId: "full" }] };
    expect([3, 4, 5, 6].map((d) => phaseOn(withOverride, d))).toEqual(["full", "full", "full", "wan"]);
    expect(overrideOverlap([{ id: "a", start: 3, end: 4, stateId: "full" }, { id: "b", start: 4, end: 6, stateId: "new" }])).not.toBeNull();
  });

  it("restarts the cycle without changing history", () => {
    const restarted = { ...moon, segments: [{ id: "s", fromWorldDay: 6, phaseId: "new" }] };
    expect([0, 5, 6, 7, 8].map((d) => phaseOn(restarted, d))).toEqual(["new", "full", "new", "new", "wax"]);
  });

  it("finds the next full moon and splits cycles without zero-day phases", () => {
    expect(nextPhaseStart(moon, "full", 6)).toBe(13);
    expect(splitCycle(29, 8)).toEqual([4, 4, 4, 4, 4, 3, 3, 3]);
    expect(splitCycle(3, 8)).toBeNull();
  });
});

describe("seasons", () => {
  const winter: SeasonProfileData = {
    calendarId: "A",
    mode: "manual",
    allowGaps: true,
    allowOverlaps: false,
    memberships: [{ id: "m", seasonId: "winter", start: { periodId: "birch", day: 10 }, end: { periodId: "alder", day: 5 } }],
  };

  it("wraps winter across the year boundary", () => {
    for (let d = 29; d <= 39; d++) expect(activeSeasons(A, winter, d)).toEqual(["winter"]);
    expect(activeSeasons(A, winter, 40)).toEqual([]);
    expect(activeSeasons(A, winter, 28)).toEqual([]);
  });

  it("reports gaps unless allowed, and invalid boundaries", () => {
    expect(profileIssues(A, winter, () => "Winter")).toEqual([]);
    expect(profileIssues(A, { ...winter, allowGaps: false }, () => "Winter")[0].kind).toBe("gap");
    expect(profileIssues(A, { ...winter, memberships: [{ ...winter.memberships[0], start: { periodId: "birch", day: 16 } }] }, () => "Winter")[0].kind).toBe("invalid");
  });

  it("sequential seasons end the day before the next begins", () => {
    const seq: SeasonProfileData = {
      calendarId: "A",
      mode: "sequential",
      allowGaps: false,
      allowOverlaps: false,
      memberships: [
        { id: "a", seasonId: "warm", start: { periodId: "alder", day: 1 }, end: null },
        { id: "b", seasonId: "cold", start: { periodId: "birch", day: 1 }, end: null },
      ],
    };
    expect(activeSeasons(A, seq, 19)).toEqual(["warm"]);
    expect(activeSeasons(A, seq, 20)).toEqual(["cold"]);
    expect(activeSeasons(A, seq, -1)).toEqual(["cold"]);
    expect(profileIssues(A, seq, (id) => id)).toEqual([]);
  });
});

describe("recurrence", () => {
  const ctx: EvalContext = {
    calendar: (id) => (id === "A" ? A : id === "B" ? B : null),
    seasonsOn: () => [],
    celestialOn: () => [],
  };

  it("expands every-N-days and annual rules only inside the range", () => {
    expect(occurrenceStarts({ kind: "everyDays", interval: 10 }, 0, null, 15, 45, ctx)).toEqual([20, 30, 40]);
    expect(occurrenceStarts({ kind: "annual", calendarId: "A", interval: 1, periodId: "birch", day: 1, missing: "skip" }, 20, null, 0, 100, ctx)).toEqual([20, 55, 90]);
  });

  it("skips or clamps missing monthly days by policy", () => {
    // Day 18 exists in Alder (20) but not Birch (15).
    const skip = occurrenceStarts({ kind: "monthly", calendarId: "A", interval: 1, day: 18, missing: "skip" }, 0, null, 0, 69, ctx);
    const last = occurrenceStarts({ kind: "monthly", calendarId: "A", interval: 1, day: 18, missing: "last" }, 0, null, 0, 69, ctx);
    expect(skip).toEqual([17, 52]);
    expect(last).toEqual([17, 34, 52, 69]);
  });

  it("follows named weekdays and physical weeks", () => {
    expect(occurrenceStarts({ kind: "weekday", calendarId: "A", weekdayId: "w1" }, 0, null, 0, 14, ctx)).toEqual([0, 5, 10]);
    expect(occurrenceStarts({ kind: "weekly", calendarId: "B", interval: 1 }, 0, null, 0, 20, ctx)).toEqual([0, 6, 12, 18]);
  });

  it("distinguishes On Enter from Every Matching Day", () => {
    const window = { ...ctx, celestialOn: (_: string, d: number) => (d >= 3 && d <= 5 ? ["full"] : []) };
    const group = { match: "all" as const, conditions: [{ type: "celestial" as const, objectId: "moon", stateId: "full" }] };
    expect(occurrenceStarts({ kind: "condition", group, trigger: "enter" }, -10, null, 0, 10, window)).toEqual([3]);
    expect(occurrenceStarts({ kind: "condition", group, trigger: "every" }, -10, null, 0, 10, window)).toEqual([3, 4, 5]);
    expect(occurrenceStarts({ kind: "condition", group, trigger: "enter" }, -10, null, 4, 10, window)).toEqual([]);
  });

  it("carries multi-day events into the range and applies exceptions", () => {
    const series = { worldDay: 0, durationDays: 3, recurrence: { kind: "everyDays" as const, interval: 10 }, until: null, exceptions: { "10": { cancelled: true }, "20": { moveTo: 23 } } };
    expect(expandSeries(series, 1, 25, ctx).map((o) => [o.key, o.start, o.end])).toEqual([
      [0, 0, 2],
      [20, 23, 25],
    ]);
  });
});

describe("appearances that return in months or years", () => {
  const calendars = (id: string) => (id === "a" ? A : null);
  const comet = (unit: "days" | "months" | "years", start: number, every = 1): AppearanceSchedule => ({
    id: "s",
    stateId: "visible",
    kind: "once",
    startWorldDay: start,
    duration: 2,
    repeatEvery: every,
    repeatUnit: unit,
    repeatCalendarId: unit === "days" ? null : "a",
  });
  const config = (s: AppearanceSchedule): CelestialConfig => ({ states: [{ id: "visible", name: "Visible", icon: "*" }], schedules: [s] });

  it("returns on the same date every N years of the calendar", () => {
    // Calendar A years are 35 days: Alder 6 of years 1, 2, 3 = days 5, 40, 75.
    expect(scheduleStarts(comet("years", 5), 0, 100, calendars)).toEqual([5, 40, 75]);
    expect(scheduleStarts(comet("years", 5, 2), 0, 100, calendars)).toEqual([5, 75]);
    const shows = (d: number) => evaluateCelestial("comet", config(comet("years", 5)), d, calendars).length > 0;
    expect([39, 40, 41, 42].map(shows)).toEqual([false, true, true, false]);
  });

  it("returns monthly, on the month's last day when it's shorter", () => {
    // From Alder 20 (day 19): Birch has only 15 days, so Birch 15 (day 34), then Alder 20 of year 2 (day 54).
    expect(scheduleStarts(comet("months", 19), 0, 60, calendars)).toEqual([19, 34, 54]);
  });

  it("keeps plain day intervals and honors the limit", () => {
    expect(scheduleStarts(comet("days", 3, 10), 0, 50, calendars, 3)).toEqual([3, 13, 23]);
  });

  it("runs before its date too when it has always been repeating (the old cycle rule)", () => {
    const always = { ...comet("days", 23, 10), alsoBefore: true } as AppearanceSchedule;
    expect(scheduleStarts(always, 0, 50, calendars)).toEqual([3, 13, 23, 33, 43]);
    const shows = (s: AppearanceSchedule, d: number) => evaluateCelestial("comet", config(s), d, calendars).length > 0;
    expect([2, 3, 4, 5, -7].map((d) => shows(always, d))).toEqual([false, true, true, false, true]);
    expect(shows(comet("days", 23, 10), 3)).toBe(false);
    // An old "cycle" rule shows on exactly the same days as its normalized form.
    const old: AppearanceSchedule = { id: "s", stateId: "visible", kind: "cycle", anchorWorldDay: 23, every: 10, duration: 2 };
    expect(normalizeSchedule(old)).toMatchObject({ kind: "once", startWorldDay: 23, repeatEvery: 10, repeatUnit: "days", alsoBefore: true });
    for (let d = -30; d <= 60; d++) expect(shows(normalizeSchedule(old), d)).toBe(shows(old, d));
  });
});
