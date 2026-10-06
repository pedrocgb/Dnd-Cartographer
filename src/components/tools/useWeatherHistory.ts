"use client";

import { useCallback, useMemo } from "react";
import { markAttached, parseWeatherHistory } from "@/lib/weather/history";
import { useLiveLookup } from "./useLiveLookup";
import { useToolHistory } from "./useToolHistory";

const attachmentsUrl = (query: string) => `/api/calendar-weather?ids=${query}`;
const readDays = (data: unknown) => {
  const days = (data as { days?: unknown } | null)?.days;
  return days && typeof days === "object" ? (days as Record<string, number>) : null;
};

/**
 * The recent Weather Generator days of one world (see useToolHistory), each
 * with the calendar days its attached copies are on; one detached or gone
 * from the calendar drops out. Empty until the server answers.
 */
export function useWeatherHistory(worldId: string) {
  const { entries: stored, add, save } = useToolHistory(`weather-history:${worldId}`, parseWeatherHistory);
  const live = useLiveLookup(stored.flatMap((e) => e.attachments ?? []), attachmentsUrl, readDays);
  const entries = useMemo(
    () => stored.map((e) => ({ ...e, calendarDays: live ? (e.attachments ?? []).filter((a) => a in live).map((a) => live[a]) : [] })),
    [stored, live]
  );
  const attach = useCallback((id: string, attachmentId: string) => save((current) => markAttached(current, id, attachmentId)), [save]);
  return { entries, add, attach };
}
