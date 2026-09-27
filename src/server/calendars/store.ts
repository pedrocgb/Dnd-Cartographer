/**
 * Calendar persistence: the world's chronology, calendars, celestial
 * objects, seasons, profiles and dated entries. Routes stay thin; every
 * query is scoped to the (single, default) world. The app has no user
 * accounts or roles yet, so "authorized" means "belongs to this world" —
 * references are checked against it here, at persistence.
 */
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  calendarEntries,
  calendars,
  celestialObjects,
  definitionRevisions,
  seasonProfiles,
  seasons,
  worldChronology,
} from "@/server/db/schema";
import type { CalendarDefinition } from "./engine";
import { ParseError } from "./parse";
import type { CelestialConfig, CelestialType } from "./celestial";
import type { SeasonProfileData } from "./seasons";
import type { OccurrenceException, Recurrence } from "./recurrence";
import { safeJson } from "./parse";

export type CalendarRow = typeof calendars.$inferSelect;
export type EntryRow = typeof calendarEntries.$inferSelect;

export async function chronologyOf(worldId: string) {
  const [row] = await db.select().from(worldChronology).where(eq(worldChronology.worldId, worldId));
  if (row) return row;
  const [created] = await db.insert(worldChronology).values({ worldId }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(worldChronology).where(eq(worldChronology.worldId, worldId)))[0];
}

export class StaleError extends Error {}

/**
 * Compare-and-set on the chronology revision: the write only lands when
 * nobody changed the current day / default since `expectedRevision`.
 */
export async function updateChronology(worldId: string, expectedRevision: number, patch: { currentDay?: number; defaultCalendarId?: string | null }) {
  await chronologyOf(worldId);
  const rows = await db
    .update(worldChronology)
    .set({ ...patch, revision: sql`${worldChronology.revision} + 1`, updatedAt: new Date() })
    .where(and(eq(worldChronology.worldId, worldId), eq(worldChronology.revision, expectedRevision)))
    .returning();
  if (rows.length === 0) throw new StaleError("Someone else changed the world date. The latest date has been loaded; try again.");
  return rows[0];
}

export const toClientCalendar = (row: CalendarRow) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  definition: safeJson<CalendarDefinition | null>(row.definition, null),
  articleLinks: safeJson<{ template: string; articleId: string }[]>(row.articleLinks, []),
  version: row.version,
  archived: row.archivedAt !== null,
  sortOrder: row.sortOrder,
});

/** Throws unless every id is a calendar of this world (archived ones included). */
export async function checkCalendarIds(worldId: string, ids: string[] | null) {
  if (!ids) return;
  const known = new Set((await db.select({ id: calendars.id }).from(calendars).where(eq(calendars.worldId, worldId))).map((r) => r.id));
  if (ids.some((id) => !known.has(id))) throw new ParseError("One of the chosen calendars doesn't exist.");
}

export const toClientCelestial = (row: typeof celestialObjects.$inferSelect) => ({
  id: row.id,
  type: row.type as CelestialType,
  name: row.name,
  color: row.color,
  icon: row.icon,
  description: row.description,
  articleLinks: safeJson<{ template: string; articleId: string }[]>(row.articleLinks, []),
  config: safeJson<CelestialConfig>(row.config, {}),
  showDayIcon: row.showDayIcon,
  prioritizeDayIcon: row.prioritizeDayIcon,
  calendarIds: row.calendarIds === null ? null : safeJson<string[]>(row.calendarIds, []),
  version: row.version,
  archived: row.archivedAt !== null,
});

export const toClientSeason = (row: typeof seasons.$inferSelect) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  color: row.color,
  icon: row.icon,
  articleLinks: safeJson<{ template: string; articleId: string }[]>(row.articleLinks, []),
  calendarId: row.calendarId,
  archived: row.archivedAt !== null,
});

export const toClientProfile = (row: typeof seasonProfiles.$inferSelect) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  isDefault: row.isDefault,
  version: row.version,
  archived: row.archivedAt !== null,
  data: { ...safeJson<Omit<SeasonProfileData, "calendarId">>(row.data, { mode: "sequential", allowGaps: false, allowOverlaps: false, memberships: [] }), calendarId: row.calendarId },
});

export const toClientEntry = (row: EntryRow) => ({
  id: row.id,
  kind: row.kind,
  worldDay: row.worldDay,
  durationDays: row.durationDays,
  title: row.title,
  description: row.description,
  documentId: row.documentId,
  category: row.category,
  color: row.color,
  articleTemplate: row.articleTemplate,
  articleId: row.articleId,
  articleLinks: safeJson<{ template: string; articleId: string }[]>(row.articleLinks, []),
  recurrence: safeJson<Recurrence>(row.recurrence, { kind: "none" }),
  untilDay: row.untilDay,
  exceptions: safeJson<Record<string, OccurrenceException>>(row.exceptions, {}),
  source: safeJson<{ calendarId: string; version: number } | null>(row.source, null),
});

/** Everything the Calendars page needs up front (all small, world-scoped; entries are range-queried separately). */
export async function loadWorldCalendars(worldId: string) {
  const [chronology, calendarRows, celestialRows, seasonRows, profileRows] = await Promise.all([
    chronologyOf(worldId),
    db.select().from(calendars).where(eq(calendars.worldId, worldId)).orderBy(calendars.sortOrder, calendars.createdAt),
    db.select().from(celestialObjects).where(eq(celestialObjects.worldId, worldId)).orderBy(celestialObjects.createdAt),
    db.select().from(seasons).where(eq(seasons.worldId, worldId)).orderBy(seasons.createdAt),
    db.select().from(seasonProfiles).where(eq(seasonProfiles.worldId, worldId)).orderBy(seasonProfiles.createdAt),
  ]);
  return {
    chronology: { currentDay: chronology.currentDay, defaultCalendarId: chronology.defaultCalendarId, revision: chronology.revision },
    calendars: calendarRows.map(toClientCalendar),
    celestial: celestialRows.map(toClientCelestial),
    seasons: seasonRows.map(toClientSeason),
    profiles: profileRows.map(toClientProfile),
  };
}

export async function calendarOf(worldId: string, id: string) {
  const [row] = await db.select().from(calendars).where(and(eq(calendars.id, id), eq(calendars.worldId, worldId)));
  return row ?? null;
}

/** Live entries touching [from, to]: one-time ones overlapping it, and series that started by `to` and haven't ended before `from`. */
export async function entriesInRange(worldId: string, from: number, to: number) {
  const rows = await db
    .select()
    .from(calendarEntries)
    .where(
      and(
        eq(calendarEntries.worldId, worldId),
        isNull(calendarEntries.deletedAt),
        sql`${calendarEntries.worldDay} <= ${to}`,
        or(
          sql`${calendarEntries.worldDay} + ${calendarEntries.durationDays} - 1 >= ${from}`,
          and(sql`${calendarEntries.recurrence} NOT LIKE '{"kind":"none"%'`, or(isNull(calendarEntries.untilDay), sql`${calendarEntries.untilDay} >= ${from - 1000}`)),
          // An occurrence moved into the range from anywhere.
          sql`${calendarEntries.exceptions} LIKE '%"moveTo"%'`
        )
      )
    )
    .orderBy(calendarEntries.worldDay);
  return rows.map(toClientEntry);
}

/** Live entries linking an article (directly or among an event's links). */
export async function entriesForArticle(worldId: string, articleId: string) {
  const rows = await db
    .select()
    .from(calendarEntries)
    .where(
      and(
        eq(calendarEntries.worldId, worldId),
        isNull(calendarEntries.deletedAt),
        or(eq(calendarEntries.articleId, articleId), sql`${calendarEntries.articleLinks} LIKE ${`%"articleId":"${articleId.replace(/[%_"\\]/g, "")}"%`}`)
      )
    )
    .orderBy(calendarEntries.worldDay)
    .limit(200);
  return rows.map(toClientEntry);
}

export async function liveEntries(worldId: string) {
  return db.select().from(calendarEntries).where(and(eq(calendarEntries.worldId, worldId), isNull(calendarEntries.deletedAt)));
}

export async function recordRevision(
  tx: Pick<typeof db, "insert">,
  worldId: string,
  subjectType: "calendar" | "celestial" | "profile",
  subjectId: string,
  version: number,
  snapshot: unknown,
  reason: string
) {
  await tx.insert(definitionRevisions).values({ worldId, subjectType, subjectId, version, snapshot: JSON.stringify(snapshot), reason });
}
