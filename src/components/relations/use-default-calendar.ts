"use client";

import { useEffect, useState } from "react";
import { loadWorldCalendars } from "@/components/calendars/profile-lookup";
import type { CalendarDefinition } from "@/server/calendars/engine";

/** The world's default calendar and current day, for relation dates (null until loaded, or without calendars). */
export function useDefaultCalendar() {
  const [cal, setCal] = useState<{ def: CalendarDefinition; currentDay: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadWorldCalendars()
      .then((world) => {
        if (cancelled || !world) return;
        const c = world.calendars.find((x) => x.id === world.chronology.defaultCalendarId) ?? world.calendars.find((x) => !x.archived);
        if (c) setCal({ def: c.definition, currentDay: world.chronology.currentDay });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return cal;
}
