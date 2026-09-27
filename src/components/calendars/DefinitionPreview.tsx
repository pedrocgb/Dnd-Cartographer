"use client";

import { useState } from "react";
import { matchesYear, toInternalYear, validateDefinition, weekdayIndex, type CalendarDefinition } from "@/server/calendars/engine";
import { nextYear } from "@/server/calendars/celestial";
import { periodsOf, safe } from "./evaluate";

/**
 * Live preview of a draft definition: problems first, then one year's
 * layout (lengths, special and leap days, each month's first weekday),
 * and which of the next years are leap years.
 */
export default function DefinitionPreview({ def }: { def: CalendarDefinition }) {
  const [year, setYear] = useState(def.sync.date.year || 1);
  const issues = validateDefinition(def);
  if (issues.length) {
    return (
      <div className="cal-preview">
        <h3 className="cal-subhead">Preview</h3>
        <ul className="cal-issues" role="alert">
          {issues.map((i, n) => (
            <li key={n}>{i.message}</li>
          ))}
        </ul>
      </div>
    );
  }
  const periods = periodsOf(def, year);
  const total = periods.reduce((n, p) => n + p.days, 0);
  const leapYears: number[] = [];
  let y = year;
  for (let n = 0; n < 40 && leapYears.length < 8; n++, y = nextYear(def, y)) {
    const internal = safe(() => toInternalYear(def, y), null);
    if (internal !== null && def.leapRules.some((l) => matchesYear(l.rule, internal))) leapYears.push(y);
  }
  return (
    <div className="cal-preview">
      <div className="cal-preview-head">
        <h3 className="cal-subhead">Preview</h3>
        <label className="cal-inline">
          <span className="field-label">Year</span>
          <input type="number" value={year} onChange={(e) => Number.isInteger(Number(e.target.value)) && setYear(Number(e.target.value))} aria-label="Preview year" />
        </label>
      </div>
      <p className="cal-preview-total">
        {periods.length ? (
          <>
            Year {year}
            {def.year.suffix ? ` ${def.year.suffix}` : ""} has <strong>{total}</strong> days
            {def.weekdays.length ? `, weeks of ${def.weekdays.length} days` : ""}.
          </>
        ) : (
          <>Year {year} is outside the supported range, or doesn&apos;t exist.</>
        )}
      </p>
      <ol className="cal-preview-months">
        {periods.map((p) => {
          const leap = p.days - p.period.days;
          const first = def.weekdays.length ? safe(() => weekdayIndex(def, { year, periodId: p.period.id, day: 1 }), null) : null;
          return (
            <li key={p.period.id} className={p.period.kind === "special" ? "special" : undefined}>
              <span className="cal-preview-name">{p.period.name || "Unnamed"}</span>
              <span className="cal-preview-days">
                {p.days} day{p.days === 1 ? "" : "s"}
                {leap > 0 && <em> (+{leap} leap)</em>}
              </span>
              <span className="cal-preview-weekday">
                {p.period.kind === "special" && !p.period.inWeek ? "outside the week" : first !== null ? `starts on ${def.weekdays[first].name}` : ""}
              </span>
            </li>
          );
        })}
      </ol>
      {def.leapRules.length > 0 && <p className="cal-help">Next leap years: {leapYears.length ? leapYears.join(", ") : "none in the next 40 years"}.</p>}
    </div>
  );
}
