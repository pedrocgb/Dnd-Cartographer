import type { CalendarDefinition } from "@/server/calendars/engine";
import type { CelestialConfig, CelestialType } from "@/server/calendars/celestial";
import type { SeasonProfileData } from "@/server/calendars/seasons";
import type { OccurrenceException, Recurrence } from "@/server/calendars/recurrence";
import type { Impact } from "@/server/calendars/impact";

export type ArticleRef = { template: string; articleId: string };

export interface Chronology {
  currentDay: number;
  defaultCalendarId: string | null;
  revision: number;
}

export interface ClientCalendar {
  id: string;
  name: string;
  description: string;
  definition: CalendarDefinition;
  articleLinks: ArticleRef[];
  version: number;
  /** In the Trash: hidden from lists and pickers, still read by what already uses it. */
  trashed: boolean;
  sortOrder: number;
}

export interface ClientCelestial {
  id: string;
  type: CelestialType;
  name: string;
  color: string;
  icon: string;
  description: string;
  articleLinks: ArticleRef[];
  config: CelestialConfig;
  /** Its symbol is drawn on calendar days. */
  showDayIcon: boolean;
  prioritizeDayIcon: boolean;
  /** Calendars it shows in; null = every calendar, new ones included. */
  calendarIds: string[] | null;
  version: number;
  archived: boolean;
}

export interface ClientSeason {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  articleLinks: ArticleRef[];
  /** The calendar whose profiles can use it; null = shared by every calendar. */
  calendarId: string | null;
  archived: boolean;
}

export interface ClientProfile {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  version: number;
  archived: boolean;
  data: SeasonProfileData;
}

export type EntryKind = "note" | "event" | "link";

export interface ClientEntry {
  id: string;
  kind: EntryKind;
  worldDay: number;
  durationDays: number;
  title: string;
  description: string;
  documentId: string | null;
  category: string;
  color: string;
  articleTemplate: string | null;
  articleId: string | null;
  articleLinks: ArticleRef[];
  recurrence: Recurrence;
  untilDay: number | null;
  exceptions: Record<string, OccurrenceException>;
  source: { calendarId: string; version: number } | null;
}

export interface WorldCalendars {
  chronology: Chronology;
  calendars: ClientCalendar[];
  celestial: ClientCelestial[];
  seasons: ClientSeason[];
  profiles: ClientProfile[];
}

export type { Impact };

export type CalendarView = "month" | "year" | "agenda";
