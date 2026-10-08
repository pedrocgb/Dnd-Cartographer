"use client";

import { useState } from "react";
import { CalendarRange, Plus, RefreshCcw, Repeat, Trash2 } from "lucide-react";
import { toWorldDay, type CalendarDefinition } from "@/server/calendars/engine";
import {
  cycleTotal,
  EIGHT_PHASES,
  FOUR_PHASES,
  nextPhaseStart,
  ONE_PHASE,
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
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";

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
  { key: "eight", names: EIGHT_PHASES },
  { key: "four", names: FOUR_PHASES },
  { key: "one", names: ONE_PHASE },
] as const;

export function presetPhases(names: readonly { name: string; icon: string }[], cycle: number): MoonPhase[] | null {
  const days = splitCycle(cycle, names.length);
  return days ? names.map((n, i) => ({ id: newId("ph"), name: n.name, icon: n.icon, days: days[i] })) : null;
}

/** Moons: a quick preset, the editable phase list, the reference date and a preview of upcoming phases. */
export function PhasesSection({ config, setConfig, def, today }: { config: CelestialConfig; setConfig: SetConfig; def: CalendarDefinition; today: number }) {
  const t = useT("calendars");
  const phases = config.phases ?? [];
  const [cycle, setCycle] = useState(cycleTotal(phases) || 28);
  const [presetError, setPresetError] = useState<string | null>(null);
  const setPhases = (next: MoonPhase[]) => {
    const anchorOk = next.some((p) => p.id === config.anchor?.phaseId);
    setConfig({ ...config, phases: next, anchor: { worldDay: config.anchor?.worldDay ?? today, phaseId: anchorOk ? config.anchor!.phaseId : (next[0]?.id ?? "") } });
  };
  const total = cycleTotal(phases);
  const spans = phases.length && config.anchor ? safe(() => phaseSpans(config, today, today + Math.min(120, Math.max(30, total * 2))), []) : [];
  const full = phases.find((p) => /full|cheia/i.test(p.name));
  const nextFull = full && config.anchor ? safe(() => nextPhaseStart(config, full.id, today), null) : null;

  function applyPreset(names: readonly { name: string; icon: string }[]) {
    const next = presetPhases(names, cycle);
    if (!next) {
      setPresetError(t("phases.tooShort", { cycle, n: names.length }));
      return;
    }
    setPresetError(null);
    setConfig({ ...config, phases: next, anchor: { worldDay: config.anchor?.worldDay ?? today, phaseId: next[0].id } });
  }

  return (
    <>
      <Section title={t("phases.quickStart")} hint={t("phases.quickStartHint")}>
        <label className="cel-cycle">
          <span>{t("phases.cycleLasts")}</span>
          <input type="number" min={1} aria-label={t("phases.cycleAria")} value={cycle} onChange={(e) => setCycle(int(e.target.value))} />
          <span>{t("phases.days")}</span>
        </label>
        <div className="cel-presets">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" className="cel-preset" onClick={() => applyPreset(p.names)}>
              <span className="cel-preset-icons" aria-hidden>
                {p.names.map((n) => n.icon).join("")}
              </span>
              <strong>{t(`preset.${p.key}`)}</strong>
              <span className="cal-help">{t(`preset.${p.key}Detail`)}</span>
            </button>
          ))}
        </div>
        {presetError && <p className="form-error">{presetError}</p>}
      </Section>

      <Section
        title={t("phases.title")}
        hint={phases.length ? t("phases.hint", { count: total, n: total }) : t("phases.none")}
        actions={
          <button type="button" className="btn btn-sm" onClick={() => setPhases([...phases, { id: newId("ph"), name: t("default.phase", { n: phases.length + 1 }), icon: "◌", days: 1 }])}>
            <Plus size={14} /> {t("phases.add")}
          </button>
        }
      >
        {phases.length > 0 && (
          <div className="cel-table" role="table" aria-label={t("phases.title")}>
            <div className="cel-table-row cel-table-head cel-phase-row" role="row">
              <span role="columnheader">{t("phases.symbol")}</span>
              <span role="columnheader">{t("phases.name")}</span>
              <span role="columnheader">{t("phases.daysHead")}</span>
              <span />
            </div>
            {phases.map((p, i) => (
              <div key={p.id} className="cel-table-row cel-phase-row" role="row">
                <input type="text" className="cel-symbol-input" aria-label={t("phases.symbolAria", { n: i + 1 })} maxLength={4} value={p.icon} onChange={(e) => setPhases(phases.map((x) => (x.id === p.id ? { ...x, icon: e.target.value } : x)))} />
                <input type="text" aria-label={t("phases.nameAria", { n: i + 1 })} maxLength={80} value={p.name} onChange={(e) => setPhases(phases.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} />
                <input type="number" min={1} aria-label={t("phases.lengthAria", { name: p.name })} value={p.days} onChange={(e) => setPhases(phases.map((x) => (x.id === p.id ? { ...x, days: int(e.target.value, 0) } : x)))} />
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("phases.remove", { name: p.name })} onClick={() => setPhases(phases.filter((x) => x.id !== p.id))}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {phases.length > 0 && (
        <Section title={t("phases.anchor")} hint={t("phases.anchorHint")}>
          <div className="cel-anchor">
            <DayField def={def} label={t("phases.on")} value={config.anchor?.worldDay ?? today} onChange={(worldDay) => setConfig({ ...config, anchor: { phaseId: config.anchor?.phaseId ?? phases[0].id, worldDay } })} />
            <label className="cal-field">
              <span className="field-label">{t("phases.begins")}</span>
              <select aria-label={t("phases.beginsAria")} value={config.anchor?.phaseId ?? ""} onChange={(e) => setConfig({ ...config, anchor: { worldDay: config.anchor?.worldDay ?? today, phaseId: e.target.value } })}>
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
        <Section title={t("preview.title")} hint={full ? t("phases.nextOf", { phase: full.name, date: nextFull !== null ? dayLabel(def, nextFull) : t("phases.notWithin") }) : undefined}>
          <div className="cal-timeline" role="list" aria-label={t("phases.upcoming")}>
            {spans.map((s) => (
              <span key={s.start} role="listitem" className="cal-timeline-span" style={{ flexGrow: s.end - s.start + 1 }} data-tooltip={t("phases.span", { name: s.name, from: dayLabel(def, s.start, { weekday: false }), to: dayLabel(def, s.end, { weekday: false }) })}>
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
  { kind: "once", Icon: Repeat },
  { kind: "annual", Icon: CalendarRange },
] as const;

const UNITS: RepeatUnit[] = ["days", "months", "years"];
const plural = (n: number, unit: RepeatUnit) => activeT("calendars")(`unit.${unit}`, { count: n, n });
/** How far ahead "Next" looks (physical days). */
const NEXT_HORIZON = 50_000;

/** One sentence describing a rule, e.g. "Visible for 2 days, coming back every 3 years". */
export function ruleSummary(s: AppearanceSchedule, stateName: string, calendars: ClientCalendar[]): string {
  const t = activeT("calendars");
  if (s.kind === "cycle") return ruleSummary(normalizeSchedule(s), stateName, calendars);
  if (s.kind === "annual") {
    const def = calendars.find((c) => c.id === s.calendarId)?.definition;
    const md = (x: { periodId: string; day: number }) => `${def?.periods.find((p) => p.id === x.periodId)?.name ?? "?"} ${x.day}`;
    return t("sched.annual", { state: stateName, from: md(s.start), to: md(s.end) });
  }
  const lasts = t("sched.lasts", { state: stateName, duration: plural(s.duration, "days") });
  if (s.repeatEvery === null) return t("sched.once", { lasts });
  return t(s.alsoBefore ? "sched.always" : "sched.comingBack", { lasts, interval: plural(s.repeatEvery, s.repeatUnit ?? "days") });
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
  const t = useT("calendars");
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
          <strong>{t(`schedule.${meta.kind}`)}</strong>
          <span className="cal-help">{ruleSummary(s, state?.name ?? t("sched.removedState"), calendars)}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("sched.remove")} onClick={onRemove}>
          <Trash2 size={14} />
        </button>
      </header>

      <div className="cel-rule-grid">
        <span className="cel-rule-label">{t("sched.shows")}</span>
        <select aria-label={t("sched.stateAria")} value={s.stateId} onChange={(e) => set({ stateId: e.target.value })}>
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
                    <span className="cel-rule-label">{t("sched.calendar")}</span>
                    <select aria-label={t("sched.calendarAria")} value={s.calendarId} onChange={(e) => set({ calendarId: e.target.value })}>
                      {calendars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <span className="cel-rule-label">{t("sched.from")}</span>
                <DateInput def={cal} label={t("sched.from")} compact hideYear value={{ year, ...s.start }} onChange={(d) => set({ start: { periodId: d.periodId, day: d.day } })} />
                <span className="cel-rule-label">{t("sched.through")}</span>
                <DateInput def={cal} label={t("sched.through")} compact hideYear value={{ year, ...s.end }} onChange={(d) => set({ end: { periodId: d.periodId, day: d.day } })} />
                <span />
                <span className="cal-help">{t("sched.monthDayHelp")}</span>
              </>
            );
          })()}

        {s.kind === "once" && (
          <>
            <span className="cel-rule-label">{s.alsoBefore ? t("sched.oneTime") : t("sched.firstTime")}</span>
            <DayField def={def} label={s.alsoBefore ? t("sched.oneTime") : t("sched.firstTime")} value={s.startWorldDay} onChange={(startWorldDay) => set({ startWorldDay })} />
            <span className="cel-rule-label">{t("sched.lastsLabel")}</span>
            <span className="cel-rule-inline">
              <input type="number" min={1} aria-label={t("sched.lastsAria")} value={s.duration} onChange={(e) => set({ duration: int(e.target.value) })} />
              {t("phases.days")}
            </span>
            <span className="cel-rule-label">{t("sched.comesBack")}</span>
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
              <span>{s.repeatEvery === null ? t("sched.onlyOnce") : t("sched.yes")}</span>
            </label>
            {s.repeatEvery !== null && (
              <>
                <span className="cel-rule-label">{t("sched.every")}</span>
                <span className="cel-rule-inline">
                  <input type="number" min={1} aria-label={t("sched.everyAria")} value={s.repeatEvery} onChange={(e) => set({ repeatEvery: int(e.target.value) })} />
                  <select
                    aria-label={t("sched.unit")}
                    value={s.repeatUnit ?? "days"}
                    onChange={(e) => set({ repeatUnit: e.target.value as RepeatUnit, repeatCalendarId: e.target.value === "days" ? null : (s.repeatCalendarId ?? calendarId), alsoBefore: e.target.value === "days" ? s.alsoBefore : false })}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {t(`unitName.${u}`, { count: s.repeatEvery ?? 1 })}
                      </option>
                    ))}
                  </select>
                </span>
                {(s.repeatUnit ?? "days") !== "days" && calendars.length > 1 && (
                  <>
                    <span className="cel-rule-label">{t("sched.countedIn")}</span>
                    <select aria-label={t("sched.countedInAria")} value={s.repeatCalendarId ?? calendarId} onChange={(e) => set({ repeatCalendarId: e.target.value })}>
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
                    <span className="cal-help">{t("sched.sameDayHelp")}</span>
                  </>
                )}
                {(s.repeatUnit ?? "days") === "days" && (
                  <>
                    <span className="cel-rule-label">{t("sched.before")}</span>
                    <label className="cel-toggle cel-toggle-inline">
                      <input type="checkbox" role="switch" checked={Boolean(s.alsoBefore)} onChange={(e) => set({ alsoBefore: e.target.checked })} />
                      <span className="cel-toggle-track" aria-hidden>
                        <span className="cel-toggle-thumb" />
                      </span>
                      <span>{s.alsoBefore ? t("sched.alwaysRepeating") : t("sched.nothingBefore")}</span>
                    </label>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      <footer className="cel-rule-card-next">
        <span className="field-label">{t("sched.next")}</span>
        {next.length ? (
          <span>{next.map((d) => dayLabel(def, d, { weekday: false })).join(" · ")}</span>
        ) : (
          <span className="cal-help">{t("sched.noUpcoming")}</span>
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
  const t = useT("calendars");
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
        title={t("states.title")}
        hint={t("states.hint")}
        actions={
          <button type="button" className="btn btn-sm" onClick={() => setConfig({ ...config, states: [...states, { id: newId("st"), name: states.length ? t("default.state", { n: states.length + 1 }) : t("default.visible"), icon: "✦" }] })}>
            <Plus size={14} /> {t("states.add")}
          </button>
        }
      >
        {states.length > 0 && (
          <div className="cel-table" role="table" aria-label={t("states.title")}>
            <div className="cel-table-row cel-table-head cel-state-row" role="row">
              <span role="columnheader">{t("phases.symbol")}</span>
              <span role="columnheader">{t("phases.name")}</span>
              <span />
            </div>
            {states.map((s, i) => (
              <div key={s.id} className="cel-table-row cel-state-row" role="row">
                <input type="text" className="cel-symbol-input" aria-label={t("states.symbolAria", { n: i + 1 })} maxLength={4} value={s.icon} onChange={(e) => setConfig({ ...config, states: states.map((x) => (x.id === s.id ? { ...x, icon: e.target.value } : x)) })} />
                <input type="text" aria-label={t("states.nameAria", { n: i + 1 })} maxLength={80} value={s.name} onChange={(e) => setConfig({ ...config, states: states.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) })} />
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("phases.remove", { name: s.name })} onClick={() => setConfig({ ...config, states: states.filter((x) => x.id !== s.id), schedules: schedules.filter((x) => x.stateId !== s.id) })}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {states.length > 0 && (
        <Section title={t("states.when")} hint={t("states.whenHint")}>
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
          <span className="field-label cel-add-label">{schedules.length ? t("states.addAnother") : t("states.addRule")}</span>
          <div className="cel-add-rules">
            {SCHEDULE_KINDS.map((k) => (
              <button key={k.kind} type="button" className="cel-preset" disabled={k.kind === "annual" && calendars.length === 0} onClick={() => addSchedule(k.kind)}>
                <k.Icon size={16} aria-hidden />
                <strong>{t(`schedule.${k.kind}`)}</strong>
                <span className="cal-help">{t(`schedule.${k.kind}Detail`)}</span>
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
  const t = useT("calendars");
  const overrides = config.overrides ?? [];
  const stateOptions = isMoon ? (config.phases ?? []) : (config.states ?? []);
  const set = (id: string, patch: Partial<StateOverride>) => setConfig({ ...config, overrides: overrides.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  const phases = config.phases ?? [];

  if (stateOptions.length === 0) {
    return <p className="cel-empty">{isMoon ? t("exceptions.addPhases") : t("exceptions.addState")} {t("exceptions.explain")}</p>;
  }
  return (
    <>
      <Section
        title={t("exceptions.title")}
        hint={t("exceptions.hint")}
        actions={
          <button type="button" className="btn btn-sm" onClick={() => setConfig({ ...config, overrides: [...overrides, { id: newId("ov"), start: today, end: today, stateId: stateOptions[0].id }] })}>
            <Plus size={14} /> {t("exceptions.add")}
          </button>
        }
      >
        {overrides.map((o) => (
          <div key={o.id} className="cel-rule">
            <div className="cel-rule-body">
              <DayField def={def} label={t("sched.from")} value={o.start} onChange={(start) => set(o.id, { start })} />
              <DayField def={def} label={t("sched.through")} value={o.end} onChange={(end) => set(o.id, { end })} />
              <label className="cal-field">
                <span className="field-label">{t("sched.shows")}</span>
                <select aria-label={t("sched.stateAria")} value={o.stateId} onChange={(e) => set(o.id, { stateId: e.target.value })}>
                  {stateOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="btn btn-ghost btn-icon btn-sm cel-rule-remove" aria-label={t("exceptions.remove")} onClick={() => setConfig({ ...config, overrides: overrides.filter((x) => x.id !== o.id) })}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </Section>

      {isMoon && (
        <Section
          title={t("restart.title")}
          hint={t("restart.hint")}
          actions={
            <button type="button" className="btn btn-sm" onClick={() => setConfig({ ...config, segments: [...(config.segments ?? []), { id: newId("seg"), fromWorldDay: today, phaseId: phases[0].id }] })}>
              <RefreshCcw size={14} /> {t("restart.add")}
            </button>
          }
        >
          {(config.segments ?? []).map((s) => (
            <div key={s.id} className="cel-rule">
              <div className="cel-rule-body">
                <DayField def={def} label={t("sched.from")} value={s.fromWorldDay} onChange={(fromWorldDay) => setConfig({ ...config, segments: config.segments!.map((x) => (x.id === s.id ? { ...x, fromWorldDay } : x)) })} />
                <label className="cal-field">
                  <span className="field-label">{t("restart.startsWith")}</span>
                  <select aria-label={t("restart.phaseAria")} value={s.phaseId} onChange={(e) => setConfig({ ...config, segments: config.segments!.map((x) => (x.id === s.id ? { ...x, phaseId: e.target.value } : x)) })}>
                    {phases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.icon} {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn btn-ghost btn-icon btn-sm cel-rule-remove" aria-label={t("restart.remove")} onClick={() => setConfig({ ...config, segments: config.segments!.filter((x) => x.id !== s.id) })}>
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
