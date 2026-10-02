import { count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import { articles, calendars, campaigns, maps, organizations, people, territories, worldChronology, worlds } from "../db/schema";
import { cleanColor, cleanName } from "../calendars/parse";
import { isValidIconKey } from "../markers/icon-registry";

export interface WorldSummary {
  id: string;
  name: string;
  description: string;
  /** Marker icon key for the badge; "" = the name's first letter. */
  icon: string;
  /** "#RRGGBB" tint; "" = one picked from the id. */
  color: string;
  lastOpenedAt: number | null;
  updatedAt: number;
  counts: { maps: number; articles: number; calendars: number; campaigns: number };
}

export const WORLD_NAME_MAX = 80;
export const WORLD_DESCRIPTION_MAX = 4000;

type CountedTable = typeof maps | typeof articles | typeof people | typeof organizations | typeof territories | typeof calendars;

/** Live (not trashed) rows per world, in one grouped query. */
async function liveCounts(table: CountedTable): Promise<Map<string, number>> {
  const rows = await db.select({ worldId: table.worldId, n: count() }).from(table).where(isNull(table.deletedAt)).groupBy(table.worldId);
  return new Map(rows.map((r) => [r.worldId, r.n]));
}

/** Every world with what it holds, the most recently opened first. */
export async function listWorlds(): Promise<WorldSummary[]> {
  const [rows, mapCounts, articleCounts, peopleCounts, orgCounts, territoryCounts, calendarCounts, campaignRows] = await Promise.all([
    db.select().from(worlds).orderBy(desc(sql`coalesce(${worlds.lastOpenedAt}, ${worlds.createdAt})`)),
    liveCounts(maps),
    liveCounts(articles),
    liveCounts(people),
    liveCounts(organizations),
    liveCounts(territories),
    liveCounts(calendars),
    db.select({ worldId: campaigns.worldId, n: count() }).from(campaigns).where(isNull(campaigns.archivedAt)).groupBy(campaigns.worldId),
  ]);
  const campaignCounts = new Map(campaignRows.map((r) => [r.worldId, r.n]));
  const of = (m: Map<string, number>, id: string) => m.get(id) ?? 0;
  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    icon: w.icon,
    color: w.color,
    lastOpenedAt: w.lastOpenedAt?.getTime() ?? null,
    updatedAt: w.updatedAt.getTime(),
    counts: {
      maps: of(mapCounts, w.id),
      articles: of(articleCounts, w.id) + of(peopleCounts, w.id) + of(orgCounts, w.id) + of(territoryCounts, w.id),
      calendars: of(calendarCounts, w.id),
      campaigns: of(campaignCounts, w.id),
    },
  }));
}

export async function worldById(id: string) {
  const [row] = await db.select().from(worlds).where(eq(worlds.id, id));
  return row ?? null;
}

export interface WorldFields {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
}

/** Name, description, icon and color from a request body; `error` when the name is missing or the icon/color is invalid. */
export function parseWorldFields(body: Record<string, unknown>, partial: boolean): WorldFields | { error: string } {
  const fields: WorldFields = {};
  if (!partial || "name" in body) {
    const name = cleanName(body.name, WORLD_NAME_MAX);
    if (!name) return { error: "A world needs a name." };
    fields.name = name;
  }
  if (!partial || "description" in body) fields.description = cleanName(body.description, WORLD_DESCRIPTION_MAX);
  if ("icon" in body) {
    const icon = typeof body.icon === "string" ? body.icon : "";
    if (icon && !isValidIconKey(icon)) return { error: "Unknown icon." };
    fields.icon = icon;
  }
  if ("color" in body) {
    const color = body.color === "" || body.color === null ? "" : cleanColor(body.color);
    if (color === null) return { error: "Colors are #RRGGBB." };
    fields.color = color;
  }
  return fields;
}

/** A new, empty world (with its shared current day at the start). */
export async function createWorld(fields: WorldFields & { name: string }) {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(worlds).values({ ...fields, lastOpenedAt: new Date() }).returning();
    await tx.insert(worldChronology).values({ worldId: row.id }).onConflictDoNothing();
    return row;
  });
}
