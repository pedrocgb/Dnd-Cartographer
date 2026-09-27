/**
 * Fantasy calendar date engine (pure — no DB, no Gregorian Date).
 *
 * Time is one shared chronology: a physical day is a signed integer
 * `worldDay` from an arbitrary world epoch. Every calendar maps its local
 * dates onto it through its synchronization anchor:
 *
 *   worldDay  = sync.worldDay + ordinal(date) - ordinal(sync.date)
 *   localDate = inverseOrdinal(worldDay - sync.worldDay + ordinal(sync.date))
 *
 * Years: `year` in a LocalDate is the DISPLAY year. Internally years are
 * continuous integers ("internal" / astronomical numbering). With
 * `hasYearZero` they're identical; without it display 1 = internal 1 and
 * display -1 = internal 0 (display 0 doesn't exist). Leap and conditional
 * rules are evaluated on INTERNAL years, so they stay periodic across the
 * epoch; for positive years both numberings agree.
 *
 * Periods keep stable ids (never array positions or names). A "special"
 * period (festival, intercalary days) may sit outside the weekday flow; it
 * still counts as physical days for moons, durations and synchronization.
 */

export interface Weekday {
  id: string;
  name: string;
  short: string;
}

/** Matches internal years `y` with (y - offset) divisible by `every`; exceptions apply in order (Gregorian: 4 / not 100 / but 400). */
export interface YearRule {
  every: number;
  offset: number;
  exceptions?: { every: number; offset: number; include: boolean }[];
}

export interface Period {
  id: string;
  name: string;
  short: string;
  kind: "month" | "special";
  days: number;
  /** False: its days have no weekday and don't advance the week (months are always in the week). */
  inWeek: boolean;
  /** The period only exists in matching years (a conditional month / festival). */
  condition?: YearRule | null;
}

/** Adds `days` to the end of `periodId` in matching years. */
export interface LeapRule {
  id: string;
  name: string;
  periodId: string;
  days: number;
  rule: YearRule;
}

export interface LocalDate {
  /** Display year. */
  year: number;
  periodId: string;
  /** 1-based day within the period. */
  day: number;
}

export interface CalendarDefinition {
  weekdays: Weekday[];
  /** How weekdays run: continuously, or restarting at each month / year. */
  weekReset: "continuous" | "month" | "year";
  /**
   * Continuous: `date` falls on `weekdayId`. Month/year reset: every
   * month's (year's) first in-week day is `weekdayId` (`date` unused).
   */
  weekAnchor: { date: LocalDate; weekdayId: string };
  periods: Period[];
  leapRules: LeapRule[];
  year: { hasYearZero: boolean; suffix: string };
  /** `date` in this calendar is the shared `worldDay`. */
  sync: { date: LocalDate; worldDay: number };
}

/** Supported display-year range (documented limit). */
export const MAX_ABS_YEAR = 1_000_000;
/** Combined leap/condition cycle limit (years) — keeps far-year math bounded. */
export const MAX_RULE_CYCLE = 20_000;

export class CalendarError extends Error {}

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function matchesYear(rule: YearRule, internalYear: number): boolean {
  let hit = mod(internalYear - rule.offset, rule.every) === 0;
  for (const ex of rule.exceptions ?? []) if (mod(internalYear - ex.offset, ex.every) === 0) hit = ex.include;
  return hit;
}

export function toInternalYear(def: Pick<CalendarDefinition, "year">, displayYear: number): number {
  if (def.year.hasYearZero) return displayYear;
  if (displayYear === 0) throw new CalendarError("This calendar has no year 0.");
  return displayYear > 0 ? displayYear : displayYear + 1;
}

export function toDisplayYear(def: Pick<CalendarDefinition, "year">, internalYear: number): number {
  if (def.year.hasYearZero) return internalYear;
  return internalYear >= 1 ? internalYear : internalYear - 1;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

function ruleIntervals(rule: YearRule): number[] {
  return [rule.every, ...(rule.exceptions ?? []).map((e) => e.every)];
}

/** Every interval any rule depends on; their LCM is the calendar's repeating cycle of years. */
function cycleLength(def: CalendarDefinition): number {
  const intervals = [
    ...def.periods.flatMap((p) => (p.condition ? ruleIntervals(p.condition) : [])),
    ...def.leapRules.flatMap((l) => ruleIntervals(l.rule)),
  ];
  let cycle = 1;
  for (const n of intervals) {
    cycle = lcm(cycle, n);
    if (cycle > MAX_RULE_CYCLE) throw new CalendarError(`The leap and conditional rules only repeat every ${cycle}+ years; keep it under ${MAX_RULE_CYCLE}.`);
  }
  return cycle;
}

export interface YearPeriod {
  period: Period;
  /** Days this year, leap days included. */
  days: number;
}

/** The periods of an internal year, in order, with their effective lengths. */
export function yearPeriods(def: CalendarDefinition, internalYear: number): YearPeriod[] {
  return def.periods
    .filter((p) => !p.condition || matchesYear(p.condition, internalYear))
    .map((period) => ({
      period,
      days: period.days + def.leapRules.filter((l) => l.periodId === period.id && matchesYear(l.rule, internalYear)).reduce((n, l) => n + l.days, 0),
    }));
}

interface Structure {
  cycle: number;
  /** Days / in-week days / months in the first `k` years of a cycle (internal years 0..k-1). */
  prefixDays: number[];
  prefixWeek: number[];
  prefixMonths: number[];
}

const structures = new WeakMap<CalendarDefinition, Structure>();

function structure(def: CalendarDefinition): Structure {
  const cached = structures.get(def);
  if (cached) return cached;
  const cycle = cycleLength(def);
  const prefixDays = [0];
  const prefixWeek = [0];
  const prefixMonths = [0];
  for (let y = 0; y < cycle; y++) {
    const periods = yearPeriods(def, y);
    prefixDays.push(prefixDays[y] + periods.reduce((n, p) => n + p.days, 0));
    prefixWeek.push(prefixWeek[y] + periods.filter((p) => p.period.inWeek).reduce((n, p) => n + p.days, 0));
    prefixMonths.push(prefixMonths[y] + periods.filter((p) => p.period.kind === "month").length);
  }
  const s = { cycle, prefixDays, prefixWeek, prefixMonths };
  structures.set(def, s);
  return s;
}

/** Sum of a per-year prefix before internal year `y` (negative years included). */
function before(prefix: number[], cycle: number, y: number): number {
  const q = Math.floor(y / cycle);
  return q * prefix[cycle] + prefix[y - q * cycle];
}

export const yearLength = (def: CalendarDefinition, internalYear: number) => yearPeriods(def, internalYear).reduce((n, p) => n + p.days, 0);

function checkYear(internalYear: number) {
  if (!Number.isInteger(internalYear) || Math.abs(internalYear) > MAX_ABS_YEAR) {
    throw new CalendarError(`Years are supported between -${MAX_ABS_YEAR} and ${MAX_ABS_YEAR}.`);
  }
}

/** Why `date` doesn't exist in this calendar, or null when it does. */
export function dateError(def: CalendarDefinition, date: LocalDate): string | null {
  let y: number;
  try {
    y = toInternalYear(def, date.year);
    checkYear(y);
  } catch (e) {
    return (e as Error).message;
  }
  const period = def.periods.find((p) => p.id === date.periodId);
  if (!period) return "That month doesn't exist in this calendar.";
  const entry = yearPeriods(def, y).find((p) => p.period.id === date.periodId);
  if (!entry) return `${period.name} doesn't occur in year ${date.year}${def.year.suffix ? ` ${def.year.suffix}` : ""}.`;
  if (!Number.isInteger(date.day) || date.day < 1 || date.day > entry.days) {
    return `${period.name} has ${entry.days} day${entry.days === 1 ? "" : "s"} in year ${date.year}.`;
  }
  return null;
}

function assertDate(def: CalendarDefinition, date: LocalDate) {
  const problem = dateError(def, date);
  if (problem) throw new CalendarError(problem);
}

/** Physical days from the start of internal year 0 to `date`. */
export function ordinal(def: CalendarDefinition, date: LocalDate): number {
  assertDate(def, date);
  const y = toInternalYear(def, date.year);
  const s = structure(def);
  let n = before(s.prefixDays, s.cycle, y);
  for (const p of yearPeriods(def, y)) {
    if (p.period.id === date.periodId) return n + date.day - 1;
    n += p.days;
  }
  throw new CalendarError("Unreachable: validated period missing.");
}

/** The local date `n` physical days after the start of internal year 0. */
export function inverseOrdinal(def: CalendarDefinition, n: number): LocalDate {
  const s = structure(def);
  const cycleDays = s.prefixDays[s.cycle];
  const q = Math.floor(n / cycleDays);
  let rest = n - q * cycleDays;
  // Binary search the year inside the cycle.
  let lo = 0;
  let hi = s.cycle - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s.prefixDays[mid] <= rest) lo = mid;
    else hi = mid - 1;
  }
  const y = q * s.cycle + lo;
  checkYear(y);
  rest -= s.prefixDays[lo];
  for (const p of yearPeriods(def, y)) {
    if (rest < p.days) return { year: toDisplayYear(def, y), periodId: p.period.id, day: rest + 1 };
    rest -= p.days;
  }
  throw new CalendarError("Unreachable: day beyond the year.");
}

export function toWorldDay(def: CalendarDefinition, date: LocalDate): number {
  return def.sync.worldDay + ordinal(def, date) - ordinal(def, def.sync.date);
}

export function fromWorldDay(def: CalendarDefinition, worldDay: number): LocalDate {
  if (!Number.isSafeInteger(worldDay)) throw new CalendarError("That day is outside the supported range.");
  return inverseOrdinal(def, worldDay - def.sync.worldDay + ordinal(def, def.sync.date));
}

/** In-week days from the start of internal year 0 to `date` (its own period must be in the week). */
function weekOrdinal(def: CalendarDefinition, date: LocalDate): number {
  const y = toInternalYear(def, date.year);
  const s = structure(def);
  let n = before(s.prefixWeek, s.cycle, y);
  for (const p of yearPeriods(def, y)) {
    if (p.period.id === date.periodId) return n + date.day - 1;
    if (p.period.inWeek) n += p.days;
  }
  throw new CalendarError("Unreachable: validated period missing.");
}

/** The weekday index of `date`, or null for a day outside the weekday flow (or a calendar without weekdays). */
export function weekdayIndex(def: CalendarDefinition, date: LocalDate): number | null {
  assertDate(def, date);
  const count = def.weekdays.length;
  const period = def.periods.find((p) => p.id === date.periodId)!;
  if (count === 0 || !period.inWeek) return null;
  const anchor = Math.max(0, def.weekdays.findIndex((w) => w.id === def.weekAnchor.weekdayId));
  if (def.weekReset === "continuous") return mod(anchor + weekOrdinal(def, date) - weekOrdinal(def, def.weekAnchor.date), count);
  if (def.weekReset === "month") return mod(anchor + date.day - 1, count);
  // Year reset: in-week days before this date within its year.
  let n = 0;
  for (const p of yearPeriods(def, toInternalYear(def, date.year))) {
    if (p.period.id === date.periodId) break;
    if (p.period.inWeek) n += p.days;
  }
  return mod(anchor + n + date.day - 1, count);
}

/** Months (kind "month") from internal year 0 up to `date`'s period — for "every N months" recurrence. */
export function monthOrdinal(def: CalendarDefinition, date: LocalDate): number {
  const y = toInternalYear(def, date.year);
  const s = structure(def);
  let n = before(s.prefixMonths, s.cycle, y);
  for (const p of yearPeriods(def, y)) {
    if (p.period.id === date.periodId) return n;
    if (p.period.kind === "month") n += 1;
  }
  throw new CalendarError("Unreachable: validated period missing.");
}

/** The display year after `displayYear` (skipping year 0 when the calendar has none). */
export function nextYear(def: Pick<CalendarDefinition, "year">, displayYear: number): number {
  return displayYear === -1 && !def.year.hasYearZero ? 1 : displayYear + 1;
}

/** The display year before `displayYear` (skipping year 0 when the calendar has none). */
export function previousYear(def: Pick<CalendarDefinition, "year">, displayYear: number): number {
  return displayYear === 1 && !def.year.hasYearZero ? -1 : displayYear - 1;
}

/** One "week" of physical days in this calendar (Advance 1 Week, weekly recurrence). */
export const weekLength = (def: CalendarDefinition) => Math.max(1, def.weekdays.length);

export interface DefinitionIssue {
  field: string;
  message: string;
}

function ruleIssues(rule: YearRule, field: string): DefinitionIssue[] {
  const issues: DefinitionIssue[] = [];
  for (const n of ruleIntervals(rule)) if (!Number.isInteger(n) || n < 1) issues.push({ field, message: "Intervals must be whole numbers of 1 or more years." });
  for (const o of [rule.offset, ...(rule.exceptions ?? []).map((e) => e.offset)]) if (!Number.isInteger(o)) issues.push({ field, message: "Offsets must be whole numbers." });
  return issues;
}

/** Everything wrong with a definition, in plain language (empty when valid). */
export function validateDefinition(def: CalendarDefinition): DefinitionIssue[] {
  const issues: DefinitionIssue[] = [];
  const ids = new Set<string>();
  const unique = (id: string, field: string) => {
    if (!id) issues.push({ field, message: "Every item needs an id." });
    else if (ids.has(id)) issues.push({ field, message: `The id "${id}" is used twice.` });
    ids.add(id);
  };
  def.weekdays.forEach((w, i) => {
    unique(w.id, `weekdays.${i}`);
    if (!w.name.trim()) issues.push({ field: `weekdays.${i}`, message: `Weekday ${i + 1} needs a name.` });
  });
  if (!def.periods.some((p) => p.kind === "month")) issues.push({ field: "periods", message: "Add at least one month." });
  def.periods.forEach((p, i) => {
    unique(p.id, `periods.${i}`);
    if (!p.name.trim()) issues.push({ field: `periods.${i}`, message: `Month ${i + 1} needs a name.` });
    if (!Number.isInteger(p.days) || p.days < 1) issues.push({ field: `periods.${i}`, message: `${p.name || `Month ${i + 1}`} needs 1 or more days.` });
    if (p.kind === "month" && !p.inWeek) issues.push({ field: `periods.${i}`, message: `${p.name}: months always take part in the week; use a special period to step outside it.` });
    if (p.condition) issues.push(...ruleIssues(p.condition, `periods.${i}`));
  });
  def.leapRules.forEach((l, i) => {
    unique(l.id, `leapRules.${i}`);
    if (!def.periods.some((p) => p.id === l.periodId)) issues.push({ field: `leapRules.${i}`, message: `${l.name || "A leap rule"} points to a month that no longer exists.` });
    if (!Number.isInteger(l.days) || l.days < 1) issues.push({ field: `leapRules.${i}`, message: `${l.name || "A leap rule"} must add 1 or more days.` });
    issues.push(...ruleIssues(l.rule, `leapRules.${i}`));
  });
  if (def.weekdays.length > 0 && !def.weekdays.some((w) => w.id === def.weekAnchor.weekdayId)) {
    issues.push({ field: "weekAnchor", message: "Pick the weekday the week starts from." });
  }
  if (!Number.isSafeInteger(def.sync.worldDay)) issues.push({ field: "sync", message: "The synchronization day must be a whole number." });
  if (issues.length) return issues;

  // Structural checks need a consistent definition first.
  try {
    cycleLength(def);
    if (structure(def).prefixDays[structure(def).cycle] <= 0) issues.push({ field: "periods", message: "Some year must have at least one day." });
  } catch (e) {
    issues.push({ field: "leapRules", message: (e as Error).message });
    return issues;
  }
  const syncProblem = dateError(def, def.sync.date);
  if (syncProblem) issues.push({ field: "sync", message: `Synchronization date: ${syncProblem}` });
  if (def.weekdays.length > 0 && def.weekReset === "continuous") {
    const anchorProblem = dateError(def, def.weekAnchor.date);
    if (anchorProblem) issues.push({ field: "weekAnchor", message: `Weekday anchor: ${anchorProblem}` });
    else if (!def.periods.find((p) => p.id === def.weekAnchor.date.periodId)?.inWeek) {
      issues.push({ field: "weekAnchor", message: "The weekday anchor must fall on a day that has a weekday." });
    }
  }
  return issues;
}

/** Display label of a local date, e.g. "12 Alder 1024 AR". */
export function formatDate(def: CalendarDefinition, date: LocalDate, { short = false } = {}): string {
  const period = def.periods.find((p) => p.id === date.periodId);
  const name = period ? (short ? period.short || period.name : period.name) : "?";
  return `${date.day} ${name} ${date.year}${def.year.suffix ? ` ${def.year.suffix}` : ""}`;
}

/** The year-level summary a preview needs: total days, periods with their lengths, leap years in a range. */
export function yearSummary(def: CalendarDefinition, displayYear: number) {
  const y = toInternalYear(def, displayYear);
  const periods = yearPeriods(def, y);
  return { periods, total: periods.reduce((n, p) => n + p.days, 0), inWeek: periods.filter((p) => p.period.inWeek).reduce((n, p) => n + p.days, 0) };
}
