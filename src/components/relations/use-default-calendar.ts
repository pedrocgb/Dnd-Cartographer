"use client";

import { useEffect, useState } from "react";
import { loadWorldCalendars } from "@/components/calendars/profile-lookup";
import type { CalendarDefinition } from "@/server/calendars/engine";

export type DefaultCalendar = { def: CalendarDefinition; currentDay: number };

/**
 * The world's default calendar and current day, and whether it's still
 * loading (`calendar` stays null without calendars). `enabled` false skips
 * the request (a component that may not need it).
 */
export function useDefaultCalendarStatus(enabled = true): { calendar: DefaultCalendar | null; loading: boolean } {
  const [state, setState] = useState<{ calendar: DefaultCalendar | null; loading: boolean }>({ calendar: null, loading: enabled });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadWorldCalendars()
      .then((world) => {
        if (cancelled) return;
        const c = world && (world.calendars.find((x) => x.id === world.chronology.defaultCalendarId) ?? world.calendars.find((x) => !x.archived));
        setState({ calendar: c && world ? { def: c.definition, currentDay: world.chronology.currentDay } : null, loading: false });
      })
      .catch(() => !cancelled && setState({ calendar: null, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return state;
}

/** The world's default calendar and current day, for relation dates (null until loaded, or without calendars). */
export function useDefaultCalendar() {
  return useDefaultCalendarStatus().calendar;
}
