/**
 * Client-side evaluation over the loaded world data. Everything derives
 * from the shared physical day (worldDay); the displayed calendar only
 * labels it. Pure functions — no fetching.
 */
import { activeSettings } from "@/server/settings/active";
import {
  formatDate,
  fromWorldDay,
  toInternalYear,
  toWorldDay,
  weekdayIndex,
  yearPeriods,
  type CalendarDefinition,
  type LocalDate,
} from "@/server/calendars/engine";
import { evaluateCelestial, nextYear, previousYear, type ActiveState } from "@/server/calendars/celestial";
import { activeSeasons } from "@/server/calendars/seasons";
import { expandSeries, type EvalContext, type Occurrence } from "@/server/calendars/recurrence";
import type { ClientCelestial, ClientEntry, ClientProfile, WorldCalendars } from "./types";

export function evalContext(world: WorldCalendars): EvalContext {
  const defs = new Map(world.calendars.map((c) => [c.id, c.definition]));
  const profiles = new Map(world.profiles.map((p) => [p.id, p]));
  const objects = new Map(world.celestial.map((o) => [o.id, o]));
  const calendar = (id: string) => defs.get(id) ?? null;
  return {
    calendar,
    seasonsOn: (profileId, worldDay) => {
      const p = profiles.get(profileId);
      const def = p ? defs.get(p.data.calendarId) : null;
      return p && def ? safe(() => activeSeasons(def, p.data, worldDay), []) : [];
    },
    celestialOn: (objectId, worldDay) => {
      const o = objects.get(objectId);
      return o ? evaluateCelestial(o.type, o.config, worldDay, calendar).map((s) => s.id) : [];
    },
  };
}

export function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** "W3, 12 Alder 1024 AR" (weekday omitted outside the week), in the user's world date format. */
export function dayLabel(def: CalendarDefinition, worldDay: number, { weekday = true, short = false } = {}): string {
  return safe(() => {
    const date = fromWorldDay(def, worldDay);
    const w = weekday ? weekdayIndex(def, date) : null;
    return `${w === null ? "" : `${def.weekdays[w].name}, `}${formatDate(def, date, { short, format: activeSettings().worldDateFormat })}`;
  }, "Outside the supported range");
}

export interface MonthCell {
  worldDay: number;
  day: number;
  /** Weekday column, or null for a day outside the week. */
  weekday: number | null;
}

export interface MonthBlock {
  periodId: string;
  name: string;
  special: boolean;
  /** Rows of cells; each row a week (null = padding). Out-of-week days form their own strip. */
  rows: (MonthCell | null)[][];
  outOfWeek: MonthCell[];
}

/** The grid of one period in one display year. */
export function monthBlock(def: CalendarDefinition, year: number, periodId: string): MonthBlock | null {
  return safe(() => {
    const entry = yearPeriods(def, toInternalYear(def, year)).find((p) => p.period.id === periodId);
    if (!entry) return null;
    const first = toWorldDay(def, { year, periodId, day: 1 });
    const cols = def.weekdays.length || 10;
    const cells: MonthCell[] = [];
    for (let d = 1; d <= entry.days; d++) {
      const date = { year, periodId, day: d };
      cells.push({ worldDay: first + d - 1, day: d, weekday: def.weekdays.length ? weekdayIndex(def, date) : null });
    }
    const inWeek = cells.filter((c) => c.weekday !== null || def.weekdays.length === 0);
    const rows: (MonthCell | null)[][] = [];
    let row: (MonthCell | null)[] = [];
    for (const cell of inWeek) {
      const col = cell.weekday ?? row.length;
      if (def.weekdays.length && row.length > col) {
        rows.push(fill(row, cols));
        row = [];
      }
      while (def.weekdays.length && row.length < col) row.push(null);
      row.push(cell);
      if (row.length === cols) {
        rows.push(row);
        row = [];
      }
    }
    if (row.length) rows.push(fill(row, cols));
    return {
      periodId,
      name: entry.period.name,
      special: entry.period.kind === "special",
      rows,
      outOfWeek: def.weekdays.length ? cells.filter((c) => c.weekday === null) : [],
    };
  }, null);
}

const fill = (row: (MonthCell | null)[], cols: number) => [...row, ...Array<null>(Math.max(0, cols - row.length)).fill(null)];

/** Periods of a display year, in order (conditional ones only when they occur). */
export function periodsOf(def: CalendarDefinition, year: number) {
  return safe(() => yearPeriods(def, toInternalYear(def, year)), []);
}

/** The period after/before `date`'s period (crossing years). */
export function stepPeriod(def: CalendarDefinition, year: number, periodId: string, delta: 1 | -1): { year: number; periodId: string } {
  const list = periodsOf(def, year);
  const i = list.findIndex((p) => p.period.id === periodId);
  if (i >= 0 && list[i + delta]) return { year, periodId: list[i + delta].period.id };
  const y = delta === 1 ? nextYear(def, year) : previousYear(def, year);
  const next = periodsOf(def, y);
  const target = delta === 1 ? next[0] : next.at(-1);
  return { year: y, periodId: target?.period.id ?? periodId };
}

export function stepYear(def: CalendarDefinition, year: number, delta: 1 | -1) {
  return delta === 1 ? nextYear(def, year) : previousYear(def, year);
}

/** Inclusive worldDay range of a period / a year. */
export function periodRange(def: CalendarDefinition, year: number, periodId: string): [number, number] | null {
  return safe(() => {
    const entry = periodsOf(def, year).find((p) => p.period.id === periodId);
    if (!entry) return null;
    const first = toWorldDay(def, { year, periodId, day: 1 });
    return [first, first + entry.days - 1] as [number, number];
  }, null);
}

export function yearRange(def: CalendarDefinition, year: number): [number, number] | null {
  const list = periodsOf(def, year);
  if (!list.length) return null;
  const a = periodRange(def, year, list[0].period.id);
  const b = periodRange(def, year, list.at(-1)!.period.id);
  return a && b ? [a[0], b[1]] : null;
}

export const localOf = (def: CalendarDefinition, worldDay: number): LocalDate | null => safe(() => fromWorldDay(def, worldDay), null);

export interface DayOccurrence {
  entry: ClientEntry;
  occurrence: Occurrence;
}

/** Every occurrence of the loaded entries overlapping [from, to]. */
export function occurrencesIn(entries: ClientEntry[], from: number, to: number, ctx: EvalContext): DayOccurrence[] {
  const out: DayOccurrence[] = [];
  for (const entry of entries) {
    const occurrences = safe(
      () =>
        expandSeries(
          { worldDay: entry.worldDay, durationDays: entry.durationDays, recurrence: entry.recurrence, until: entry.untilDay, exceptions: entry.exceptions },
          from,
          to,
          ctx
        ),
      []
    );
    for (const occurrence of occurrences) out.push({ entry, occurrence });
  }
  return out;
}

/** Occurrences grouped by each day they cover within [from, to]. */
export function byDay(list: DayOccurrence[], from: number, to: number): Map<number, DayOccurrence[]> {
  const map = new Map<number, DayOccurrence[]>();
  for (const item of list) {
    for (let d = Math.max(from, item.occurrence.start); d <= Math.min(to, item.occurrence.end); d++) {
      const bucket = map.get(d);
      if (bucket) bucket.push(item);
      else map.set(d, [item]);
    }
  }
  return map;
}

/** Whether a celestial object belongs to a calendar's sky. */
export const inCalendar = (object: Pick<ClientCelestial, "calendarIds">, calendarId: string) => object.calendarIds === null || object.calendarIds.includes(calendarId);

export function celestialStates(objects: ClientCelestial[], worldDay: number, ctx: EvalContext): { object: ClientCelestial; states: ActiveState[] }[] {
  return objects.map((object) => ({ object, states: safe(() => evaluateCelestial(object.type, object.config, worldDay, ctx.calendar), []) }));
}

export function profileSeasons(profile: ClientProfile | null, worldDay: number, ctx: EvalContext): string[] {
  return profile ? ctx.seasonsOn(profile.id, worldDay) : [];
}

export const occurrenceTitle = (item: DayOccurrence) => item.occurrence.exception?.title ?? item.entry.title;
