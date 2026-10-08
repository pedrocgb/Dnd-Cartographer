"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { usePopover } from "./usePopover";
import { formatRealDate } from "@/server/settings/date-format";
import { activeSettings } from "@/server/settings/active";
import { useSettings } from "./settings/SettingsProvider";
import { useT } from "@/i18n/useT";
import type { Locale } from "@/i18n/config";

/** Month names, weekday initials (Sunday first) and a day's full name, in the language. */
function calendarWords(locale: Locale) {
  const month = new Intl.DateTimeFormat(locale, { month: "long" });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const full = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  return {
    months: Array.from({ length: 12 }, (_, m) => month.format(new Date(2000, m, 1))),
    // 2 January 2000 was a Sunday.
    weekdays: Array.from({ length: 7 }, (_, d) => weekday.format(new Date(2000, 0, 2 + d))),
    dayName: ({ y, m, d }: Ymd) => full.format(new Date(y, m, d)),
  };
}

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

/** An ISO day in the user's real-world date format, e.g. "27/09/2026". */
export const formatIsoDate = (v: string | null) => (parseIso(v) ? formatRealDate(v, activeSettings().realDateFormat) : "");

/**
 * A real-world date picker (ISO YYYY-MM-DD in and out): a button showing
 * the date that opens a month grid with month/year navigation, Today and
 * Clear. Esc or a click outside closes it. The grid floats over the page
 * (portaled to <body>), so it never stretches or clips a modal.
 */
export default function DatePicker({ value, onChange, label, placeholder }: { value: string | null; onChange: (iso: string | null) => void; label: string; placeholder?: string }) {
  const t = useT("common");
  const { language } = useSettings().settings;
  const words = calendarWords(language);
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
        <button type="button" ref={trigger} className="dp-trigger" aria-label={t("datePicker.fieldValue", { label, value: value ? formatIsoDate(value) : t("datePicker.notSet") })} aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
          <CalendarDays size={15} aria-hidden />
          <span className={value ? undefined : "dp-placeholder"}>{value ? formatIsoDate(value) : (placeholder ?? t("datePicker.placeholder"))}</span>
        </button>
        {value && (
          <button type="button" className="btn btn-ghost btn-icon btn-sm dp-clear" aria-label={t("datePicker.clearField", { label })} onClick={() => onChange(null)}>
            <X size={14} />
          </button>
        )}
      </div>
      {open &&
        createPortal(
          // Hidden until positioned, so it never flashes at the corner.
          <div className="dp-pop" ref={pop} role="dialog" aria-label={label} style={{ visibility: "hidden" }}>
          <div className="dp-head">
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("datePicker.previousMonth")} onClick={() => step(-1)}>
              <ChevronLeft size={16} />
            </button>
            <div className="dp-title">
              <select aria-label={t("datePicker.month")} value={shown.m} onChange={(e) => setShown({ ...shown, m: Number(e.target.value) })}>
                {words.months.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
              <select aria-label={t("datePicker.year")} value={shown.y} onChange={(e) => setShown({ ...shown, y: Number(e.target.value) })}>
                {!years.includes(shown.y) && <option value={shown.y}>{shown.y}</option>}
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("datePicker.nextMonth")} onClick={() => step(1)}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="dp-grid" role="grid">
            {words.weekdays.map((w) => (
              <span key={w} className="dp-weekday" role="columnheader">
                {w}
              </span>
            ))}
            {cells.map(({ date, outside }) => {
              const classes = ["dp-day", outside && "outside", same(selected, date) && "selected", same(today, date) && "today"].filter(Boolean).join(" ");
              return (
                <button key={toIso(date)} type="button" role="gridcell" className={classes} aria-selected={same(selected, date)} aria-label={words.dayName(date)} onClick={() => pick(date)}>
                  {date.d}
                </button>
              );
            })}
          </div>
          <div className="dp-foot">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => pick(today)}>
              {t("datePicker.today")}
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
                {t("datePicker.clear")}
              </button>
            )}
          </div>
        </div>,
          document.body
        )}
    </div>
  );
}
