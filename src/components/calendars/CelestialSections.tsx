"use client";

import { useState } from "react";
import { CalendarRange, Plus, RefreshCcw, Repeat, Trash2 } from "lucide-react";
import { toWorldDay, type CalendarDefinition } from "@/server/calendars/engine";
import {
  cycleTotal,
  EIGHT_PHASES,
  FOUR_PHASES,
  nextPhaseStart,
  normalizeSchedule,
  phaseSpans,
  splitCycle,
  scheduleStarts,
  type AppearanceSchedule,
  type CelestialConfig,
  type MoonPhase,
  type RepeatUnit,
  type StateOverride,
} from "@/server/calendars/celestial";
import { newId } from "./api";
import { dayLabel, localOf, safe } from "./evaluate";
import DateInput from "./DateInput";
import type { ClientCalendar } from "./types";

export type SetConfig = (c: CelestialConfig) => void;

const int = (v: string, min = 1) => Math.max(min, Math.floor(Number(v)) || min);

/** A worldDay entered as a date of the active calendar. */
function DayField({ def, label, value, onChange }: { def: CalendarDefinition; label: string; value: number; onChange: (d: number) => void }) {
  const date = localOf(def, value) ?? def.sync.date;
  return (
    <DateInput
      def={def}
      label={label}
      value={date}
      compact
      onChange={(d) => {
        const w = safe(() => toWorldDay(def, d), null);
        if (w !== null) onChange(w);
      }}
    />
  );
}

export function Section({ title, hint, children, actions }: { title: string; hint?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>{title}</h3>
          {hint && <p className="cal-help">{hint}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

const PRESETS = [
  { key: "eight", label: "8 phases", detail: "New, crescent, quarter, gibbous, full…", names: EIGHT_PHASES },
  { key: "four", label: "4 phases", detail: "New, waxing, full, waning", names: FOUR_PHASES },
  { key: "one", label: "Always the same", detail: "One permanent state", names: [{ name: "Moon", icon: "○" }] },
] as const;

export function presetPhases(names: readonly { name: string; icon: string }[], cycle: number): MoonPhase[] | null {
  const days = splitCycle(cycle, names.length);
  return days ? names.map((n, i) => ({ id: newId("ph"), name: n.name, icon: n.icon, days: days[i] })) : null;
}

/** Moons: a quick preset, the editable phase list, the reference date and a preview of upcoming phases. */
export function PhasesSection({ config, setConfig, def, today }: { config: CelestialConfig; setConfig: SetConfig; def: CalendarDefinition; today: number }) {
  const phases = config.phases ?? [];
  const [cycle, setCycle] = useState(cycleTotal(phases) || 28);
  const [presetError, setPresetError] = useState<string | null>(null);
  const setPhases = (next: MoonPhase[]) => {
    const anchorOk = next.some((p) => p.id === config.anchor?.phaseId);
    setConfig({ ...config, phases: next, anchor: { worldDay: config.anchor?.worldDay ?? today, phaseId: anchorOk ? config.anchor!.phaseId : (next[0]?.id ?? "") } });
  };
  const total = cycleTotal(phases);
  const spans = phases.length && config.anchor ? safe(() => phaseSpans(config, today, today + Math.min(120, Math.max(30, total * 2))), []) : [];
  const full = phases.find((p) => /full/i.test(p.name));
  const nextFull = full && config.anchor ? safe(() => nextPhaseStart(config, full.id, today), null) : null;

  function applyPreset(names: readonly { name: string; icon: string }[]) {
    const next = presetPhases(names, cycle);
    if (!next) {
      setPresetError(`A ${cycle}-day cycle is too short for ${names.length} phases of at least one day each.`);
      return;
    }
    setPresetError(null);
    setConfig({ ...config, phases: next, anchor: { worldDay: config.anchor?.worldDay ?? today, phaseId: next[0].id } });
  }

  return (
    <>
      <Section title="Quick start" hint="Pick a cycle length and a set of phases; the days are split for you. You can fine-tune them below.">
        <label className="cel-cycle">
          <span>One full cycle lasts</span>
          <input type="number" min={1} aria-label="Cycle length in days" value={cycle} onChange={(e) => setCycle(int(e.target.value))} />
          <span>days</span>
        </label>
        <div className="cel-presets">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" className="cel-preset" onClick={() => applyPreset(p.names)}>
              <span className="cel-preset-icons" aria-hidden>
                {p.names.map((n) => n.icon).join("")}
              </span>
              <strong>{p.label}</strong>
              <span className="cal-help">{p.detail}</span>
            </button>
          ))}
        </div>
        {presetError && <p className="form-error">{presetError}</p>}
      </Section>

      <Section
        title="Phases"
        hint={phases.length ? `In order. The cycle is ${total} day${total === 1 ? "" : "s"} long.` : "No phases yet: use a quick start above, or add them one by one."}
        actions={
          <button type="button" className="btn btn-sm" onClick={() => setPhases([...phases, { id: newId("ph"), name: `Phase ${phases.length + 1}`, icon: "◌", days: 1 }])}>
            <Plus size={14} /> Add phase
          </button>
        }
      >
        {phases.length > 0 && (
          <div className="cel-table" role="table" aria-label="Phases">
            <div className="cel-table-row cel-table-head cel-phase-row" role="row">
              <span role="columnheader">Symbol</span>
              <span role="columnheader">Name</span>
              <span role="columnheader">Days</span>
              <span />
            </div>
            {phases.map((p, i) => (
              <div key={p.id} className="cel-table-row cel-phase-row" role="row">
                <input type="text" className="cel-symbol-input" aria-label={`Phase ${i + 1} symbol`} maxLength={4} value={p.icon} onChange={(e) => setPhases(phases.map((x) => (x.id === p.id ? { ...x, icon: e.target.value } : x)))} />
                <input type="text" aria-label={`Phase ${i + 1} name`} maxLength={80} value={p.name} onChange={(e) => setPhases(phases.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} />
                <input type="number" min={1} aria-label={`${p.name} length in days`} value={p.days} onChange={(e) => setPhases(phases.map((x) => (x.id === p.id ? { ...x, days: int(e.target.value, 0) } : x)))} />
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${p.name}`} onClick={() => setPhases(phases.filter((x) => x.id !== p.id))}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {phases.length > 0 && (
        <Section title="Where the cycle stands" hint="Pick one day you know the moon's phase on. Every other day, past and future, follows from it.">
          <div className="cel-anchor">
            <DayField def={def} label="On" value={config.anchor?.worldDay ?? today} onChange={(worldDay) => setConfig({ ...config, anchor: { phaseId: config.anchor?.phaseId ?? phases[0].id, worldDay } })} />
            <label className="cal-field">
              <span className="field-label">the moon begins</span>
              <select aria-label="Phase beginning on that day" value={config.anchor?.phaseId ?? ""} onChange={(e) => setConfig({ ...config, anchor: { worldDay: config.anchor?.worldDay ?? today, phaseId: e.target.value } })}>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Section>
      )}

      {spans.length > 0 && (
        <Section title="Preview" hint={full ? `Next ${full.name}: ${nextFull !== null ? dayLabel(def, nextFull) : "not within 2000 days"}.` : undefined}>
          <div className="cal-timeline" role="list" aria-label="Upcoming phases">
            {spans.map((s) => (
              <span key={s.start} role="listitem" className="cal-timeline-span" style={{ flexGrow: s.end - s.start + 1 }} data-tooltip={`${s.name}: ${dayLabel(def, s.start, { weekday: false })} – ${dayLabel(def, s.end, { weekday: false })}`}>
                {s.icon || s.name.slice(0, 1)}
              </span>
            ))}
          </div>
          <ul className="cel-upcoming">
            {spans.slice(0, 8).map((s) => (
              <li key={s.start}>
                <span className="cel-upcoming-icon" aria-hidden>
                  {s.icon}
                </span>
                <strong>{s.name}</strong>
                <span className="cal-help">
                  {dayLabel(def, s.start, { weekday: false })}
                  {s.end > s.start ? ` – ${dayLabel(def, s.end, { weekday: false })}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

const SCHEDULE_KINDS = [
  { kind: "once", Icon: Repeat, label: "On a date", detail: "once, or coming back every few days, months or years" },
  { kind: "annual", Icon: CalendarRange, label: "Every year", detail: "between two dates, like a winter constellation" },
] as const;

const UNIT_LABELS: Record<RepeatUnit, [string, string]> = { days: ["day", "days"], months: ["month", "months"], years: ["year", "years"] };
const plural = (n: number, unit: RepeatUnit) => `${n} ${UNIT_LABELS[unit][n === 1 ? 0 : 1]}`;
/** How far ahead "Next" looks (physical days). */
const NEXT_HORIZON = 50_000;

/** One sentence describing a rule, e.g. "Visible for 2 days, coming back every 3 years". */
export function ruleSummary(s: AppearanceSchedule, stateName: string, calendars: ClientCalendar[]): string {
  if (s.kind === "cycle") return ruleSummary(normalizeSchedule(s), stateName, calendars);
  if (s.kind === "annual") {
    const def = calendars.find((c) => c.id === s.calendarId)?.definition;
    const md = (x: { periodId: string; day: number }) => `${def?.periods.find((p) => p.id === x.periodId)?.name ?? "?"} ${x.day}`;
    return `${stateName} every year, ${md(s.start)} – ${md(s.end)}`;
  }
  const lasts = `${stateName} for ${plural(s.duration, "days")}`;
  if (s.repeatEvery === null) return `${lasts}, once`;
  return `${lasts}, ${s.alsoBefore ? "every" : "coming back every"} ${plural(s.repeatEvery, s.repeatUnit ?? "days")}${s.alsoBefore ? ", since always" : ""}`;
}

function RuleCard({
  schedule: s,
  states,
  def,
  calendarId,
  calendars,
  today,
  onChange,
  onRemove,
}: {
  schedule: AppearanceSchedule;
  states: { id: string; name: string; icon: string }[];
  def: CalendarDefinition;
  calendarId: string;
  calendars: ClientCalendar[];
  today: number;
  onChange: (patch: Partial<AppearanceSchedule>) => void;
  onRemove: () => void;
}) {
  const meta = SCHEDULE_KINDS.find((k) => k.kind === s.kind) ?? SCHEDULE_KINDS[0];
  const state = states.find((x) => x.id === s.stateId);
  const resolve = (id: string) => calendars.find((c) => c.id === id)?.definition ?? null;
  const next = safe(() => scheduleStarts(s, today, today + NEXT_HORIZON, resolve, 3), []);
  const set = onChange as (patch: Record<string, unknown>) => void;

  return (
    <article className="cel-rule-card">
      <header className="cel-rule-card-head">
        <span className="cel-rule-card-icon" aria-hidden>
          <meta.Icon size={16} />
        </span>
        <div className="cel-rule-card-title">
          <strong>{meta.label}</strong>
          <span className="cal-help">{ruleSummary(s, state?.name ?? "A removed state", calendars)}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Remove this rule" onClick={onRemove}>
          <Trash2 size={14} />
        </button>
      </header>

      <div className="cel-rule-grid">
        <span className="cel-rule-label">Shows</span>
        <select aria-label="State shown" value={s.stateId} onChange={(e) => set({ stateId: e.target.value })}>
          {states.map((x) => (
            <option key={x.id} value={x.id}>
              {x.icon} {x.name}
            </option>
          ))}
        </select>

        {s.kind === "annual" &&
          (() => {
            const cal = resolve(s.calendarId) ?? def;
            const year = cal.sync.date.year;
            return (
              <>
                {calendars.length > 1 && (
                  <>
                    <span className="cel-rule-label">Calendar</span>
                    <select aria-label="Calendar the dates are read in" value={s.calendarId} onChange={(e) => set({ calendarId: e.target.value })}>
                      {calendars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <span className="cel-rule-label">From</span>
                <DateInput def={cal} label="From" compact hideYear value={{ year, ...s.start }} onChange={(d) => set({ start: { periodId: d.periodId, day: d.day } })} />
                <span className="cel-rule-label">Through</span>
                <DateInput def={cal} label="Through" compact hideYear value={{ year, ...s.end }} onChange={(d) => set({ end: { periodId: d.periodId, day: d.day } })} />
                <span />
                <span className="cal-help">Only the month and day count. An end before the start runs into the next year.</span>
              </>
            );
          })()}

        {s.kind === "once" && (
          <>
            <span className="cel-rule-label">{s.alsoBefore ? "One time is" : "First time"}</span>
            <DayField def={def} label={s.alsoBefore ? "One time is" : "First time"} value={s.startWorldDay} onChange={(startWorldDay) => set({ startWorldDay })} />
            <span className="cel-rule-label">Lasts</span>
            <span className="cel-rule-inline">
              <input type="number" min={1} aria-label="Days it lasts" value={s.duration} onChange={(e) => set({ duration: int(e.target.value) })} />
              days
            </span>
            <span className="cel-rule-label">Comes back</span>
            <label className="cel-toggle cel-toggle-inline">
              <input
                type="checkbox"
                role="switch"
                checked={s.repeatEvery !== null}
                onChange={(e) => set(e.target.checked ? { repeatEvery: 1, repeatUnit: "years", repeatCalendarId: calendarId, alsoBefore: false } : { repeatEvery: null, alsoBefore: false })}
              />
              <span className="cel-toggle-track" aria-hidden>
                <span className="cel-toggle-thumb" />
              </span>
              <span>{s.repeatEvery === null ? "No, only once" : "Yes"}</span>
            </label>
            {s.repeatEvery !== null && (
              <>
                <span className="cel-rule-label">Every</span>
                <span className="cel-rule-inline">
                  <input type="number" min={1} aria-label="Comes back every" value={s.repeatEvery} onChange={(e) => set({ repeatEvery: int(e.target.value) })} />
                  <select
                    aria-label="Unit"
                    value={s.repeatUnit ?? "days"}
                    onChange={(e) => set({ repeatUnit: e.target.value as RepeatUnit, repeatCalendarId: e.target.value === "days" ? null : (s.repeatCalendarId ?? calendarId), alsoBefore: e.target.value === "days" ? s.alsoBefore : false })}
                  >
                    {(Object.keys(UNIT_LABELS) as RepeatUnit[]).map((u) => (
                      <option key={u} value={u}>
                        {UNIT_LABELS[u][s.repeatEvery === 1 ? 0 : 1]}
                      </option>
                    ))}
                  </select>
                </span>
                {(s.repeatUnit ?? "days") !== "days" && calendars.length > 1 && (
                  <>
                    <span className="cel-rule-label">Counted in</span>
                    <select aria-label="Calendar the months or years are counted in" value={s.repeatCalendarId ?? calendarId} onChange={(e) => set({ repeatCalendarId: e.target.value })}>
                      {calendars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {(s.repeatUnit ?? "days") !== "days" && (
                  <>
                    <span />
                    <span className="cal-help">It comes back on the same day of the month; when a month is shorter, on its last day.</span>
                  </>
                )}
                {(s.repeatUnit ?? "days") === "days" && (
                  <>
                    <span className="cel-rule-label">Before it</span>
                    <label className="cel-toggle cel-toggle-inline">
                      <input type="checkbox" role="switch" checked={Boolean(s.alsoBefore)} onChange={(e) => set({ alsoBefore: e.target.checked })} />
                      <span className="cel-toggle-track" aria-hidden>
                        <span className="cel-toggle-thumb" />
                      </span>
                      <span>{s.alsoBefore ? "It has always been repeating (the date is just one of its appearances)" : "Nothing before the first time"}</span>
                    </label>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      <footer className="cel-rule-card-next">
        <span className="field-label">Next</span>
        {next.length ? (
          <span>{next.map((d) => dayLabel(def, d, { weekday: false })).join(" · ")}</span>
        ) : (
          <span className="cal-help">No upcoming appearance.</span>
        )}
      </footer>
    </article>
  );
}

/** Non-moon objects: their named states and the rules that turn them on. */
export function AppearanceSection({
  config,
  setConfig,
  def,
  calendarId,
  today,
  calendars,
}: {
  config: CelestialConfig;
  setConfig: SetConfig;
  def: CalendarDefinition;
  /** The active calendar (the default for rules counted in months or years). */
  calendarId: string;
  today: number;
  calendars: ClientCalendar[];
}) {
  const states = config.states ?? [];
  const schedules = config.schedules ?? [];
  const setSchedule = (id: string, patch: Partial<AppearanceSchedule>) => setConfig({ ...config, schedules: schedules.map((s) => (s.id === id ? ({ ...s, ...patch } as AppearanceSchedule) : s)) });

  function addSchedule(kind: "once" | "annual") {
    const base = { id: newId("sch"), stateId: states[0].id };
    const cal = calendars.find((c) => c.id === calendarId) ?? calendars[0];
    const month = cal?.definition.periods.find((p) => !p.condition)?.id ?? "";
    const next: AppearanceSchedule =
      kind === "annual"
        ? { ...base, kind, calendarId: cal?.id ?? "", start: { periodId: month, day: 1 }, end: { periodId: month, day: 1 } }
        : { ...base, kind: "once", startWorldDay: today, duration: 7, repeatEvery: null, repeatUnit: "days", repeatCalendarId: null, alsoBefore: false };
    setConfig({ ...config, schedules: [...schedules, next] });
  }

  return (
    <>
      <Section
        title="States"
        hint="What it can look like: Visible, Bright, Eclipsed… Leave this empty for an object that's only lore."
        actions={
          <button type="button" className="btn btn-sm" onClick={() => setConfig({ ...config, states: [...states, { id: newId("st"), name: states.length ? `State ${states.length + 1}` : "Visible", icon: "✦" }] })}>
            <Plus size={14} /> Add state
          </button>
        }
      >
        {states.length > 0 && (
          <div className="cel-table" role="table" aria-label="States">
            <div className="cel-table-row cel-table-head cel-state-row" role="row">
              <span role="columnheader">Symbol</span>
              <span role="columnheader">Name</span>
              <span />
            </div>
            {states.map((s, i) => (
              <div key={s.id} className="cel-table-row cel-state-row" role="row">
                <input type="text" className="cel-symbol-input" aria-label={`State ${i + 1} symbol`} maxLength={4} value={s.icon} onChange={(e) => setConfig({ ...config, states: states.map((x) => (x.id === s.id ? { ...x, icon: e.target.value } : x)) })} />
                <input type="text" aria-label={`State ${i + 1} name`} maxLength={80} value={s.name} onChange={(e) => setConfig({ ...config, states: states.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) })} />
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${s.name}`} onClick={() => setConfig({ ...config, states: states.filter((x) => x.id !== s.id), schedules: schedules.filter((x) => x.stateId !== s.id) })}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {states.length > 0 && (
        <Section title="When it happens" hint="Each rule turns one state on for some days. Without a rule, a state never shows by itself.">
          {schedules.map((s) => (
            <RuleCard
              key={s.id}
              schedule={s}
              states={states}
              def={def}
              calendarId={calendarId}
              calendars={calendars}
              today={today}
              onChange={(patch) => setSchedule(s.id, patch)}
              onRemove={() => setConfig({ ...config, schedules: schedules.filter((x) => x.id !== s.id) })}
            />
          ))}
          <span className="field-label cel-add-label">{schedules.length ? "Add another rule" : "Add a rule"}</span>
          <div className="cel-add-rules">
            {SCHEDULE_KINDS.map((k) => (
              <button key={k.kind} type="button" className="cel-preset" disabled={k.kind === "annual" && calendars.length === 0} onClick={() => addSchedule(k.kind)}>
                <k.Icon size={16} aria-hidden />
                <strong>{k.label}</strong>
                <span className="cal-help">{k.detail}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

/** Dated overrides (any type) and, for moons, cycle restarts. */
export function ExceptionsSection({ config, setConfig, def, today, isMoon }: { config: CelestialConfig; setConfig: SetConfig; def: CalendarDefinition; today: number; isMoon: boolean }) {
  const overrides = config.overrides ?? [];
  const stateOptions = isMoon ? (config.phases ?? []) : (config.states ?? []);
  const set = (id: string, patch: Partial<StateOverride>) => setConfig({ ...config, overrides: overrides.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  const phases = config.phases ?? [];

  if (stateOptions.length === 0) {
    return <p className="cel-empty">{isMoon ? "Add phases first." : "Add a state first."} Exceptions change what&apos;s shown on chosen dates.</p>;
  }
  return (
    <>
      <Section
        title="Special dates"
        hint="Force a state over a date range — a magical eclipse, a moon that stays full. Afterwards everything continues as if nothing happened."
        actions={
          <button type="button" className="btn btn-sm" onClick={() => setConfig({ ...config, overrides: [...overrides, { id: newId("ov"), start: today, end: today, stateId: stateOptions[0].id }] })}>
            <Plus size={14} /> Add special date
          </button>
        }
      >
        {overrides.map((o) => (
          <div key={o.id} className="cel-rule">
            <div className="cel-rule-body">
              <DayField def={def} label="From" value={o.start} onChange={(start) => set(o.id, { start })} />
              <DayField def={def} label="Through" value={o.end} onChange={(end) => set(o.id, { end })} />
              <label className="cal-field">
                <span className="field-label">Shows</span>
                <select aria-label="State shown" value={o.stateId} onChange={(e) => set(o.id, { stateId: e.target.value })}>
                  {stateOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="btn btn-ghost btn-icon btn-sm cel-rule-remove" aria-label="Remove special date" onClick={() => setConfig({ ...config, overrides: overrides.filter((x) => x.id !== o.id) })}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </Section>

      {isMoon && (
        <Section
          title="Restart the cycle"
          hint="From a chosen day on, the cycle starts over with a phase you pick (after a cataclysm, say). Days before it keep their phases."
          actions={
            <button type="button" className="btn btn-sm" onClick={() => setConfig({ ...config, segments: [...(config.segments ?? []), { id: newId("seg"), fromWorldDay: today, phaseId: phases[0].id }] })}>
              <RefreshCcw size={14} /> Add restart
            </button>
          }
        >
          {(config.segments ?? []).map((s) => (
            <div key={s.id} className="cel-rule">
              <div className="cel-rule-body">
                <DayField def={def} label="From" value={s.fromWorldDay} onChange={(fromWorldDay) => setConfig({ ...config, segments: config.segments!.map((x) => (x.id === s.id ? { ...x, fromWorldDay } : x)) })} />
                <label className="cal-field">
                  <span className="field-label">starts again with</span>
                  <select aria-label="Restart with phase" value={s.phaseId} onChange={(e) => setConfig({ ...config, segments: config.segments!.map((x) => (x.id === s.id ? { ...x, phaseId: e.target.value } : x)) })}>
                    {phases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.icon} {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn btn-ghost btn-icon btn-sm cel-rule-remove" aria-label="Remove restart" onClick={() => setConfig({ ...config, segments: config.segments!.filter((x) => x.id !== s.id) })}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </Section>
      )}
    </>
  );
}
