"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays } from "lucide-react";
import type { CalendarDefinition } from "@/server/calendars/engine";
import { api, WORLD_DATE_EVENT } from "./calendars/api";
import { dayLabel } from "./calendars/evaluate";
import { useSettings } from "./settings/SettingsProvider";

interface WorldDate {
  currentDay: number;
  calendar: { id: string; name: string; definition: CalendarDefinition } | null;
}

/**
 * The current in-world date, read in the default calendar, for the top bar
 * (Settings > General). Reloads on navigation and when the date or a
 * calendar changes in this tab (WORLD_DATE_EVENT).
 */
export default function WorldDateLabel() {
  const { settings } = useSettings();
  const enabled = settings.showWorldDate;
  const pathname = usePathname();
  const [date, setDate] = useState<WorldDate | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () =>
      api<{ chronology: { currentDay: number }; calendar: WorldDate["calendar"] }>("GET", "/api/chronology").then((res) => {
        if (!cancelled && res.ok) setDate({ currentDay: res.data.chronology.currentDay, calendar: res.data.calendar });
      });
    void load();
    window.addEventListener(WORLD_DATE_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(WORLD_DATE_EVENT, load);
    };
  }, [enabled, pathname]);

  return (
    <div className="app-nav-date-slot">
      {enabled && date?.calendar && (
        <Link href="/calendars" className="app-nav-date" aria-label={`Current in-world date: ${dayLabel(date.calendar.definition, date.currentDay)}`} data-tooltip={`Current date in ${date.calendar.name}`}>
          <CalendarDays size={15} strokeWidth={2.25} aria-hidden />
          <span className="app-nav-date-text">{dayLabel(date.calendar.definition, date.currentDay)}</span>
        </Link>
      )}
    </div>
  );
}
