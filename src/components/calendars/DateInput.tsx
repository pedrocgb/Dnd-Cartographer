"use client";

import { dateError, type CalendarDefinition, type LocalDate } from "@/server/calendars/engine";
import { periodsOf } from "./evaluate";

/**
 * A fantasy date in one calendar: day, month (the year's own periods,
 * special ones included) and year. Nonexistent dates are shown as an error
 * and never corrected silently.
 */
export default function DateInput({
  def,
  value,
  onChange,
  label,
  compact = false,
  hideYear = false,
}: {
  def: CalendarDefinition;
  value: LocalDate;
  onChange: (date: LocalDate) => void;
  label: string;
  compact?: boolean;
  /** Month and day only (a yearly date); `value.year` is kept as given and only used to list that year's months. */
  hideYear?: boolean;
}) {
  const periods = periodsOf(def, value.year);
  const current = periods.find((p) => p.period.id === value.periodId);
  // A period missing this year stays selectable so the error can explain it.
  const missing = current ? null : def.periods.find((p) => p.id === value.periodId);
  const days = current?.days ?? missing?.days ?? 1;
  const problem = dateError(def, value);

  return (
    <fieldset className={compact ? "cal-date-input compact" : "cal-date-input"}>
      <legend className="field-label">{label}</legend>
      <div className="cal-date-input-row">
        <select aria-label={`${label}: day`} value={value.day} onChange={(e) => onChange({ ...value, day: Number(e.target.value) })}>
          {Array.from({ length: Math.max(days, value.day) }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <select aria-label={`${label}: month`} value={value.periodId} onChange={(e) => onChange({ ...value, periodId: e.target.value, day: Math.min(value.day, periods.find((p) => p.period.id === e.target.value)?.days ?? value.day) })}>
          {periods.map((p) => (
            <option key={p.period.id} value={p.period.id}>
              {p.period.name}
              {p.period.kind === "special" ? " (special)" : ""}
            </option>
          ))}
          {missing && <option value={missing.id}>{missing.name} (not this year)</option>}
        </select>
        {!hideYear && (
          <span className="cal-date-year">
            <input
              type="number"
              aria-label={`${label}: year`}
              value={value.year}
              onChange={(e) => {
                const year = Number(e.target.value);
                if (Number.isInteger(year)) onChange({ ...value, year });
              }}
            />
            {def.year.suffix && <span className="cal-date-suffix">{def.year.suffix}</span>}
          </span>
        )}
      </div>
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
    </fieldset>
  );
}
