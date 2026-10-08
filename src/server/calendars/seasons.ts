/**
 * Season profiles (pure). A profile is schedule data with no geography:
 * its annual boundaries are read in the profile's own reference calendar,
 * converted to worldDay intervals, and evaluated at any shared day. Which
 * region follows which profile is owned by the article (its Season Profile
 * field), never inferred here.
 *
 * Boundaries are inclusive in the UI and must exist every year (no
 * conditional months, no leap-only days). An end before the start wraps
 * into the next year. Sequential profiles derive each end as the day before
 * the next season starts (the last wraps to the first).
 */
import { annualInterval, previousYear } from "./celestial";
import { fromWorldDay, problemText, toInternalYear, yearPeriods, type CalendarDefinition, type Problem } from "./engine";

export interface MonthDay {
  periodId: string;
  day: number;
}

export interface SeasonMembership {
  id: string;
  seasonId: string;
  start: MonthDay;
  /** Manual mode only (sequential derives it). */
  end: MonthDay | null;
  /** The whole year, regardless of boundaries. */
  allYear?: boolean;
}

export interface SeasonProfileData {
  calendarId: string;
  mode: "sequential" | "manual";
  allowGaps: boolean;
  allowOverlaps: boolean;
  memberships: SeasonMembership[];
}

/** Position of a month/day within a year (for ordering boundaries). */
function positionInYear(def: CalendarDefinition, internalYear: number, md: MonthDay): number | null {
  let n = 0;
  for (const p of yearPeriods(def, internalYear)) {
    if (p.period.id === md.periodId) return md.day <= p.days ? n + md.day - 1 : null;
    n += p.days;
  }
  return null;
}

/**
 * The day before `md` among the every-year periods, for DISPLAY of a
 * sequential season's end ("until the next season begins" — leap days at
 * the end of the previous month still belong to it; evaluation uses starts).
 */
function dayBefore(def: CalendarDefinition, md: MonthDay): MonthDay {
  const periods = def.periods.filter((p) => !p.condition);
  const index = periods.findIndex((p) => p.id === md.periodId);
  if (md.day > 1 || index < 0) return { periodId: md.periodId, day: Math.max(1, md.day - 1) };
  const previous = periods[(index - 1 + periods.length) % periods.length];
  return { periodId: previous.id, day: previous.days };
}

/** Memberships with their effective (displayed) ends — sequential mode derived, in start order. */
export function effectiveMemberships(def: CalendarDefinition, profile: SeasonProfileData): (SeasonMembership & { end: MonthDay })[] {
  if (profile.mode === "manual") return profile.memberships.map((m) => ({ ...m, end: m.end ?? m.start }));
  const sorted = [...profile.memberships].sort((a, b) => (positionInYear(def, 1, a.start) ?? 0) - (positionInYear(def, 1, b.start) ?? 0));
  if (sorted.length === 1) return [{ ...sorted[0], end: dayBefore(def, sorted[0].start), allYear: true }];
  return sorted.map((m, i) => ({ ...m, end: dayBefore(def, sorted[(i + 1) % sorted.length].start) }));
}

/** Season ids active on `worldDay`, in the profile's own calendar. */
export function activeSeasons(def: CalendarDefinition, profile: SeasonProfileData, worldDay: number): string[] {
  const year = fromWorldDay(def, worldDay).year;
  if (profile.mode === "sequential") {
    if (profile.memberships.length <= 1) return profile.memberships.map((m) => m.seasonId);
    // The season whose start is the latest on or before the day (last year's starts cover the wrap).
    let best: { day: number; seasonId: string } | null = null;
    for (const y of [previousYear(def, year), year]) {
      for (const m of profile.memberships) {
        const interval = annualInterval(def, y, m.start, m.start);
        if (interval && interval[0] <= worldDay && (!best || interval[0] > best.day)) best = { day: interval[0], seasonId: m.seasonId };
      }
    }
    return best ? [best.seasonId] : [];
  }
  const active: string[] = [];
  for (const m of effectiveMemberships(def, profile)) {
    if (m.allYear) {
      active.push(m.seasonId);
      continue;
    }
    for (const startYear of [previousYear(def, year), year]) {
      const interval = annualInterval(def, startYear, m.start, m.end);
      if (interval && interval[0] <= worldDay && worldDay <= interval[1]) {
        active.push(m.seasonId);
        break;
      }
    }
  }
  return [...new Set(active)];
}

export interface ProfileIssue {
  kind: "invalid" | "gap" | "overlap";
  problem: Problem;
  /** `problem` in the active language. */
  message: string;
}

const issue = (kind: ProfileIssue["kind"], problem: Problem): ProfileIssue => ({ kind, problem, message: problemText(problem) });

/**
 * Invalid boundaries, and gaps/overlaps across representative years (every
 * distinct year shape in the first cycle's worth of 400 years), unless the
 * profile allows them.
 */
export function profileIssues(def: CalendarDefinition, profile: SeasonProfileData, seasonName: (id: string) => string): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  const unconditional = def.periods.filter((p) => !p.condition);
  for (const m of profile.memberships) {
    for (const [label, md] of [["start", m.start], ["end", profile.mode === "manual" ? m.end : null]] as const) {
      if (!md || m.allYear) continue;
      const period = unconditional.find((p) => p.id === md.periodId);
      if (!period) issues.push(issue("invalid", { key: label === "start" ? "seasonIssue.startMonth" : "seasonIssue.endMonth", params: { season: seasonName(m.seasonId) } }));
      else if (!Number.isInteger(md.day) || md.day < 1 || md.day > period.days) {
        issues.push(issue("invalid", { key: "seasonIssue.day", params: { season: seasonName(m.seasonId), month: period.name, day: md.day, n: period.days } }));
      }
    }
  }
  if (issues.length || profile.memberships.length === 0) return issues;
  if (profile.mode === "sequential") {
    // Gap-free and overlap-free by construction; only two seasons starting the same day is ambiguous.
    const starts = new Set<string>();
    for (const m of profile.memberships) {
      const key = `${m.start.periodId}:${m.start.day}`;
      if (starts.has(key)) issues.push(issue("overlap", { key: "seasonIssue.sameStart", params: { season: seasonName(m.seasonId) } }));
      starts.add(key);
    }
    return issues;
  }

  // Coverage over each distinct year shape (common vs leap, etc.).
  const shapes = new Map<string, number>();
  for (let y = 1; y <= 400 && shapes.size < 8; y++) {
    const key = yearPeriods(def, y).map((p) => `${p.period.id}:${p.days}`).join("|");
    if (!shapes.has(key)) shapes.set(key, y);
  }
  let gap = false;
  let overlap = false;
  for (const internalYear of shapes.values()) {
    const displayYear = internalYear; // internal = display for positive years
    const periods = yearPeriods(def, toInternalYear(def, displayYear));
    const length = periods.reduce((n, p) => n + p.days, 0);
    const counts = new Array<number>(length).fill(0);
    for (const m of effectiveMemberships(def, profile)) {
      if (m.allYear) {
        counts.forEach((_, i) => (counts[i] += 1));
        continue;
      }
      const s = positionInYear(def, internalYear, m.start);
      const e = positionInYear(def, internalYear, m.end);
      if (s === null || e === null) continue;
      if (s <= e) for (let i = s; i <= e; i++) counts[i] += 1;
      else {
        for (let i = s; i < length; i++) counts[i] += 1;
        for (let i = 0; i <= e; i++) counts[i] += 1;
      }
    }
    if (counts.some((c) => c === 0)) gap = true;
    if (counts.some((c) => c > 1)) overlap = true;
  }
  if (gap && !profile.allowGaps) issues.push(issue("gap", { key: "seasonIssue.gap" }));
  if (overlap && !profile.allowOverlaps) issues.push(issue("overlap", { key: "seasonIssue.overlap" }));
  return issues;
}
