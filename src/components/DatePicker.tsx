"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { usePopover } from "./usePopover";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type Ymd = { y: number; m: number; d: number };

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = ({ y, m, d }: Ymd) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parseIso = (v: string | null): Ymd | null => {
  const match = v ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  return match ? { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) } : null;
};
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const todayYmd = (): Ymd => {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
};
const same = (a: Ymd | null, b: Ymd) => !!a && a.y === b.y && a.m === b.m && a.d === b.d;

/** "27 September 2026". */
export const formatIsoDate = (v: string | null) => {
  const x = parseIso(v);
  return x ? `${x.d} ${MONTHS[x.m]} ${x.y}` : "";
};

/**
 * A real-world date picker (ISO YYYY-MM-DD in and out): a button showing
 * the date that opens a month grid with month/year navigation, Today and
 * Clear. Esc or a click outside closes it. The grid floats over the page
 * (portaled to <body>), so it never stretches or clips a modal.
 */
export default function DatePicker({ value, onChange, label, placeholder = "Pick a date" }: { value: string | null; onChange: (iso: string | null) => void; label: string; placeholder?: string }) {
  const selected = parseIso(value);
  const { open, setOpen, root, trigger, pop } = usePopover();
  const [shown, setShown] = useState(() => {
    const base = selected ?? todayYmd();
    return { y: base.y, m: base.m };
  });

  function toggle() {
    if (!open) {
      const base = selected ?? todayYmd();
      setShown({ y: base.y, m: base.m });
    }
    setOpen(!open);
  }
  const step = (delta: number) => setShown(({ y, m }) => ({ y: y + Math.floor((m + delta) / 12), m: (((m + delta) % 12) + 12) % 12 }));
  function pick(d: Ymd) {
    onChange(toIso(d));
    setOpen(false);
  }

  const first = new Date(Date.UTC(shown.y, shown.m, 1)).getUTCDay();
  const count = daysIn(shown.y, shown.m);
  const prevCount = daysIn(shown.y, shown.m - 1);
  const today = todayYmd();
  // Six weeks, padded with the neighboring months' days.
  const cells: { date: Ymd; outside: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const n = i - first + 1;
    if (n < 1) cells.push({ date: { y: shown.m === 0 ? shown.y - 1 : shown.y, m: (shown.m + 11) % 12, d: prevCount + n }, outside: true });
    else if (n > count) cells.push({ date: { y: shown.m === 11 ? shown.y + 1 : shown.y, m: (shown.m + 1) % 12, d: n - count }, outside: true });
    else cells.push({ date: { y: shown.y, m: shown.m, d: n }, outside: false });
  }
  const years = Array.from({ length: 121 }, (_, i) => today.y - 100 + i);

  return (
    <div className="dp" ref={root}>
      <div className="dp-field">
        <button type="button" ref={trigger} className="dp-trigger" aria-label={`${label}: ${value ? formatIsoDate(value) : "not set"}`} aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
          <CalendarDays size={15} aria-hidden />
          <span className={value ? undefined : "dp-placeholder"}>{value ? formatIsoDate(value) : placeholder}</span>
        </button>
        {value && (
          <button type="button" className="btn btn-ghost btn-icon btn-sm dp-clear" aria-label={`Clear ${label}`} onClick={() => onChange(null)}>
            <X size={14} />
          </button>
        )}
      </div>
      {open &&
        createPortal(
          // Hidden until positioned, so it never flashes at the corner.
          <div className="dp-pop" ref={pop} role="dialog" aria-label={label} style={{ visibility: "hidden" }}>
          <div className="dp-head">
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Previous month" onClick={() => step(-1)}>
              <ChevronLeft size={16} />
            </button>
            <div className="dp-title">
              <select aria-label="Month" value={shown.m} onChange={(e) => setShown({ ...shown, m: Number(e.target.value) })}>
                {MONTHS.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
              <select aria-label="Year" value={shown.y} onChange={(e) => setShown({ ...shown, y: Number(e.target.value) })}>
                {!years.includes(shown.y) && <option value={shown.y}>{shown.y}</option>}
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Next month" onClick={() => step(1)}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="dp-grid" role="grid">
            {WEEKDAYS.map((w) => (
              <span key={w} className="dp-weekday" role="columnheader">
                {w}
              </span>
            ))}
            {cells.map(({ date, outside }) => {
              const classes = ["dp-day", outside && "outside", same(selected, date) && "selected", same(today, date) && "today"].filter(Boolean).join(" ");
              return (
                <button key={toIso(date)} type="button" role="gridcell" className={classes} aria-selected={same(selected, date)} aria-label={`${date.d} ${MONTHS[date.m]} ${date.y}`} onClick={() => pick(date)}>
                  {date.d}
                </button>
              );
            })}
          </div>
          <div className="dp-foot">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => pick(today)}>
              Today
            </button>
            {value && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>,
          document.body
        )}
    </div>
  );
}
