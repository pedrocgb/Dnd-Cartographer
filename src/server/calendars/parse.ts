/**
 * Strict parsers for calendar JSON coming from clients (pure; relative
 * imports only). Each returns the cleaned value, or throws ParseError with a
 * plain-language message. Shape only — semantic checks (ids exist, lengths,
 * anchors) are the evaluators' validate/issues functions.
 */
import type { CalendarDefinition, LeapRule, LocalDate, Period, Weekday, YearRule } from "./engine";
import type { AppearanceSchedule, CelestialConfig, CelestialType, CycleSegment, MoonPhase, StateOverride } from "./celestial";
import type { MonthDay, SeasonMembership, SeasonProfileData } from "./seasons";
import type { Condition, OccurrenceException, Recurrence } from "./recurrence";

export class ParseError extends Error {}

const MAX_NAME = 80;
const MAX_ITEMS = 400;

const fail = (message: string): never => {
  throw new ParseError(message);
};

const obj = (v: unknown, what: string): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(`${what} is missing or malformed.`);

const list = (v: unknown, what: string, max = MAX_ITEMS): unknown[] => {
  if (!Array.isArray(v)) return fail(`${what} must be a list.`);
  if (v.length > max) fail(`${what} can have at most ${max} items.`);
  return v;
};

const int = (v: unknown, what: string): number => (Number.isSafeInteger(v) ? (v as number) : fail(`${what} must be a whole number.`));

const str = (v: unknown, what: string, max = MAX_NAME): string => {
  if (typeof v !== "string") return fail(`${what} must be text.`);
  return v.trim().slice(0, max);
};

const ident = (v: unknown, what: string): string =>
  typeof v === "string" && v.length > 0 && v.length <= 64 ? v : fail(`${what} needs a valid id.`);

const bool = (v: unknown) => v === true;

function yearRule(v: unknown, what: string): YearRule {
  const r = obj(v, what);
  const exceptions = r.exceptions === undefined ? [] : list(r.exceptions, `${what} exceptions`, 10);
  return {
    every: int(r.every, `${what} interval`),
    offset: int(r.offset ?? 0, `${what} offset`),
    exceptions: exceptions.map((e, i) => {
      const x = obj(e, `${what} exception ${i + 1}`);
      return { every: int(x.every, `${what} exception interval`), offset: int(x.offset ?? 0, `${what} exception offset`), include: bool(x.include) };
    }),
  };
}

export function localDate(v: unknown, what: string): LocalDate {
  const d = obj(v, what);
  return { year: int(d.year, `${what} year`), periodId: ident(d.periodId, `${what} month`), day: int(d.day, `${what} day`) };
}

export function monthDay(v: unknown, what: string): MonthDay {
  const d = obj(v, what);
  return { periodId: ident(d.periodId, `${what} month`), day: int(d.day, `${what} day`) };
}

export function parseDefinition(v: unknown): CalendarDefinition {
  const d = obj(v, "The calendar definition");
  const weekdays: Weekday[] = list(d.weekdays, "Weekdays", 50).map((w, i) => {
    const x = obj(w, `Weekday ${i + 1}`);
    return { id: ident(x.id, `Weekday ${i + 1}`), name: str(x.name, "A weekday name"), short: str(x.short ?? "", "A weekday label", 12) };
  });
  const periods: Period[] = list(d.periods, "Months").map((p, i) => {
    const x = obj(p, `Month ${i + 1}`);
    const kind = x.kind === "special" ? "special" : "month";
    return {
      id: ident(x.id, `Month ${i + 1}`),
      name: str(x.name, "A month name"),
      short: str(x.short ?? "", "A month abbreviation", 12),
      kind,
      days: int(x.days, `${str(x.name, "A month name") || `Month ${i + 1}`} length`),
      inWeek: kind === "month" ? true : x.inWeek !== false,
      condition: x.condition ? yearRule(x.condition, `${str(x.name, "A month name")} occurrence rule`) : null,
    };
  });
  const leapRules: LeapRule[] = list(d.leapRules ?? [], "Leap rules", 20).map((l, i) => {
    const x = obj(l, `Leap rule ${i + 1}`);
    return {
      id: ident(x.id, `Leap rule ${i + 1}`),
      name: str(x.name ?? "", "A leap rule name"),
      periodId: ident(x.periodId, `Leap rule ${i + 1} month`),
      days: int(x.days, `Leap rule ${i + 1} days`),
      rule: yearRule(x.rule, `Leap rule ${i + 1}`),
    };
  });
  const anchor = obj(d.weekAnchor, "The weekday anchor");
  const year = obj(d.year, "The year settings");
  const sync = obj(d.sync, "The synchronization anchor");
  const reset = d.weekReset === "month" || d.weekReset === "year" ? d.weekReset : "continuous";
  return {
    weekdays,
    weekReset: reset,
    weekAnchor: { date: localDate(anchor.date, "The weekday anchor date"), weekdayId: typeof anchor.weekdayId === "string" ? anchor.weekdayId : "" },
    periods,
    leapRules,
    year: { hasYearZero: bool(year.hasYearZero), suffix: str(year.suffix ?? "", "The year suffix", 16) },
    sync: { date: localDate(sync.date, "The synchronization date"), worldDay: int(sync.worldDay, "The synchronization day") },
  };
}

const CELESTIAL_TYPES: readonly CelestialType[] = ["moon", "sun", "star", "constellation", "planet", "comet", "custom"];

export function parseCelestialType(v: unknown): CelestialType {
  return CELESTIAL_TYPES.includes(v as CelestialType) ? (v as CelestialType) : fail("Pick a celestial object type.");
}

function schedule(v: unknown, i: number): AppearanceSchedule {
  const x = obj(v, `Appearance ${i + 1}`);
  const base = { id: ident(x.id, `Appearance ${i + 1}`), stateId: ident(x.stateId, `Appearance ${i + 1} state`) };
  if (x.kind === "cycle") return { ...base, kind: "cycle", anchorWorldDay: int(x.anchorWorldDay, "The appearance start"), every: int(x.every, "The repeat interval"), duration: int(x.duration, "The duration") };
  if (x.kind === "annual") return { ...base, kind: "annual", calendarId: ident(x.calendarId, "The reference calendar"), start: monthDay(x.start, "The start"), end: monthDay(x.end, "The end") };
  if (x.kind === "once") {
    const repeatUnit = x.repeatUnit === "months" || x.repeatUnit === "years" ? x.repeatUnit : "days";
    return {
      ...base,
      kind: "once",
      startWorldDay: int(x.startWorldDay, "The first appearance"),
      duration: int(x.duration, "The duration"),
      repeatEvery: x.repeatEvery == null ? null : int(x.repeatEvery, "The repeat interval"),
      repeatUnit,
      repeatCalendarId: repeatUnit === "days" || x.repeatEvery == null ? null : ident(x.repeatCalendarId, "The calendar to count the return in"),
      alsoBefore: repeatUnit === "days" && x.repeatEvery != null && x.alsoBefore === true,
    };
  }
  return fail("Pick how the appearance repeats.");
}

export function parseCelestialConfig(v: unknown): CelestialConfig {
  const c = obj(v ?? {}, "The celestial settings");
  const out: CelestialConfig = {};
  if (c.phases !== undefined) {
    out.phases = list(c.phases, "Phases", 60).map((p, i): MoonPhase => {
      const x = obj(p, `Phase ${i + 1}`);
      return { id: ident(x.id, `Phase ${i + 1}`), name: str(x.name, "A phase name"), icon: str(x.icon ?? "", "A phase icon", 4), days: int(x.days, `${str(x.name, "A phase name") || `Phase ${i + 1}`} length`) };
    });
  }
  if (c.anchor) {
    const a = obj(c.anchor, "The reference date");
    out.anchor = { worldDay: int(a.worldDay, "The reference day"), phaseId: ident(a.phaseId, "The reference phase") };
  }
  if (c.segments !== undefined) {
    out.segments = list(c.segments, "Cycle restarts", 200).map((s, i): CycleSegment => {
      const x = obj(s, `Restart ${i + 1}`);
      return { id: ident(x.id, `Restart ${i + 1}`), fromWorldDay: int(x.fromWorldDay, "The restart day"), phaseId: ident(x.phaseId, "The restart phase") };
    });
  }
  if (c.states !== undefined) {
    out.states = list(c.states, "States", 60).map((s, i) => {
      const x = obj(s, `State ${i + 1}`);
      return { id: ident(x.id, `State ${i + 1}`), name: str(x.name, "A state name"), icon: str(x.icon ?? "", "A state icon", 4) };
    });
  }
  if (c.schedules !== undefined) out.schedules = list(c.schedules, "Appearances", 100).map(schedule);
  if (c.overrides !== undefined) {
    out.overrides = list(c.overrides, "Overrides", 500).map((o, i): StateOverride => {
      const x = obj(o, `Override ${i + 1}`);
      return { id: ident(x.id, `Override ${i + 1}`), start: int(x.start, "The override start"), end: int(x.end, "The override end"), stateId: ident(x.stateId, "The override state") };
    });
  }
  return out;
}

/** A profile's schedule (its calendar is a separate column). */
export function parseProfileData(v: unknown): Omit<SeasonProfileData, "calendarId"> {
  const p = obj(v, "The season profile");
  return {
    mode: p.mode === "manual" ? "manual" : "sequential",
    allowGaps: bool(p.allowGaps),
    allowOverlaps: bool(p.allowOverlaps),
    memberships: list(p.memberships ?? [], "Seasons", 50).map((m, i): SeasonMembership => {
      const x = obj(m, `Season ${i + 1}`);
      return {
        id: ident(x.id, `Season ${i + 1}`),
        seasonId: ident(x.seasonId, `Season ${i + 1}`),
        start: monthDay(x.start, "The season start"),
        end: x.end == null ? null : monthDay(x.end, "The season end"),
        allYear: bool(x.allYear),
      };
    }),
  };
}

function condition(v: unknown): Condition {
  const x = obj(v, "A condition");
  switch (x.type) {
    case "weekday":
      return { type: "weekday", calendarId: ident(x.calendarId, "The condition calendar"), weekdayId: ident(x.weekdayId, "The condition weekday") };
    case "period":
      return { type: "period", calendarId: ident(x.calendarId, "The condition calendar"), periodId: ident(x.periodId, "The condition month") };
    case "dayOfPeriod":
      return { type: "dayOfPeriod", calendarId: ident(x.calendarId, "The condition calendar"), day: int(x.day, "The condition day") };
    case "season":
      return { type: "season", profileId: ident(x.profileId, "The condition profile"), seasonId: ident(x.seasonId, "The condition season") };
    case "celestial":
      return { type: "celestial", objectId: ident(x.objectId, "The condition object"), stateId: ident(x.stateId, "The condition phase") };
    default:
      return fail("Pick a condition type.");
  }
}

const interval = (v: unknown, what: string) => {
  const n = int(v, what);
  return n >= 1 && n <= 100_000 ? n : fail(`${what} must be between 1 and 100000.`);
};

export function parseRecurrence(v: unknown): Recurrence {
  const r = obj(v ?? { kind: "none" }, "The repeat rule");
  const missing = r.missing === "last" ? "last" : "skip";
  switch (r.kind) {
    case "none":
      return { kind: "none" };
    case "everyDays":
      return { kind: "everyDays", interval: interval(r.interval, "The day interval") };
    case "weekly":
      return { kind: "weekly", calendarId: ident(r.calendarId, "The repeat calendar"), interval: interval(r.interval, "The week interval") };
    case "weekday":
      return { kind: "weekday", calendarId: ident(r.calendarId, "The repeat calendar"), weekdayId: ident(r.weekdayId, "The weekday") };
    case "monthly":
      return { kind: "monthly", calendarId: ident(r.calendarId, "The repeat calendar"), interval: interval(r.interval, "The month interval"), day: interval(r.day, "The day of the month"), missing };
    case "annual":
      return {
        kind: "annual",
        calendarId: ident(r.calendarId, "The repeat calendar"),
        interval: interval(r.interval, "The year interval"),
        periodId: ident(r.periodId, "The month"),
        day: interval(r.day, "The day"),
        missing,
      };
    case "condition": {
      const g = obj(r.group, "The condition group");
      const conditions = list(g.conditions, "Conditions", 8).map(condition);
      if (conditions.length === 0) fail("Add at least one condition.");
      return { kind: "condition", group: { match: g.match === "any" ? "any" : "all", conditions }, trigger: r.trigger === "every" ? "every" : "enter" };
    }
    default:
      return fail("Pick how the event repeats.");
  }
}

export function parseException(v: unknown): OccurrenceException {
  const x = obj(v, "The occurrence change");
  const out: OccurrenceException = {};
  if (x.cancelled === true) out.cancelled = true;
  if (x.moveTo !== undefined && x.moveTo !== null) out.moveTo = int(x.moveTo, "The new day");
  if (typeof x.title === "string" && x.title.trim()) out.title = x.title.trim().slice(0, 200);
  if (typeof x.description === "string" && x.description.trim()) out.description = x.description.trim().slice(0, 4000);
  return out;
}

/** `[{ template, articleId }]`, deduped, capped. */
export function parseArticleLinks(v: unknown): { template: string; articleId: string }[] {
  const seen = new Set<string>();
  const out: { template: string; articleId: string }[] = [];
  for (const item of list(v ?? [], "Article links", 50)) {
    const x = obj(item, "An article link");
    const template = ident(x.template, "The linked article type");
    const articleId = ident(x.articleId, "The linked article");
    if (seen.has(articleId)) continue;
    seen.add(articleId);
    out.push({ template, articleId });
  }
  return out;
}

/** Calendars a celestial object shows in: `null` (or "all") = every calendar; otherwise a non-empty, deduped id list. */
export function parseCalendarIds(v: unknown): string[] | null {
  if (v === null || v === "all") return null;
  const ids = [...new Set(list(v, "Calendars", 50).map((x) => ident(x, "A calendar")))];
  return ids.length ? ids : fail("Pick at least one calendar, or All.");
}

/** A season's calendar: null (shared by every calendar) or one calendar id. */
export const parseSeasonCalendar = (v: unknown): string | null => (v === null || v === undefined ? null : ident(v, "The season's calendar"));

export const cleanName = (v: unknown, max = MAX_NAME) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function cleanColor(v: unknown): string | null {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : null;
}

export function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
