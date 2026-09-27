"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { CalendarDefinition, LeapRule, Period, Weekday, YearRule } from "@/server/calendars/engine";
import { newId } from "./api";
import DateInput from "./DateInput";

type Change = (def: CalendarDefinition) => void;

function move<T>(list: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const num = (v: string, fallback = 1) => (Number.isInteger(Number(v)) && v !== "" ? Number(v) : fallback);

function RowTools({ index, count, onMove, onRemove, label }: { index: number; count: number; onMove: (d: number) => void; onRemove: () => void; label: string }) {
  return (
    <span className="cal-row-tools">
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${label} up`}>
        <ArrowUp size={14} />
      </button>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move ${label} down`}>
        <ArrowDown size={14} />
      </button>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onRemove} aria-label={`Remove ${label}`}>
        <Trash2 size={14} />
      </button>
    </span>
  );
}

export function WeekdaysFields({ def, onChange, advanced }: { def: CalendarDefinition; onChange: Change; advanced: boolean }) {
  const set = (weekdays: Weekday[]) => {
    const anchorOk = weekdays.some((w) => w.id === def.weekAnchor.weekdayId);
    onChange({ ...def, weekdays, weekAnchor: anchorOk ? def.weekAnchor : { ...def.weekAnchor, weekdayId: weekdays[0]?.id ?? "" } });
  };
  return (
    <div className="cal-fields">
      <p className="cal-help">A week is as many days as there are weekdays here ({def.weekdays.length}). Hiding labels elsewhere never changes timekeeping.</p>
      <ol className="cal-rows">
        {def.weekdays.map((w, i) => (
          <li key={w.id} className="cal-row">
            <span className="cal-row-index">{i + 1}</span>
            <input type="text" aria-label={`Weekday ${i + 1} name`} value={w.name} maxLength={80} onChange={(e) => set(def.weekdays.map((x) => (x.id === w.id ? { ...x, name: e.target.value } : x)))} />
            <input
              type="text"
              className="cal-short"
              aria-label={`Weekday ${i + 1} short label`}
              placeholder="Short"
              value={w.short}
              maxLength={12}
              onChange={(e) => set(def.weekdays.map((x) => (x.id === w.id ? { ...x, short: e.target.value } : x)))}
            />
            <RowTools index={i} count={def.weekdays.length} label={w.name || `weekday ${i + 1}`} onMove={(d) => set(move(def.weekdays, i, d))} onRemove={() => set(def.weekdays.filter((x) => x.id !== w.id))} />
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-sm" onClick={() => set([...def.weekdays, { id: newId("wd"), name: `Weekday ${def.weekdays.length + 1}`, short: "" }])}>
        <Plus size={14} /> Add weekday
      </button>
      {def.weekdays.length === 0 && <p className="cal-help">No weekdays: days are numbered within their month only.</p>}
      {advanced && def.weekdays.length > 0 && (
        <details className="cal-advanced">
          <summary>Week progression</summary>
          <label className="cal-inline">
            <span className="field-label">Weekdays</span>
            <select value={def.weekReset} onChange={(e) => onChange({ ...def, weekReset: e.target.value as CalendarDefinition["weekReset"] })}>
              <option value="continuous">Run continuously across months and years</option>
              <option value="month">Restart at the start of every month</option>
              <option value="year">Restart at the start of every year</option>
            </select>
          </label>
          <label className="cal-inline">
            <span className="field-label">{def.weekReset === "continuous" ? "Anchor weekday" : "Each restart begins on"}</span>
            <select value={def.weekAnchor.weekdayId} onChange={(e) => onChange({ ...def, weekAnchor: { ...def.weekAnchor, weekdayId: e.target.value } })}>
              {def.weekdays.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          {def.weekReset === "continuous" && <DateInput def={def} label="…falls on this date" value={def.weekAnchor.date} onChange={(date) => onChange({ ...def, weekAnchor: { ...def.weekAnchor, date } })} />}
        </details>
      )}
    </div>
  );
}

function RuleFields({ rule, onChange, label }: { rule: YearRule; onChange: (r: YearRule) => void; label: string }) {
  return (
    <div className="cal-rule">
      <label className="cal-inline">
        <span className="field-label">Every</span>
        <input type="number" min={1} aria-label={`${label}: every N years`} value={rule.every} onChange={(e) => onChange({ ...rule, every: num(e.target.value) })} />
        <span>years, counting from year</span>
        <input type="number" aria-label={`${label}: offset year`} value={rule.offset} onChange={(e) => onChange({ ...rule, offset: num(e.target.value, 0) })} />
      </label>
      {(rule.exceptions ?? []).map((ex, i) => (
        <label key={i} className="cal-inline cal-rule-exception">
          <select
            aria-label={`${label}: exception ${i + 1} effect`}
            value={ex.include ? "include" : "exclude"}
            onChange={(e) => onChange({ ...rule, exceptions: rule.exceptions!.map((x, j) => (j === i ? { ...x, include: e.target.value === "include" } : x)) })}
          >
            <option value="exclude">…except every</option>
            <option value="include">…but still every</option>
          </select>
          <input
            type="number"
            min={1}
            aria-label={`${label}: exception ${i + 1} interval`}
            value={ex.every}
            onChange={(e) => onChange({ ...rule, exceptions: rule.exceptions!.map((x, j) => (j === i ? { ...x, every: num(e.target.value) } : x)) })}
          />
          <span>years</span>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Remove exception" onClick={() => onChange({ ...rule, exceptions: rule.exceptions!.filter((_, j) => j !== i) })}>
            <Trash2 size={14} />
          </button>
        </label>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ ...rule, exceptions: [...(rule.exceptions ?? []), { every: rule.every * 25, offset: rule.offset, include: (rule.exceptions?.length ?? 0) % 2 === 1 }] })}>
        <Plus size={14} /> Add exception
      </button>
    </div>
  );
}

function PeriodRow({ period, index, count, def, onChange, advanced }: { period: Period; index: number; count: number; def: CalendarDefinition; onChange: Change; advanced: boolean }) {
  const update = (patch: Partial<Period>) => onChange({ ...def, periods: def.periods.map((p) => (p.id === period.id ? { ...p, ...patch } : p)) });
  const label = period.name || `month ${index + 1}`;
  return (
    <li className={period.kind === "special" ? "cal-row cal-row-special" : "cal-row"}>
      <span className="cal-row-index">{index + 1}</span>
      <input type="text" aria-label={`Month ${index + 1} name`} value={period.name} maxLength={80} onChange={(e) => update({ name: e.target.value })} />
      <input type="text" className="cal-short" aria-label={`Month ${index + 1} abbreviation`} placeholder="Abbr." value={period.short} maxLength={12} onChange={(e) => update({ short: e.target.value })} />
      <label className="cal-days">
        <input type="number" min={1} aria-label={`${label} days`} value={period.days} onChange={(e) => update({ days: num(e.target.value, 0) })} />
        <span>days</span>
      </label>
      <RowTools index={index} count={count} label={label} onMove={(d) => onChange({ ...def, periods: move(def.periods, index, d) })} onRemove={() => onChange({ ...def, periods: def.periods.filter((p) => p.id !== period.id) })} />
      {advanced && (
        <details className="cal-advanced cal-row-more">
          <summary>More options</summary>
          <label className="cal-inline">
            <span className="field-label">Kind</span>
            <select value={period.kind} onChange={(e) => update({ kind: e.target.value as Period["kind"], inWeek: e.target.value === "month" ? true : period.inWeek })}>
              <option value="month">Month</option>
              <option value="special">Special days (festival, intercalary days)</option>
            </select>
          </label>
          {period.kind === "special" && (
            <label className="cal-check">
              <input type="checkbox" checked={!period.inWeek} onChange={(e) => update({ inWeek: !e.target.checked })} />
              Outside the week (these days have no weekday and don&apos;t advance it)
            </label>
          )}
          <label className="cal-check">
            <input type="checkbox" checked={Boolean(period.condition)} onChange={(e) => update({ condition: e.target.checked ? { every: 4, offset: 0, exceptions: [] } : null })} />
            Only occurs in some years
          </label>
          {period.condition && <RuleFields label={label} rule={period.condition} onChange={(condition) => update({ condition })} />}
        </details>
      )}
    </li>
  );
}

export function MonthsFields({ def, onChange, advanced }: { def: CalendarDefinition; onChange: Change; advanced: boolean }) {
  const [bulk, setBulk] = useState({ count: 1, days: 30 });
  const months = def.periods.filter((p) => p.kind === "month").length;
  return (
    <div className="cal-fields">
      <p className="cal-help">
        {months} month{months === 1 ? "" : "s"}
        {def.periods.length > months ? ` and ${def.periods.length - months} special period${def.periods.length - months === 1 ? "" : "s"}` : ""}, in year order. The year&apos;s length comes from these (plus leap days).
      </p>
      <ol className="cal-rows">
        {def.periods.map((p, i) => (
          <PeriodRow key={p.id} period={p} index={i} count={def.periods.length} def={def} onChange={onChange} advanced={advanced} />
        ))}
      </ol>
      <div className="cal-inline">
        <span>Add</span>
        <input type="number" min={1} max={100} aria-label="How many months to add" value={bulk.count} onChange={(e) => setBulk({ ...bulk, count: Math.min(100, num(e.target.value)) })} />
        <span>month(s) of</span>
        <input type="number" min={1} aria-label="Days in each new month" value={bulk.days} onChange={(e) => setBulk({ ...bulk, days: num(e.target.value) })} />
        <span>days</span>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() =>
            onChange({
              ...def,
              periods: [
                ...def.periods,
                ...Array.from({ length: bulk.count }, (_, i): Period => ({ id: newId("mo"), name: `Month ${months + i + 1}`, short: "", kind: "month", days: bulk.days, inWeek: true, condition: null })),
              ],
            })
          }
        >
          <Plus size={14} /> Add
        </button>
        {advanced && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onChange({ ...def, periods: [...def.periods, { id: newId("sp"), name: "Festival", short: "", kind: "special", days: 1, inWeek: false, condition: null }] })}
          >
            <Plus size={14} /> Add special days
          </button>
        )}
      </div>
    </div>
  );
}

export function YearFields({ def, onChange, advanced }: { def: CalendarDefinition; onChange: Change; advanced: boolean }) {
  const setLeap = (leapRules: LeapRule[]) => onChange({ ...def, leapRules });
  return (
    <div className="cal-fields">
      <label className="cal-inline">
        <span className="field-label">Year label</span>
        <input type="text" placeholder="e.g. AR" maxLength={16} value={def.year.suffix} onChange={(e) => onChange({ ...def, year: { ...def.year, suffix: e.target.value } })} />
        <span className="cal-help">shown after the number: 1024 {def.year.suffix || "AR"}</span>
      </label>
      <fieldset className="cal-radio">
        <legend className="field-label">Years before the epoch</legend>
        <label className="cal-check">
          <input type="radio" name="year-zero" checked={!def.year.hasYearZero} onChange={() => onChange({ ...def, year: { ...def.year, hasYearZero: false } })} />
          No year 0 — year -1 comes right before year 1
        </label>
        <label className="cal-check">
          <input type="radio" name="year-zero" checked={def.year.hasYearZero} onChange={() => onChange({ ...def, year: { ...def.year, hasYearZero: true } })} />
          Year 0 exists between -1 and 1
        </label>
      </fieldset>
      <h4 className="cal-subhead">Leap days</h4>
      {def.leapRules.length === 0 && <p className="cal-help">No leap days: every year has the same length.</p>}
      <ol className="cal-rows">
        {def.leapRules.map((l, i) => (
          <li key={l.id} className="cal-row cal-row-leap">
            <input type="text" aria-label={`Leap rule ${i + 1} name`} placeholder="Name (e.g. Leap Day)" value={l.name} maxLength={80} onChange={(e) => setLeap(def.leapRules.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)))} />
            <label className="cal-inline">
              <span>Add</span>
              <input type="number" min={1} aria-label={`${l.name || "Leap rule"}: days added`} value={l.days} onChange={(e) => setLeap(def.leapRules.map((x) => (x.id === l.id ? { ...x, days: num(e.target.value, 0) } : x)))} />
              <span>day(s) to the end of</span>
              <select aria-label={`${l.name || "Leap rule"}: month`} value={l.periodId} onChange={(e) => setLeap(def.leapRules.map((x) => (x.id === l.id ? { ...x, periodId: e.target.value } : x)))}>
                {def.periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {advanced ? (
              <RuleFields label={l.name || "Leap rule"} rule={l.rule} onChange={(rule) => setLeap(def.leapRules.map((x) => (x.id === l.id ? { ...x, rule } : x)))} />
            ) : (
              <label className="cal-inline">
                <span>every</span>
                <input type="number" min={1} aria-label="Every N years" value={l.rule.every} onChange={(e) => setLeap(def.leapRules.map((x) => (x.id === l.id ? { ...x, rule: { ...x.rule, every: num(e.target.value) } } : x)))} />
                <span>years</span>
              </label>
            )}
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${l.name || "leap rule"}`} onClick={() => setLeap(def.leapRules.filter((x) => x.id !== l.id))}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="btn btn-sm"
        disabled={def.periods.length === 0}
        onClick={() => setLeap([...def.leapRules, { id: newId("leap"), name: "Leap day", periodId: def.periods.at(-1)?.id ?? "", days: 1, rule: { every: 4, offset: 0, exceptions: [] } }])}
      >
        <Plus size={14} /> Add leap rule
      </button>
      {advanced && <p className="cal-help">Leap and occurrence rules count years from the chosen year (0 by default); with no year 0, year -1 is counted as 0.</p>}
    </div>
  );
}
