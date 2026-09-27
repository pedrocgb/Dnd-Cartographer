/**
 * Event recurrence (pure, bounded). Rules and exceptions are stored once;
 * occurrences are evaluated only for a requested finite range — nothing is
 * ever materialized, so moving the world date can't duplicate anything.
 *
 * Bindings:
 * - everyDays: a physical interval from the series start (worldDay).
 * - weekly: N weeks of the source calendar = N x its weekday count in
 *   physical days (festival days included).
 * - weekday: each day with that named weekday in the source calendar
 *   (days outside the week never match).
 * - monthly / annual: dates in the source calendar; a date missing that
 *   month/year follows `missing` (skip, or the period's last day). A
 *   conditional month absent that year is always skipped.
 * - condition: typed All/Any predicates; "enter" fires when D matches and
 *   D-1 didn't, "every" on each matching day.
 */
import {
  fromWorldDay,
  monthOrdinal,
  nextYear,
  toInternalYear,
  toWorldDay,
  weekdayIndex,
  weekLength,
  yearPeriods,
  type CalendarDefinition,
} from "./engine";

export type MissingPolicy = "skip" | "last";

export type Condition =
  | { type: "weekday"; calendarId: string; weekdayId: string }
  | { type: "period"; calendarId: string; periodId: string }
  | { type: "dayOfPeriod"; calendarId: string; day: number }
  | { type: "season"; profileId: string; seasonId: string }
  | { type: "celestial"; objectId: string; stateId: string };

export interface ConditionGroup {
  match: "all" | "any";
  conditions: Condition[];
}

export type Recurrence =
  | { kind: "none" }
  | { kind: "everyDays"; interval: number }
  | { kind: "weekly"; calendarId: string; interval: number }
  | { kind: "weekday"; calendarId: string; weekdayId: string }
  | { kind: "monthly"; calendarId: string; interval: number; day: number; missing: MissingPolicy }
  | { kind: "annual"; calendarId: string; interval: number; periodId: string; day: number; missing: MissingPolicy }
  | { kind: "condition"; group: ConditionGroup; trigger: "enter" | "every" };

/** One occurrence changed or cancelled, keyed by its original start day. */
export interface OccurrenceException {
  cancelled?: boolean;
  /** Moved start (worldDay). */
  moveTo?: number;
  title?: string;
  description?: string;
}

export interface EvalContext {
  calendar: (id: string) => CalendarDefinition | null;
  /** Season ids active in a profile on a day. */
  seasonsOn: (profileId: string, worldDay: number) => string[];
  /** State ids (phase ids for moons) an object shows on a day. */
  celestialOn: (objectId: string, worldDay: number) => string[];
}

/** Longest range one query may evaluate (physical days). */
export const MAX_RANGE_DAYS = 5000;
/** Conditions may look back this far for a duration's carry-in. */
export const MAX_DURATION_DAYS = 1000;

export class RecurrenceError extends Error {}

function checkRange(from: number, to: number) {
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || to < from) throw new RecurrenceError("Pick a valid date range.");
  if (to - from + 1 > MAX_RANGE_DAYS) throw new RecurrenceError(`Ranges are limited to ${MAX_RANGE_DAYS} days per query.`);
}

export function conditionHolds(condition: Condition, worldDay: number, ctx: EvalContext): boolean {
  switch (condition.type) {
    case "weekday": {
      const def = ctx.calendar(condition.calendarId);
      if (!def) return false;
      const index = weekdayIndex(def, fromWorldDay(def, worldDay));
      return index !== null && def.weekdays[index]?.id === condition.weekdayId;
    }
    case "period": {
      const def = ctx.calendar(condition.calendarId);
      return def ? fromWorldDay(def, worldDay).periodId === condition.periodId : false;
    }
    case "dayOfPeriod": {
      const def = ctx.calendar(condition.calendarId);
      return def ? fromWorldDay(def, worldDay).day === condition.day : false;
    }
    case "season":
      return ctx.seasonsOn(condition.profileId, worldDay).includes(condition.seasonId);
    case "celestial":
      return ctx.celestialOn(condition.objectId, worldDay).includes(condition.stateId);
  }
}

export function groupHolds(group: ConditionGroup, worldDay: number, ctx: EvalContext): boolean {
  if (group.conditions.length === 0) return false;
  return group.match === "all" ? group.conditions.every((c) => conditionHolds(c, worldDay, ctx)) : group.conditions.some((c) => conditionHolds(c, worldDay, ctx));
}

/** Occurrence start days of a series in [from, to] (none before `seriesStart`, none after `until`). */
export function occurrenceStarts(rule: Recurrence, seriesStart: number, until: number | null, from: number, to: number, ctx: EvalContext): number[] {
  checkRange(from, to);
  const lo = Math.max(from, seriesStart);
  const hi = until === null ? to : Math.min(to, until);
  if (hi < lo) return [];
  const out: number[] = [];

  const stepping = (interval: number) => {
    if (!Number.isInteger(interval) || interval < 1) return;
    let d = seriesStart + Math.ceil((lo - seriesStart) / interval) * interval;
    for (; d <= hi; d += interval) out.push(d);
  };

  switch (rule.kind) {
    case "none":
      if (seriesStart >= lo && seriesStart <= hi) out.push(seriesStart);
      break;
    case "everyDays":
      stepping(rule.interval);
      break;
    case "weekly": {
      const def = ctx.calendar(rule.calendarId);
      if (def) stepping(rule.interval * weekLength(def));
      break;
    }
    case "weekday": {
      const def = ctx.calendar(rule.calendarId);
      const target = def?.weekdays.findIndex((w) => w.id === rule.weekdayId) ?? -1;
      if (!def || target < 0) break;
      for (let d = lo; d <= hi; d++) if (weekdayIndex(def, fromWorldDay(def, d)) === target) out.push(d);
      break;
    }
    case "monthly":
    case "annual": {
      const def = ctx.calendar(rule.calendarId);
      if (!def || !Number.isInteger(rule.interval) || rule.interval < 1) break;
      const source = fromWorldDay(def, seriesStart);
      const sourceMonth = monthOrdinal(def, source);
      const sourceYear = toInternalYear(def, source.year);
      const last = fromWorldDay(def, hi).year;
      for (let year = fromWorldDay(def, lo).year; ; year = nextYear(def, year)) {
        const internal = toInternalYear(def, year);
        if (rule.kind === "annual" && (internal - sourceYear < 0 || (internal - sourceYear) % rule.interval !== 0)) {
          if (year === last) break;
          continue;
        }
        for (const p of yearPeriods(def, internal)) {
          if (rule.kind === "annual" ? p.period.id !== rule.periodId : p.period.kind !== "month") continue;
          if (rule.kind === "monthly") {
            const n = monthOrdinal(def, { year, periodId: p.period.id, day: 1 }) - sourceMonth;
            if (n < 0 || n % rule.interval !== 0) continue;
          }
          const day = rule.day <= p.days ? rule.day : rule.missing === "last" ? p.days : null;
          if (day === null) continue;
          const d = toWorldDay(def, { year, periodId: p.period.id, day });
          if (d >= lo && d <= hi) out.push(d);
        }
        if (year === last) break;
      }
      break;
    }
    case "condition":
      for (let d = lo; d <= hi; d++) {
        if (!groupHolds(rule.group, d, ctx)) continue;
        if (rule.trigger === "every" || !groupHolds(rule.group, d - 1, ctx)) out.push(d);
      }
      break;
  }
  return out;
}

export interface SeriesInput {
  worldDay: number;
  durationDays: number;
  recurrence: Recurrence;
  until: number | null;
  exceptions: Record<string, OccurrenceException>;
}

export interface Occurrence {
  /** The original start (stable occurrence key, even when moved). */
  key: number;
  start: number;
  /** Inclusive last day. */
  end: number;
  exception: OccurrenceException | null;
}

/** Occurrences overlapping [from, to]: carry-in from before `from` included, cancelled ones left out, moved ones at their new day. */
export function expandSeries(series: SeriesInput, from: number, to: number, ctx: EvalContext): Occurrence[] {
  const duration = Math.min(MAX_DURATION_DAYS, Math.max(1, series.durationDays));
  const lookFrom = from - (duration - 1);
  checkRange(lookFrom, to);
  const occurrences: Occurrence[] = [];
  const seen = new Set<number>();
  for (const key of occurrenceStarts(series.recurrence, series.worldDay, series.until, lookFrom, to, ctx)) {
    seen.add(key);
    const exception = series.exceptions[String(key)] ?? null;
    if (exception?.cancelled) continue;
    const start = exception?.moveTo ?? key;
    const end = start + duration - 1;
    if (end >= from && start <= to) occurrences.push({ key, start, end, exception });
  }
  // An occurrence moved INTO the range from outside it.
  for (const [rawKey, exception] of Object.entries(series.exceptions)) {
    const key = Number(rawKey);
    if (seen.has(key) || exception.cancelled || exception.moveTo === undefined) continue;
    const end = exception.moveTo + duration - 1;
    if (end >= from && exception.moveTo <= to) occurrences.push({ key, start: exception.moveTo, end, exception });
  }
  return occurrences.sort((a, b) => a.start - b.start);
}

/** Readable summary of a rule for lists ("Every 3 days", "Annually on 1 Alder"). */
export function describeRecurrence(rule: Recurrence, ctx: Pick<EvalContext, "calendar">): string {
  switch (rule.kind) {
    case "none":
      return "Once";
    case "everyDays":
      return rule.interval === 1 ? "Every day" : `Every ${rule.interval} days`;
    case "weekly": {
      const def = ctx.calendar(rule.calendarId);
      const len = def ? weekLength(def) : 7;
      return rule.interval === 1 ? `Every week (${len} days)` : `Every ${rule.interval} weeks (${rule.interval * len} days)`;
    }
    case "weekday": {
      const name = ctx.calendar(rule.calendarId)?.weekdays.find((w) => w.id === rule.weekdayId)?.name ?? "a removed weekday";
      return `Every ${name}`;
    }
    case "monthly":
      return `${rule.interval === 1 ? "Monthly" : `Every ${rule.interval} months`} on day ${rule.day}${rule.missing === "last" ? " (or the last day)" : ""}`;
    case "annual": {
      const period = ctx.calendar(rule.calendarId)?.periods.find((p) => p.id === rule.periodId)?.name ?? "a removed month";
      return `${rule.interval === 1 ? "Annually" : `Every ${rule.interval} years`} on ${rule.day} ${period}${rule.missing === "last" ? " (or its last day)" : ""}`;
    }
    case "condition":
      return `${rule.trigger === "enter" ? "When" : "Every day"} ${rule.group.match === "all" ? "all" : "any"} of ${rule.group.conditions.length} condition${rule.group.conditions.length === 1 ? "" : "s"} ${rule.trigger === "enter" ? "become true" : "hold"}`;
  }
}
