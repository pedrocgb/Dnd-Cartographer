import { parseStoredHistory, type HistoryItem } from "../tool-history";
import type { WeatherDay } from "./generate";

/** A generated day in the recent list; stored in °C and km/h, shown in the user's units. */
export interface WeatherEntry extends HistoryItem {
  day: WeatherDay;
  /** Ids of its copies attached to the calendar (they outlive the history). */
  attachments?: string[];
}

export function markAttached(entries: WeatherEntry[], id: string, attachmentId: string): WeatherEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, attachments: [...(e.attachments ?? []), attachmentId] } : e));
}

/** A stored history; empty when missing or corrupt. */
export function parseWeatherHistory(raw: string | null): WeatherEntry[] {
  return parseStoredHistory<WeatherEntry>(raw, (e) => {
    const day = e.day as WeatherDay | undefined;
    const attachments = e.attachments;
    const validAttachments = attachments === undefined || (Array.isArray(attachments) && attachments.every((a) => typeof a === "string"));
    return validAttachments && Array.isArray(day?.hours) && day.hours.length === 24 && Array.isArray(day.segments) && Array.isArray(day.effects);
  });
}
