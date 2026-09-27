"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { usePopover } from "@/components/usePopover";
import { fromWorldDay, type CalendarDefinition } from "@/server/calendars/engine";
import { dayLabel, monthBlock, periodsOf, safe, stepPeriod, type MonthCell } from "./evaluate";

/** Width of one day column in the popup, gap included. */
const CELL_PX = 38;
const MIN_POP_PX = 296;

type Shown = { year: number; periodId: string };

/**
 * A date picker for a world calendar (world day in and out), shaped like the
 * real-date `DatePicker`: a button showing the date that opens a month grid.
 * The grid follows the definition — any week length (columns and headers
 * from its weekdays), any month length, special periods (in the month list,
 * stepped through like months), days outside the week (a strip under the
 * grid), no weekdays at all (plain rows of 10), and years without a year 0.
 * `min` disables earlier days; `currentDay` marks the world's today.
 */
export default function WorldDatePicker({
  def,
  value,
  onChange,
  label,
  currentDay = null,
  min = null,
}: {
  def: CalendarDefinition;
  value: number;
  onChange: (worldDay: number) => void;
  label: string;
  currentDay?: number | null;
  min?: number | null;
}) {
  const { open, setOpen, root, trigger, pop } = usePopover();
  const [shown, setShown] = useState<Shown | null>(null);
  // The year box's text while typing (null: show the viewed year).
  const [yearDraft, setYearDraft] = useState<string | null>(null);

  const shownOf = (day: number): Shown | null => safe(() => {
    const d = fromWorldDay(def, day);
    return { year: d.year, periodId: d.periodId };
  }, null);

  function toggle() {
    if (!open) {
      setShown(shownOf(value) ?? (currentDay !== null ? shownOf(currentDay) : null));
      setYearDraft(null);
    }
    setOpen(!open);
  }
  function pick(day: number) {
    onChange(day);
    setOpen(false);
  }
  function goToYear(year: number) {
    const list = periodsOf(def, year);
    if (!shown || list.length === 0) return;
    setShown({ year, periodId: list.some((p) => p.period.id === shown.periodId) ? shown.periodId : list[0].period.id });
  }
  function typeYear(text: string) {
    setYearDraft(text);
    if (!shown || !/^-?\d+$/.test(text.trim())) return;
    let year = Number(text);
    // The number box's arrows step through 0; a calendar without it jumps over.
    if (year === 0 && !def.year.hasYearZero) {
      year = shown.year > 0 ? -1 : 1;
      setYearDraft(String(year));
    }
    goToYear(year);
  }

  const periods = shown ? periodsOf(def, shown.year) : [];
  const block = shown ? monthBlock(def, shown.year, shown.periodId) : null;
  const weekdays = def.weekdays;
  const cols = weekdays.length || 10;
  const popWidth = Math.max(MIN_POP_PX, cols * CELL_PX + 26);
  const badYear = yearDraft !== null && yearDraft.trim() !== "" && shown !== null && String(shown.year) !== yearDraft.trim();

  function dayButton(cell: MonthCell) {
    const selected = cell.worldDay === value;
    const disabled = min !== null && cell.worldDay < min;
    const classes = ["dp-day", selected && "selected", cell.worldDay === currentDay && "today"].filter(Boolean).join(" ");
    return (
      <button key={cell.worldDay} type="button" role="gridcell" className={classes} aria-selected={selected} disabled={disabled} aria-label={dayLabel(def, cell.worldDay)} onClick={() => pick(cell.worldDay)}>
        {cell.day}
      </button>
    );
  }

  return (
    <div className="dp" ref={root}>
      <div className="dp-field">
        <button type="button" ref={trigger} className="dp-trigger" aria-label={`${label}: ${dayLabel(def, value)}`} aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
          <CalendarDays size={15} aria-hidden />
          <span>{dayLabel(def, value)}</span>
        </button>
      </div>
      {open &&
        createPortal(
          // Hidden until positioned, so it never flashes at the corner.
          <div className="dp-pop" ref={pop} role="dialog" aria-label={label} style={{ visibility: "hidden", width: `min(${popWidth}px, calc(100vw - 16px))` }}>
            {shown ? (
              <>
                <div className="dp-head">
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Previous month" onClick={() => (setShown(stepPeriod(def, shown.year, shown.periodId, -1)), setYearDraft(null))}>
                    <ChevronLeft size={16} />
                  </button>
                  <div className="dp-title">
                    <select aria-label="Month" value={shown.periodId} onChange={(e) => setShown({ ...shown, periodId: e.target.value })}>
                      {periods.map((p) => (
                        <option key={p.period.id} value={p.period.id}>
                          {p.period.name}
                          {p.period.kind === "special" ? " (special)" : ""}
                        </option>
                      ))}
                    </select>
                    <span className="wdp-year">
                      <input type="number" aria-label="Year" value={yearDraft ?? shown.year} onChange={(e) => typeYear(e.target.value)} onBlur={() => setYearDraft(null)} />
                      {def.year.suffix && <span className="cal-date-suffix">{def.year.suffix}</span>}
                    </span>
                  </div>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Next month" onClick={() => (setShown(stepPeriod(def, shown.year, shown.periodId, 1)), setYearDraft(null))}>
                    <ChevronRight size={16} />
                  </button>
                </div>
                {badYear && <p className="wdp-note">That year can&apos;t be shown{!def.year.hasYearZero && yearDraft?.trim() === "0" ? " (this calendar has no year 0)" : ""}.</p>}
                {block && block.rows.length > 0 && (
                  <div className="dp-grid" role="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                    {weekdays.map((w) => (
                      <span key={w.id} className="dp-weekday" role="columnheader" data-tooltip={w.name}>
                        {w.short || w.name.slice(0, 3)}
                      </span>
                    ))}
                    {block.rows.flatMap((row, r) => row.map((cell, c) => (cell ? dayButton(cell) : <span key={`pad-${r}-${c}`} aria-hidden />)))}
                  </div>
                )}
                {block && block.outOfWeek.length > 0 && (
                  <div className="wdp-strip">
                    <span className="wdp-strip-label">{block.rows.length > 0 ? "Outside the week" : block.special ? `${block.name} (special days)` : block.name}</span>
                    <div className="wdp-strip-days">{block.outOfWeek.map(dayButton)}</div>
                  </div>
                )}
                {!block && <p className="wdp-note">This month can&apos;t be shown.</p>}
              </>
            ) : (
              <p className="wdp-note">This date is outside the calendar&apos;s supported range.</p>
            )}
            <div className="dp-foot">
              {currentDay !== null && (
                <button type="button" className="btn btn-ghost btn-sm" disabled={min !== null && currentDay < min} onClick={() => pick(currentDay)}>
                  Today
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setShown(shownOf(value)), setYearDraft(null))}>
                Selected
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
