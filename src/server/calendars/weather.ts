import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { calendarWeather } from "@/server/db/schema";
import { resolveArticleNames } from "@/server/articles/lookup";
import type { WeatherDay } from "@/lib/weather/generate";

/** The same range the world's current day allows. */
export const MAX_WORLD_DAY = 100_000_000;

export interface PlaceLink {
  id: string;
  name: string;
}

/** A weather day attached to the calendar, as the client sees it; a place in the trash or gone is null. */
export interface ClientWeather {
  id: string;
  worldDay: number;
  day: WeatherDay;
  settlement: PlaceLink | null;
  territory: PlaceLink | null;
}

/** The weather attached to one day, oldest first, with the live names of its places. */
export async function weatherOnDay(worldId: string, worldDay: number): Promise<ClientWeather[]> {
  const rows = await db
    .select()
    .from(calendarWeather)
    .where(and(eq(calendarWeather.worldId, worldId), eq(calendarWeather.worldDay, worldDay)))
    .orderBy(calendarWeather.createdAt);
  const refs = rows.flatMap((r) => [
    ...(r.settlementId ? [{ template: "settlement", articleId: r.settlementId }] : []),
    ...(r.territoryId ? [{ template: "territory", articleId: r.territoryId }] : []),
  ]);
  const names = refs.length ? await resolveArticleNames(worldId, refs) : new Map<string, string>();
  const place = (id: string | null) => (id && names.has(id) ? { id, name: names.get(id)! } : null);
  return rows.map((r) => ({ id: r.id, worldDay: r.worldDay, day: JSON.parse(r.data) as WeatherDay, settlement: place(r.settlementId), territory: place(r.territoryId) }));
}

/** Which of these attachments still exist, and on which day (for the generator's history). */
export async function attachedDays(worldId: string, ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const rows = await db
    .select({ id: calendarWeather.id, worldDay: calendarWeather.worldDay })
    .from(calendarWeather)
    .where(and(eq(calendarWeather.worldId, worldId), inArray(calendarWeather.id, ids)));
  return Object.fromEntries(rows.map((r) => [r.id, r.worldDay]));
}
