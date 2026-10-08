/**
 * Celestial evaluation (pure). Objects live at world scope and are
 * evaluated from the shared worldDay, so every calendar sees the same
 * physical state; a calendar only changes labels / visibility.
 *
 * Moons: ordered phases with whole-day durations (their sum is the cycle),
 * anchored to a worldDay that starts a chosen phase. "Restart cycle"
 * appends an effective-dated segment (history before it is untouched).
 * Dated overrides replace the phase over an inclusive range, after which
 * the unchanged base cycle resumes. Other types carry named states and
 * appearance schedules (periodic, annual in a reference calendar, one-off
 * with optional repetition).
 */
import { fromWorldDay, nextYear, previousYear, toWorldDay, type CalendarDefinition, type LocalDate, type Problem } from "./engine";
import { MAX_RANGE_DAYS, occurrenceStarts, type Recurrence } from "./recurrence";
import { activeT } from "../../i18n/active";
import type { MessageKey } from "../../i18n/messages";

export { nextYear, previousYear };

export type CelestialType = "moon" | "sun" | "star" | "constellation" | "planet" | "comet" | "custom";

export interface MoonPhase {
  id: string;
  name: string;
  /** Short symbol shown on day cells (text, e.g. "◐"). */
  icon: string;
  days: number;
}

/** From `fromWorldDay` on, the cycle restarts with `phaseId` on that day. */
export interface CycleSegment {
  id: string;
  fromWorldDay: number;
  phaseId: string;
}

/** Inclusive worldDay range showing `stateId` (a phase id for moons). */
export interface StateOverride {
  id: string;
  start: number;
  end: number;
  stateId: string;
}

export interface CelestialState {
  id: string;
  name: string;
  icon: string;
}

export type AppearanceSchedule =
  | { id: string; stateId: string; kind: "cycle"; anchorWorldDay: number; every: number; duration: number }
  | { id: string; stateId: string; kind: "annual"; calendarId: string; start: { periodId: string; day: number }; end: { periodId: string; day: number } }
  | {
      id: string;
      stateId: string;
      kind: "once";
      startWorldDay: number;
      duration: number;
      /** Null: never comes back. Otherwise every N `repeatUnit`s (days by default). */
      repeatEvery: number | null;
      /** Months and years follow `repeatCalendarId` (same day of the month; the month's last day when it's shorter). */
      repeatUnit?: RepeatUnit;
      repeatCalendarId?: string | null;
      /** Day repeats only: it also happened before the start date (the date is just one appearance of an endless cycle). */
      alsoBefore?: boolean;
    };

export type RepeatUnit = "days" | "months" | "years";

export interface CelestialConfig {
  /** Moons. */
  phases?: MoonPhase[];
  /** The base cycle: `phaseId` begins on `worldDay`. */
  anchor?: { worldDay: number; phaseId: string };
  segments?: CycleSegment[];
  /** Other types: their named states and when they apply. */
  states?: CelestialState[];
  schedules?: AppearanceSchedule[];
  overrides?: StateOverride[];
}

export interface ActiveState {
  id: string;
  name: string;
  icon: string;
  /** Came from a dated override rather than the base cycle / schedule. */
  override: boolean;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

export const cycleTotal = (phases: readonly MoonPhase[]) => phases.reduce((n, p) => n + p.days, 0);

/** The base-cycle phase of a moon on `worldDay` (overrides not applied), or null when it has no cycle. */
export function basePhase(config: CelestialConfig, worldDay: number): MoonPhase | null {
  const phases = config.phases ?? [];
  const total = cycleTotal(phases);
  if (!config.anchor || phases.length === 0 || total <= 0) return null;
  // The latest restart at or before the day wins; the original anchor is the first segment.
  let segment = { fromWorldDay: config.anchor.worldDay, phaseId: config.anchor.phaseId };
  for (const s of config.segments ?? []) if (s.fromWorldDay <= worldDay && s.fromWorldDay >= segment.fromWorldDay) segment = s;
  const startIndex = Math.max(0, phases.findIndex((p) => p.id === segment.phaseId));
  const phaseStartOffset = phases.slice(0, startIndex).reduce((n, p) => n + p.days, 0);
  const position = mod(worldDay - segment.fromWorldDay + phaseStartOffset, total);
  let acc = 0;
  for (const phase of phases) {
    acc += phase.days;
    if (position < acc) return phase;
  }
  return phases.at(-1)!;
}

function overrideOn(config: CelestialConfig, worldDay: number): StateOverride | null {
  return (config.overrides ?? []).find((o) => o.start <= worldDay && worldDay <= o.end) ?? null;
}

/** Overlapping overrides for the same object are rejected (storage order never decides). */
export function overrideOverlap(overrides: readonly StateOverride[]): StateOverride[] | null {
  const sorted = [...overrides].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) if (sorted[i].start <= sorted[i - 1].end) return [sorted[i - 1], sorted[i]];
  return null;
}

export type CalendarResolver = (calendarId: string) => CalendarDefinition | null;

/** Whether an annual schedule (inclusive start..end, wrapping past the year end) covers `worldDay`, read in its own calendar. */
export function annualWindowCovers(
  def: CalendarDefinition,
  start: { periodId: string; day: number },
  end: { periodId: string; day: number },
  worldDay: number
): boolean {
  const today = fromWorldDay(def, worldDay);
  for (const startYear of [today.year - 1, today.year]) {
    const interval = annualInterval(def, startYear, start, end);
    if (interval && interval[0] <= worldDay && worldDay <= interval[1]) return true;
  }
  return false;
}

/** The inclusive worldDay interval of an annual start..end beginning in `displayYear` (end rolls into the next year when it comes first). */
export function annualInterval(
  def: CalendarDefinition,
  displayYear: number,
  start: { periodId: string; day: number },
  end: { periodId: string; day: number }
): [number, number] | null {
  try {
    const from = toWorldDay(def, { year: displayYear, ...start } as LocalDate);
    let to = toWorldDay(def, { year: displayYear, ...end } as LocalDate);
    if (to < from) to = toWorldDay(def, { year: nextYear(def, displayYear), ...end } as LocalDate);
    return [from, to];
  } catch {
    return null; // a boundary missing that year (validation normally prevents it)
  }
}

/** An old "cycle" rule as the equivalent repeating rule (same days shown). */
export function normalizeSchedule(s: AppearanceSchedule): AppearanceSchedule {
  if (s.kind !== "cycle") return s;
  return { id: s.id, stateId: s.stateId, kind: "once", startWorldDay: s.anchorWorldDay, duration: s.duration, repeatEvery: s.every, repeatUnit: "days", repeatCalendarId: null, alsoBefore: true };
}

const runsBackwards = (s: Extract<AppearanceSchedule, { kind: "once" }>) => Boolean(s.alsoBefore) && s.repeatEvery !== null && (s.repeatUnit ?? "days") === "days";

/** The calendar rule a months/years return follows, or null for days / no return. */
function returnRule(schedule: Extract<AppearanceSchedule, { kind: "once" }>, calendars: CalendarResolver): { rule: Recurrence; def: CalendarDefinition } | null {
  const unit = schedule.repeatUnit ?? "days";
  if (schedule.repeatEvery === null || unit === "days" || !schedule.repeatCalendarId) return null;
  const def = calendars(schedule.repeatCalendarId);
  if (!def) return null;
  const date = fromWorldDay(def, schedule.startWorldDay);
  const rule: Recurrence =
    unit === "months"
      ? { kind: "monthly", calendarId: schedule.repeatCalendarId, interval: schedule.repeatEvery, day: date.day, missing: "last" }
      : { kind: "annual", calendarId: schedule.repeatCalendarId, interval: schedule.repeatEvery, periodId: date.periodId, day: date.day, missing: "last" };
  return { rule, def };
}

/**
 * First days of a schedule's appearances within [from, to] (inclusive,
 * ascending), at most `limit`. Bounded: calendar-based returns are
 * evaluated in MAX_RANGE_DAYS chunks, never day by day across all time.
 */
export function scheduleStarts(schedule: AppearanceSchedule, from: number, to: number, calendars: CalendarResolver, limit = Infinity): number[] {
  const out: number[] = [];
  const stepping = (anchor: number, every: number, lo: number) => {
    if (!Number.isInteger(every) || every < 1) return;
    for (let d = anchor + Math.ceil((lo - anchor) / every) * every; d <= to && out.length < limit; d += every) out.push(d);
  };
  if (to < from) return out;
  if (schedule.kind === "cycle") stepping(schedule.anchorWorldDay, schedule.every, from);
  else if (schedule.kind === "once") {
    const lo = runsBackwards(schedule) ? from : Math.max(from, schedule.startWorldDay);
    const calendarReturn = returnRule(schedule, calendars);
    if (schedule.repeatEvery === null) {
      if (schedule.startWorldDay >= from && schedule.startWorldDay <= to) out.push(schedule.startWorldDay);
    } else if (!calendarReturn) {
      if ((schedule.repeatUnit ?? "days") === "days") stepping(schedule.startWorldDay, schedule.repeatEvery, lo);
    } else {
      const ctx = { calendar: () => calendarReturn.def, seasonsOn: () => [], celestialOn: () => [] };
      for (let a = lo; a <= to && out.length < limit; a += MAX_RANGE_DAYS) {
        for (const d of occurrenceStarts(calendarReturn.rule, schedule.startWorldDay, null, a, Math.min(to, a + MAX_RANGE_DAYS - 1), ctx)) {
          if (out.length < limit) out.push(d);
        }
      }
    }
  } else {
    const def = calendars(schedule.calendarId);
    if (!def) return out;
    const last = fromWorldDay(def, to).year;
    for (let y = previousYear(def, fromWorldDay(def, from).year); out.length < limit; y = nextYear(def, y)) {
      const interval = annualInterval(def, y, schedule.start, schedule.end);
      if (interval && interval[0] >= from && interval[0] <= to) out.push(interval[0]);
      if (y === last) break;
    }
  }
  return out;
}

function scheduleCovers(schedule: AppearanceSchedule, worldDay: number, calendars: CalendarResolver): boolean {
  if (schedule.kind === "cycle") return schedule.every > 0 && mod(worldDay - schedule.anchorWorldDay, schedule.every) < schedule.duration;
  if (schedule.kind === "once") {
    if (runsBackwards(schedule)) return mod(worldDay - schedule.startWorldDay, schedule.repeatEvery!) < schedule.duration;
    if (worldDay < schedule.startWorldDay) return false;
    const since = worldDay - schedule.startWorldDay;
    if (schedule.repeatEvery === null) return since < schedule.duration;
    if ((schedule.repeatUnit ?? "days") === "days") return since % schedule.repeatEvery < schedule.duration;
    // A calendar-based return: some appearance started within the last `duration` days.
    return scheduleStarts(schedule, worldDay - schedule.duration + 1, worldDay, calendars, 1).length > 0;
  }
  const def = calendars(schedule.calendarId);
  return def ? annualWindowCovers(def, schedule.start, schedule.end, worldDay) : false;
}

/** The states an object shows on `worldDay` (a moon: its one phase). Lore-only objects return none. */
export function evaluateCelestial(type: CelestialType, config: CelestialConfig, worldDay: number, calendars: CalendarResolver): ActiveState[] {
  const override = overrideOn(config, worldDay);
  if (type === "moon") {
    const phases = config.phases ?? [];
    if (override) {
      const phase = phases.find((p) => p.id === override.stateId);
      if (phase) return [{ id: phase.id, name: phase.name, icon: phase.icon, override: true }];
    }
    const phase = basePhase(config, worldDay);
    return phase ? [{ id: phase.id, name: phase.name, icon: phase.icon, override: false }] : [];
  }
  const states = config.states ?? [];
  if (override) {
    const state = states.find((s) => s.id === override.stateId);
    if (state) return [{ ...state, override: true }];
  }
  const active = new Set((config.schedules ?? []).filter((s) => scheduleCovers(s, worldDay, calendars)).map((s) => s.stateId));
  return states.filter((s) => active.has(s.id)).map((s) => ({ ...s, override: false }));
}

export interface PhaseSpan {
  phaseId: string;
  name: string;
  icon: string;
  /** Inclusive worldDays. */
  start: number;
  end: number;
}

/** Consecutive phase spans of a moon over [from, to] (overrides applied), for previews and "next Full Moon". */
export function phaseSpans(config: CelestialConfig, from: number, to: number): PhaseSpan[] {
  const spans: PhaseSpan[] = [];
  for (let d = from; d <= to; d++) {
    const [state] = evaluateCelestial("moon", config, d, () => null);
    if (!state) continue;
    const last = spans.at(-1);
    if (last && last.phaseId === state.id && last.end === d - 1) last.end = d;
    else spans.push({ phaseId: state.id, name: state.name, icon: state.icon, start: d, end: d });
  }
  return spans;
}

/** The first day on or after `from` (within `horizon` days) starting phase `phaseId`, or null. */
export function nextPhaseStart(config: CelestialConfig, phaseId: string, from: number, horizon = 2000): number | null {
  let previous = evaluateCelestial("moon", config, from - 1, () => null)[0]?.id;
  for (let d = from; d <= from + horizon; d++) {
    const id = evaluateCelestial("moon", config, d, () => null)[0]?.id;
    if (id === phaseId && previous !== phaseId) return d;
    previous = id;
  }
  return null;
}

/** The common eight phases, as names and symbols (durations are generated from the cycle length). */
/** A preset phase; its `name` is worded on read, in the active language (new moons are seeded with it). */
const phase = (key: string, icon: string) => ({
  icon,
  get name() {
    return activeT("calendars")(`phase.${key}` as MessageKey<"calendars">);
  },
});

export const EIGHT_PHASES: readonly { name: string; icon: string }[] = [
  phase("newMoon", "●"),
  phase("waxingCrescent", "◔"),
  phase("firstQuarter", "◑"),
  phase("waxingGibbous", "◕"),
  phase("fullMoon", "○"),
  phase("waningGibbous", "◕"),
  phase("lastQuarter", "◐"),
  phase("waningCrescent", "◔"),
];

export const FOUR_PHASES: readonly { name: string; icon: string }[] = [phase("newMoon", "●"), phase("waxing", "◑"), phase("fullMoon", "○"), phase("waning", "◐")];

export const ONE_PHASE: readonly { name: string; icon: string }[] = [phase("moon", "○")];

/**
 * Whole-day durations for `count` phases summing to `cycle` (the remainder
 * spread from the first phase). Null when the cycle is shorter than the
 * phase count — ask for fewer phases or a longer cycle, never 0-day phases.
 */
export function splitCycle(cycle: number, count: number): number[] | null {
  if (!Number.isInteger(cycle) || !Number.isInteger(count) || count < 1 || cycle < count) return null;
  const base = Math.floor(cycle / count);
  const extra = cycle - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Problems with a celestial config (empty when valid); `problemText` words them. */
export function celestialIssues(type: CelestialType, config: CelestialConfig): Problem[] {
  const issues: Problem[] = [];
  if (type === "moon" && (config.phases?.length ?? 0) > 0) {
    const ids = new Set<string>();
    for (const p of config.phases!) {
      if (!p.name.trim()) issues.push({ key: "celIssue.phaseName" });
      if (!Number.isInteger(p.days) || p.days < 1) issues.push({ key: "celIssue.phaseDays", params: { phase: p.name || { key: "celIssue.aPhase" } } });
      if (ids.has(p.id)) issues.push({ key: "celIssue.phaseIdTwice" });
      ids.add(p.id);
    }
    if (!config.anchor) issues.push({ key: "celIssue.anchorPick" });
    else if (!ids.has(config.anchor.phaseId)) issues.push({ key: "celIssue.anchorGone" });
    for (const s of config.segments ?? []) if (!ids.has(s.phaseId)) issues.push({ key: "celIssue.restartGone" });
  }
  const stateIds = new Set(type === "moon" ? (config.phases ?? []).map((p) => p.id) : (config.states ?? []).map((s) => s.id));
  for (const o of config.overrides ?? []) {
    if (o.end < o.start) issues.push({ key: "celIssue.overrideOrder" });
    if (!stateIds.has(o.stateId)) issues.push({ key: "celIssue.overrideGone" });
  }
  const overlap = overrideOverlap(config.overrides ?? []);
  if (overlap) issues.push({ key: "celIssue.overlap" });
  for (const s of config.schedules ?? []) {
    if (!stateIds.has(s.stateId)) issues.push({ key: "celIssue.scheduleGone" });
    if (s.kind === "cycle" && (!Number.isInteger(s.every) || s.every < 1 || !Number.isInteger(s.duration) || s.duration < 1 || s.duration > s.every)) {
      issues.push({ key: "celIssue.cycle" });
    }
    const unit = s.kind === "once" ? (s.repeatUnit ?? "days") : "days";
    if (s.kind === "once" && s.repeatEvery !== null && unit !== "days" && !s.repeatCalendarId) issues.push({ key: "celIssue.returnCalendar" });
    if (s.kind === "once" && (!Number.isInteger(s.duration) || s.duration < 1 || (s.repeatEvery !== null && (!Number.isInteger(s.repeatEvery) || s.repeatEvery < 1 || (unit === "days" && s.repeatEvery < s.duration))))) {
      issues.push({ key: "celIssue.once" });
    }
  }
  return issues;
}
