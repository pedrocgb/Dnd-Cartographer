"use client";

import type { ClientCalendar, ClientSeason } from "./types";
import { useT } from "@/i18n/useT";

/** Seasons a calendar's profiles can use: its own and the shared ones. */
export const seasonsFor = (seasons: ClientSeason[], calendarId: string) => seasons.filter((s) => s.calendarId === null || s.calendarId === calendarId);

/** One tab per calendar (hidden when there is only one), with an optional count badge. */
export function CalendarTabs({ calendars, value, count, onChange }: { calendars: ClientCalendar[]; value: string; count: (c: ClientCalendar) => number; onChange: (id: string) => void }) {
  const t = useT("calendars");
  if (calendars.length < 2) return null;
  return (
    <nav className="cal-editor-tabs" role="tablist" aria-label={t("calendarTabs")}>
      {calendars.map((c) => (
        <button key={c.id} type="button" role="tab" aria-selected={c.id === value} className={c.id === value ? "cal-tab active" : "cal-tab"} onClick={() => onChange(c.id)}>
          {c.name}
          {count(c) ? <span className="cel-tab-count">{count(c)}</span> : null}
        </button>
      ))}
    </nav>
  );
}
