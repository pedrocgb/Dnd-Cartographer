"use client";

import { useState } from "react";
import { matchesYear, toInternalYear, validateDefinition, weekdayIndex, type CalendarDefinition } from "@/server/calendars/engine";
import { nextYear } from "@/server/calendars/celestial";
import { periodsOf, safe } from "./evaluate";
import { useT } from "@/i18n/useT";

/**
 * Live preview of a draft definition: problems first, then one year's
 * layout (lengths, special and leap days, each month's first weekday),
 * and which of the next years are leap years.
 */
export default function DefinitionPreview({ def }: { def: CalendarDefinition }) {
  const t = useT("calendars");
  const [year, setYear] = useState(def.sync.date.year || 1);
  const issues = validateDefinition(def);
  if (issues.length) {
    return (
      <div className="cal-preview">
        <h3 className="cal-subhead">{t("preview.title")}</h3>
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
  const yearText = `${year}${def.year.suffix ? ` ${def.year.suffix}` : ""}`;
  const weeks = def.weekdays.length ? t("preview.weeks", { n: def.weekdays.length }) : "";
  // {n} is left in place, then split so the total can be bold.
  const [totalBefore, totalAfter] = t("preview.total", { count: total, year: yearText, weeks }).split("{n}");
  const leapYears: number[] = [];
  let y = year;
  for (let n = 0; n < 40 && leapYears.length < 8; n++, y = nextYear(def, y)) {
    const internal = safe(() => toInternalYear(def, y), null);
    if (internal !== null && def.leapRules.some((l) => matchesYear(l.rule, internal))) leapYears.push(y);
  }
  return (
    <div className="cal-preview">
      <div className="cal-preview-head">
        <h3 className="cal-subhead">{t("preview.title")}</h3>
        <label className="cal-inline">
          <span className="field-label">{t("preview.year")}</span>
          <input type="number" value={year} onChange={(e) => Number.isInteger(Number(e.target.value)) && setYear(Number(e.target.value))} aria-label={t("preview.yearAria")} />
        </label>
      </div>
      <p className="cal-preview-total">
        {periods.length ? (
          <>
            {totalBefore}
            <strong>{total}</strong>
            {totalAfter}
          </>
        ) : (
          t("preview.outOfRange", { year: yearText })
        )}
      </p>
      <ol className="cal-preview-months">
        {periods.map((p) => {
          const leap = p.days - p.period.days;
          const first = def.weekdays.length ? safe(() => weekdayIndex(def, { year, periodId: p.period.id, day: 1 }), null) : null;
          return (
            <li key={p.period.id} className={p.period.kind === "special" ? "special" : undefined}>
              <span className="cal-preview-name">{p.period.name || t("preview.unnamed")}</span>
              <span className="cal-preview-days">
                {t("preview.days", { count: p.days, n: p.days })}
                {leap > 0 && <em> {t("preview.leap", { n: leap })}</em>}
              </span>
              <span className="cal-preview-weekday">
                {p.period.kind === "special" && !p.period.inWeek ? t("preview.outsideWeek") : first !== null ? t("preview.startsOn", { weekday: def.weekdays[first].name }) : ""}
              </span>
            </li>
          );
        })}
      </ol>
      {def.leapRules.length > 0 && <p className="cal-help">{t("preview.nextLeap", { years: leapYears.length ? leapYears.join(", ") : t("preview.noLeap") })}</p>}
    </div>
  );
}
