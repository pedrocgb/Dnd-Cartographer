"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { CalendarDefinition, LeapRule, Period, Weekday, YearRule } from "@/server/calendars/engine";
import { newId } from "./api";
import DateInput from "./DateInput";
import { useT } from "@/i18n/useT";

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
  const t = useT("calendars");
  return (
    <span className="cal-row-tools">
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onMove(-1)} disabled={index === 0} aria-label={t("fields.moveUp", { label })}>
        <ArrowUp size={14} />
      </button>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={t("fields.moveDown", { label })}>
        <ArrowDown size={14} />
      </button>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onRemove} aria-label={t("fields.remove", { label })}>
        <Trash2 size={14} />
      </button>
    </span>
  );
}

export function WeekdaysFields({ def, onChange, advanced }: { def: CalendarDefinition; onChange: Change; advanced: boolean }) {
  const t = useT("calendars");
  const set = (weekdays: Weekday[]) => {
    const anchorOk = weekdays.some((w) => w.id === def.weekAnchor.weekdayId);
    onChange({ ...def, weekdays, weekAnchor: anchorOk ? def.weekAnchor : { ...def.weekAnchor, weekdayId: weekdays[0]?.id ?? "" } });
  };
  return (
    <div className="cal-fields">
      <p className="cal-help">{t("fields.weekHelp", { n: def.weekdays.length })}</p>
      <ol className="cal-rows">
        {def.weekdays.map((w, i) => (
          <li key={w.id} className="cal-row">
            <span className="cal-row-index">{i + 1}</span>
            <input type="text" aria-label={t("fields.weekdayName", { n: i + 1 })} value={w.name} maxLength={80} onChange={(e) => set(def.weekdays.map((x) => (x.id === w.id ? { ...x, name: e.target.value } : x)))} />
            <input
              type="text"
              className="cal-short"
              aria-label={t("fields.weekdayShort", { n: i + 1 })}
              placeholder={t("fields.short")}
              value={w.short}
              maxLength={12}
              onChange={(e) => set(def.weekdays.map((x) => (x.id === w.id ? { ...x, short: e.target.value } : x)))}
            />
            <RowTools index={i} count={def.weekdays.length} label={w.name || t("fields.weekdayLower", { n: i + 1 })} onMove={(d) => set(move(def.weekdays, i, d))} onRemove={() => set(def.weekdays.filter((x) => x.id !== w.id))} />
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-sm" onClick={() => set([...def.weekdays, { id: newId("wd"), name: t("default.weekday", { n: def.weekdays.length + 1 }), short: "" }])}>
        <Plus size={14} /> {t("fields.addWeekday")}
      </button>
      {def.weekdays.length === 0 && <p className="cal-help">{t("fields.noWeekdays")}</p>}
      {advanced && def.weekdays.length > 0 && (
        <details className="cal-advanced">
          <summary>{t("fields.weekProgression")}</summary>
          <label className="cal-inline">
            <span className="field-label">{t("fields.weekdays")}</span>
            <select value={def.weekReset} onChange={(e) => onChange({ ...def, weekReset: e.target.value as CalendarDefinition["weekReset"] })}>
              <option value="continuous">{t("fields.reset.continuous")}</option>
              <option value="month">{t("fields.reset.month")}</option>
              <option value="year">{t("fields.reset.year")}</option>
            </select>
          </label>
          <label className="cal-inline">
            <span className="field-label">{def.weekReset === "continuous" ? t("fields.anchorWeekday") : t("fields.restartBegins")}</span>
            <select value={def.weekAnchor.weekdayId} onChange={(e) => onChange({ ...def, weekAnchor: { ...def.weekAnchor, weekdayId: e.target.value } })}>
              {def.weekdays.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          {def.weekReset === "continuous" && <DateInput def={def} label={t("fields.anchorFalls")} value={def.weekAnchor.date} onChange={(date) => onChange({ ...def, weekAnchor: { ...def.weekAnchor, date } })} />}
        </details>
      )}
    </div>
  );
}

function RuleFields({ rule, onChange, label }: { rule: YearRule; onChange: (r: YearRule) => void; label: string }) {
  const t = useT("calendars");
  return (
    <div className="cal-rule">
      <label className="cal-inline">
        <span className="field-label">{t("rule.every")}</span>
        <input type="number" min={1} aria-label={t("rule.everyAria", { label })} value={rule.every} onChange={(e) => onChange({ ...rule, every: num(e.target.value) })} />
        <span>{t("rule.countingFrom")}</span>
        <input type="number" aria-label={t("rule.offsetAria", { label })} value={rule.offset} onChange={(e) => onChange({ ...rule, offset: num(e.target.value, 0) })} />
      </label>
      {(rule.exceptions ?? []).map((ex, i) => (
        <label key={i} className="cal-inline cal-rule-exception">
          <select
            aria-label={t("rule.exceptionEffect", { label, n: i + 1 })}
            value={ex.include ? "include" : "exclude"}
            onChange={(e) => onChange({ ...rule, exceptions: rule.exceptions!.map((x, j) => (j === i ? { ...x, include: e.target.value === "include" } : x)) })}
          >
            <option value="exclude">{t("rule.except")}</option>
            <option value="include">{t("rule.butStill")}</option>
          </select>
          <input
            type="number"
            min={1}
            aria-label={t("rule.exceptionInterval", { label, n: i + 1 })}
            value={ex.every}
            onChange={(e) => onChange({ ...rule, exceptions: rule.exceptions!.map((x, j) => (j === i ? { ...x, every: num(e.target.value) } : x)) })}
          />
          <span>{t("rule.years")}</span>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("rule.removeException")} onClick={() => onChange({ ...rule, exceptions: rule.exceptions!.filter((_, j) => j !== i) })}>
            <Trash2 size={14} />
          </button>
        </label>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ ...rule, exceptions: [...(rule.exceptions ?? []), { every: rule.every * 25, offset: rule.offset, include: (rule.exceptions?.length ?? 0) % 2 === 1 }] })}>
        <Plus size={14} /> {t("rule.addException")}
      </button>
    </div>
  );
}

function PeriodRow({ period, index, count, def, onChange, advanced }: { period: Period; index: number; count: number; def: CalendarDefinition; onChange: Change; advanced: boolean }) {
  const t = useT("calendars");
  const update = (patch: Partial<Period>) => onChange({ ...def, periods: def.periods.map((p) => (p.id === period.id ? { ...p, ...patch } : p)) });
  const label = period.name || t("fields.monthLower", { n: index + 1 });
  return (
    <li className={period.kind === "special" ? "cal-row cal-row-special" : "cal-row"}>
      <span className="cal-row-index">{index + 1}</span>
      <input type="text" aria-label={t("fields.monthName", { n: index + 1 })} value={period.name} maxLength={80} onChange={(e) => update({ name: e.target.value })} />
      <input type="text" className="cal-short" aria-label={t("fields.monthAbbr", { n: index + 1 })} placeholder={t("fields.abbr")} value={period.short} maxLength={12} onChange={(e) => update({ short: e.target.value })} />
      <label className="cal-days">
        <input type="number" min={1} aria-label={t("fields.monthDaysAria", { label })} value={period.days} onChange={(e) => update({ days: num(e.target.value, 0) })} />
        <span>{t("fields.days")}</span>
      </label>
      <RowTools index={index} count={count} label={label} onMove={(d) => onChange({ ...def, periods: move(def.periods, index, d) })} onRemove={() => onChange({ ...def, periods: def.periods.filter((p) => p.id !== period.id) })} />
      {advanced && (
        <details className="cal-advanced cal-row-more">
          <summary>{t("fields.moreOptions")}</summary>
          <label className="cal-inline">
            <span className="field-label">{t("fields.kind")}</span>
            <select value={period.kind} onChange={(e) => update({ kind: e.target.value as Period["kind"], inWeek: e.target.value === "month" ? true : period.inWeek })}>
              <option value="month">{t("fields.kindMonth")}</option>
              <option value="special">{t("fields.kindSpecial")}</option>
            </select>
          </label>
          {period.kind === "special" && (
            <label className="cal-check">
              <input type="checkbox" checked={!period.inWeek} onChange={(e) => update({ inWeek: !e.target.checked })} />
              {t("fields.outsideWeek")}
            </label>
          )}
          <label className="cal-check">
            <input type="checkbox" checked={Boolean(period.condition)} onChange={(e) => update({ condition: e.target.checked ? { every: 4, offset: 0, exceptions: [] } : null })} />
            {t("fields.someYears")}
          </label>
          {period.condition && <RuleFields label={label} rule={period.condition} onChange={(condition) => update({ condition })} />}
        </details>
      )}
    </li>
  );
}

export function MonthsFields({ def, onChange, advanced }: { def: CalendarDefinition; onChange: Change; advanced: boolean }) {
  const t = useT("calendars");
  const [bulk, setBulk] = useState({ count: 1, days: 30 });
  const months = def.periods.filter((p) => p.kind === "month").length;
  const specials = def.periods.length - months;
  const monthCount = t("fields.monthCount", { count: months, n: months });
  return (
    <div className="cal-fields">
      <p className="cal-help">{t("fields.monthsHelp", { months: specials ? t("fields.monthsAndSpecial", { months: monthCount, special: t("fields.specialCount", { count: specials, n: specials }) }) : monthCount })}</p>
      <ol className="cal-rows">
        {def.periods.map((p, i) => (
          <PeriodRow key={p.id} period={p} index={i} count={def.periods.length} def={def} onChange={onChange} advanced={advanced} />
        ))}
      </ol>
      <div className="cal-inline">
        <span>{t("fields.add")}</span>
        <input type="number" min={1} max={100} aria-label={t("fields.bulkCountAria")} value={bulk.count} onChange={(e) => setBulk({ ...bulk, count: Math.min(100, num(e.target.value)) })} />
        <span>{t("fields.bulkOf")}</span>
        <input type="number" min={1} aria-label={t("fields.bulkDaysAria")} value={bulk.days} onChange={(e) => setBulk({ ...bulk, days: num(e.target.value) })} />
        <span>{t("fields.days")}</span>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() =>
            onChange({
              ...def,
              periods: [
                ...def.periods,
                ...Array.from({ length: bulk.count }, (_, i): Period => ({ id: newId("mo"), name: t("default.month", { n: months + i + 1 }), short: "", kind: "month", days: bulk.days, inWeek: true, condition: null })),
              ],
            })
          }
        >
          <Plus size={14} /> {t("fields.add")}
        </button>
        {advanced && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onChange({ ...def, periods: [...def.periods, { id: newId("sp"), name: t("default.festival"), short: "", kind: "special", days: 1, inWeek: false, condition: null }] })}
          >
            <Plus size={14} /> {t("fields.addSpecial")}
          </button>
        )}
      </div>
    </div>
  );
}

export function YearFields({ def, onChange, advanced }: { def: CalendarDefinition; onChange: Change; advanced: boolean }) {
  const t = useT("calendars");
  const setLeap = (leapRules: LeapRule[]) => onChange({ ...def, leapRules });
  return (
    <div className="cal-fields">
      <label className="cal-inline">
        <span className="field-label">{t("year.label")}</span>
        <input type="text" placeholder={t("year.placeholder")} maxLength={16} value={def.year.suffix} onChange={(e) => onChange({ ...def, year: { ...def.year, suffix: e.target.value } })} />
        <span className="cal-help">{t("year.shownAfter", { suffix: def.year.suffix || "AR" })}</span>
      </label>
      <fieldset className="cal-radio">
        <legend className="field-label">{t("year.beforeEpoch")}</legend>
        <label className="cal-check">
          <input type="radio" name="year-zero" checked={!def.year.hasYearZero} onChange={() => onChange({ ...def, year: { ...def.year, hasYearZero: false } })} />
          {t("year.noZero")}
        </label>
        <label className="cal-check">
          <input type="radio" name="year-zero" checked={def.year.hasYearZero} onChange={() => onChange({ ...def, year: { ...def.year, hasYearZero: true } })} />
          {t("year.zero")}
        </label>
      </fieldset>
      <h4 className="cal-subhead">{t("leap.title")}</h4>
      {def.leapRules.length === 0 && <p className="cal-help">{t("leap.none")}</p>}
      <ol className="cal-rows">
        {def.leapRules.map((l, i) => (
          <li key={l.id} className="cal-row cal-row-leap">
            <input type="text" aria-label={t("leap.nameAria", { n: i + 1 })} placeholder={t("leap.namePlaceholder")} value={l.name} maxLength={80} onChange={(e) => setLeap(def.leapRules.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)))} />
            <label className="cal-inline">
              <span>{t("fields.add")}</span>
              <input type="number" min={1} aria-label={t("leap.daysAria", { name: l.name || t("leap.rule") })} value={l.days} onChange={(e) => setLeap(def.leapRules.map((x) => (x.id === l.id ? { ...x, days: num(e.target.value, 0) } : x)))} />
              <span>{t("leap.toEndOf")}</span>
              <select aria-label={t("leap.monthAria", { name: l.name || t("leap.rule") })} value={l.periodId} onChange={(e) => setLeap(def.leapRules.map((x) => (x.id === l.id ? { ...x, periodId: e.target.value } : x)))}>
                {def.periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {advanced ? (
              <RuleFields label={l.name || t("leap.rule")} rule={l.rule} onChange={(rule) => setLeap(def.leapRules.map((x) => (x.id === l.id ? { ...x, rule } : x)))} />
            ) : (
              <label className="cal-inline">
                <span>{t("leap.every")}</span>
                <input type="number" min={1} aria-label={t("leap.everyAria")} value={l.rule.every} onChange={(e) => setLeap(def.leapRules.map((x) => (x.id === l.id ? { ...x, rule: { ...x.rule, every: num(e.target.value) } } : x)))} />
                <span>{t("rule.years")}</span>
              </label>
            )}
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("fields.remove", { label: l.name || t("leap.ruleLower") })} onClick={() => setLeap(def.leapRules.filter((x) => x.id !== l.id))}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="btn btn-sm"
        disabled={def.periods.length === 0}
        onClick={() => setLeap([...def.leapRules, { id: newId("leap"), name: t("default.leapDay"), periodId: def.periods.at(-1)?.id ?? "", days: 1, rule: { every: 4, offset: 0, exceptions: [] } }])}
      >
        <Plus size={14} /> {t("leap.addRule")}
      </button>
      {advanced && <p className="cal-help">{t("leap.help")}</p>}
    </div>
  );
}
