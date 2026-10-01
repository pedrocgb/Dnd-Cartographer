import { eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { articles, calendarEntries, calendars, maps, organizations, people, territories } from "../db/schema";
import { trashedDescendantsLookup, type TrashRef } from "./trash";

/**
 * Takes items back out of the Trash. A map comes back with the sub-maps
 * trashed together with it (same deletedAt), and as a root when its parent
 * is gone or still trashed; a territory likewise loses a trashed or missing
 * parent. Relations, mentions and marker links were never removed, so they
 * show again on their own.
 */
export async function restoreItems(refs: TrashRef[]): Promise<void> {
  const now = new Date();
  const ids = (kind: TrashRef["kind"]) => refs.filter((r) => r.kind === kind).map((r) => r.id);

  const mapIds = ids("map");
  if (mapIds.length > 0) {
    const all = await db.select({ id: maps.id, parentId: maps.parentId, deletedAt: maps.deletedAt }).from(maps);
    const nodes = all.map((m) => ({ id: m.id, parentId: m.parentId, deletedAt: m.deletedAt ? m.deletedAt.getTime() : null }));
    const byId = new Map(nodes.map((m) => [m.id, m]));
    const descendantsOf = trashedDescendantsLookup(nodes);
    for (const id of mapIds) {
      const root = byId.get(id);
      if (!root || root.deletedAt === null) continue;
      const parent = root.parentId ? byId.get(root.parentId) : undefined;
      const parentId = parent && parent.deletedAt === null ? parent.id : null;
      const batch = descendantsOf(id).filter((m) => m.deletedAt === root.deletedAt).map((m) => m.id);
      await db.update(maps).set({ deletedAt: null, parentId, updatedAt: now }).where(eq(maps.id, id));
      if (batch.length > 0) await db.update(maps).set({ deletedAt: null, updatedAt: now }).where(inArray(maps.id, batch));
    }
  }

  const territoryIds = ids("territory");
  if (territoryIds.length > 0) {
    const pick = { id: territories.id, parentId: territories.parentId, deletedAt: territories.deletedAt };
    const rows = await db.select(pick).from(territories).where(inArray(territories.id, territoryIds));
    const parentIds = [...new Set(rows.flatMap((r) => (r.parentId ? [r.parentId] : [])))];
    const parents = parentIds.length > 0 ? await db.select(pick).from(territories).where(inArray(territories.id, parentIds)) : [];
    const parentById = new Map(parents.map((p) => [p.id, p]));
    for (const row of rows) {
      const parent = row.parentId ? parentById.get(row.parentId) : undefined;
      // Keep a parent that's live, or coming back in this same restore.
      const parentId = parent && (!parent.deletedAt || territoryIds.includes(parent.id)) ? parent.id : null;
      await db.update(territories).set({ deletedAt: null, parentId, updatedAt: now }).where(eq(territories.id, row.id));
    }
  }

  const simple = [
    [articles, ids("article")],
    [people, ids("person")],
    [organizations, ids("organization")],
    [calendars, ids("calendar")],
    [calendarEntries, ids("calendarEntry")],
  ] as const;
  for (const [table, tableIds] of simple) {
    if (tableIds.length > 0) await db.update(table).set({ deletedAt: null, updatedAt: now }).where(inArray(table.id, tableIds));
  }
}
