import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { maps, mapCategories, mapAssets } from "../db/schema";

export interface MapSummary {
  id: string;
  name: string;
  parentId: string | null;
  categoryId: string | null;
  categoryLabel: string | null;
  currentAssetId: string | null;
  thumbnailKey: string | null;
  assetState: string | null;
  childCount: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Fetches every map in the world with the metadata the map manager and
 * detail views need (category label, child count, thumbnail). Computed
 * in memory rather than with SQL aggregates — fine at personal-worldbuilding
 * scale, and keeps cycle/child-count logic in one place with hierarchy.ts.
 */
export async function listMapSummaries(worldId: string, { includeDeleted = false } = {}): Promise<MapSummary[]> {
  const [mapRows, categoryRows, assetRows] = await Promise.all([
    db.select().from(maps).where(eq(maps.worldId, worldId)),
    db.select().from(mapCategories).where(eq(mapCategories.worldId, worldId)),
    db.select().from(mapAssets),
  ]);

  const categoryById = new Map(categoryRows.map((c) => [c.id, c.label]));
  const assetById = new Map(assetRows.map((a) => [a.id, a]));
  const childCounts = new Map<string, number>();
  for (const m of mapRows) {
    if (m.parentId && !m.deletedAt) {
      childCounts.set(m.parentId, (childCounts.get(m.parentId) ?? 0) + 1);
    }
  }

  return mapRows
    .filter((m) => includeDeleted || !m.deletedAt)
    .map((m) => {
      const asset = m.currentAssetId ? assetById.get(m.currentAssetId) : undefined;
      return {
        id: m.id,
        name: m.name,
        parentId: m.parentId,
        categoryId: m.categoryId,
        categoryLabel: m.categoryId ? categoryById.get(m.categoryId) ?? null : null,
        currentAssetId: m.currentAssetId,
        thumbnailKey: asset?.thumbnailKey ?? null,
        assetState: asset?.state ?? null,
        childCount: childCounts.get(m.id) ?? 0,
        deletedAt: m.deletedAt,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      };
    });
}

export interface BreadcrumbEntry {
  id: string;
  name: string;
}

export async function getBreadcrumbs(mapId: string): Promise<BreadcrumbEntry[]> {
  const rows = await db.select({ id: maps.id, name: maps.name, parentId: maps.parentId }).from(maps);
  const byId = new Map(rows.map((r) => [r.id, r]));

  const trail: BreadcrumbEntry[] = [];
  let cursor = byId.get(mapId);
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor.id)) break; // defensive: a pre-existing cycle shouldn't infinite-loop the UI
    seen.add(cursor.id);
    trail.unshift({ id: cursor.id, name: cursor.name });
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return trail;
}
