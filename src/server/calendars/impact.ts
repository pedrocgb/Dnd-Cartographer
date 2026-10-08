/**
 * Structural-change impact (pure). Before a calendar definition changes,
 * this compares the old and new definitions over the world's records:
 *
 * - Preserve Physical Day (default): every record keeps its worldDay; only
 *   its label in this calendar may change. Never invalid.
 * - Preserve Named Dates: a record keeps its old label in this calendar and
 *   its worldDay is recalculated — which can be impossible (the date no
 *   longer exists), and then needs an explicit resolution.
 *
 * The shared current day never moves. Rules/profiles/schedules pointing at
 * removed months or weekdays are reported (they must be acknowledged; they
 * are kept, never deleted).
 */
import { formatDate, fromWorldDay, problemOf, toWorldDay, weekdayIndex, type CalendarDefinition, type LocalDate, type Problem } from "./engine";
import type { CelestialConfig } from "./celestial";
import { profileIssues, type SeasonProfileData } from "./seasons";
import type { Condition, OccurrenceException, Recurrence } from "./recurrence";

export interface ImpactEntry {
  id: string;
  title: string;
  worldDay: number;
  recurrence: Recurrence;
  exceptions: Record<string, OccurrenceException>;
}

export interface EntryImpact {
  id: string;
  title: string;
  before: string;
  /** Label after the change when the physical day is kept. */
  afterPhysical: string;
  /** Preserve Named Dates: the new worldDay, or why the date no longer exists. */
  named: { worldDay: number; label: string } | { error: Problem };
}

export interface Impact {
  currentDay: { before: string; after: string };
  entries: EntryImpact[];
  /** Entries whose label or named day changes, before capping `entries`. */
  entryCount: number;
  references: Problem[];
  /** Nothing changes for any record, and no reference breaks. */
  harmless: boolean;
}

const MAX_LISTED = 300;

export function safeLabel(def: CalendarDefinition, worldDay: number): string {
  try {
    const date = fromWorldDay(def, worldDay);
    const w = weekdayIndex(def, date);
    return `${w === null ? "" : `${def.weekdays[w].name}, `}${formatDate(def, date)}`;
  } catch (e) {
    return `(${(e as Error).message})`;
  }
}

/** The worldDay the same named date has under `next`, or an error. */
export function namedDay(prev: CalendarDefinition, next: CalendarDefinition, worldDay: number): { worldDay: number; date: LocalDate } | { error: Problem } {
  try {
    const date = fromWorldDay(prev, worldDay);
    return { worldDay: toWorldDay(next, date), date };
  } catch (e) {
    return { error: problemOf(e) };
  }
}

function conditionRefs(c: Condition, calendarId: string, next: CalendarDefinition): Problem | null {
  if (c.type === "weekday" && c.calendarId === calendarId && !next.weekdays.some((w) => w.id === c.weekdayId)) return { key: "problem.conditionWeekday" };
  if (c.type === "period" && c.calendarId === calendarId && !next.periods.some((p) => p.id === c.periodId)) return { key: "problem.conditionMonth" };
  return null;
}

/** Why a repeat rule stops working under `next` (a verb phrase about the event), or null. */
export function recurrenceBreak(rule: Recurrence, calendarId: string, next: CalendarDefinition): Problem | null {
  if (rule.kind === "weekday" && rule.calendarId === calendarId && !next.weekdays.some((w) => w.id === rule.weekdayId)) return { key: "problem.removedWeekday" };
  if (rule.kind === "annual" && rule.calendarId === calendarId && !next.periods.some((p) => p.id === rule.periodId)) return { key: "problem.removedMonth" };
  if (rule.kind === "condition") {
    for (const c of rule.group.conditions) {
      const problem = conditionRefs(c, calendarId, next);
      if (problem) return problem;
    }
  }
  return null;
}

export interface ImpactInput {
  calendarId: string;
  prev: CalendarDefinition;
  next: CalendarDefinition;
  currentDay: number;
  entries: ImpactEntry[];
  profiles: { id: string; name: string; calendarId: string; data: Omit<SeasonProfileData, "calendarId"> }[];
  celestial: { id: string; name: string; config: CelestialConfig }[];
  seasonName: (id: string) => string;
}

export function calendarImpact(input: ImpactInput): Impact {
  const { calendarId, prev, next } = input;
  const entries: EntryImpact[] = [];
  for (const e of input.entries) {
    const before = safeLabel(prev, e.worldDay);
    const afterPhysical = safeLabel(next, e.worldDay);
    const moved = namedDay(prev, next, e.worldDay);
    const named = "error" in moved ? { error: moved.error } : { worldDay: moved.worldDay, label: safeLabel(next, moved.worldDay) };
    if (before !== afterPhysical || !("worldDay" in named) || named.worldDay !== e.worldDay) entries.push({ id: e.id, title: e.title, before, afterPhysical, named });
  }

  const references: Problem[] = [];
  for (const e of input.entries) {
    const problem = recurrenceBreak(e.recurrence, calendarId, next);
    if (problem) references.push({ key: "problem.refEvent", params: { title: e.title || { key: "untitled" }, problem } });
  }
  for (const p of input.profiles.filter((p) => p.calendarId === calendarId)) {
    for (const issue of profileIssues(next, { ...p.data, calendarId }, input.seasonName)) {
      if (issue.kind === "invalid") references.push({ key: "problem.refProfile", params: { name: p.name, problem: issue.problem } });
    }
  }
  for (const o of input.celestial) {
    for (const s of o.config.schedules ?? []) {
      if (s.kind !== "annual" || s.calendarId !== calendarId) continue;
      const missing = [s.start, s.end].some((md) => !next.periods.some((p) => p.id === md.periodId && !p.condition && md.day <= p.days));
      if (missing) references.push({ key: "problem.refCelestial", params: { name: o.name } });
    }
  }

  const currentDay = { before: safeLabel(prev, input.currentDay), after: safeLabel(next, input.currentDay) };
  return {
    currentDay,
    entries: entries.slice(0, MAX_LISTED),
    entryCount: entries.length,
    references,
    harmless: entries.length === 0 && references.length === 0,
  };
}

/** Preserve Named Dates for one entry: its new start and re-keyed exceptions (errors stay at the physical day). */
export function shiftEntryNamed(prev: CalendarDefinition, next: CalendarDefinition, entry: Pick<ImpactEntry, "worldDay" | "exceptions">) {
  const shift = (day: number) => {
    const r = namedDay(prev, next, day);
    return "error" in r ? day : r.worldDay;
  };
  const exceptions: Record<string, OccurrenceException> = {};
  for (const [key, ex] of Object.entries(entry.exceptions)) {
    exceptions[String(shift(Number(key)))] = ex.moveTo === undefined ? ex : { ...ex, moveTo: shift(ex.moveTo) };
  }
  return { worldDay: shift(entry.worldDay), exceptions };
}
