import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { mapAssets, mapLayers } from "../db/schema";
import { encodeLayerIds, normalizeExtraLayerIds } from "./layer-ids";

export type MapLayerRow = typeof mapLayers.$inferSelect;

/** Every map starts with (and always keeps) at least one layer. */
export async function createDefaultLayer(mapId: string): Promise<MapLayerRow> {
  const [layer] = await db.insert(mapLayers).values({ mapId, name: "Layer 1", sortOrder: 0 }).returning();
  return layer;
}

/** Non-deleted layers of a map, top of the list first. */
export async function listLayerRows(mapId: string): Promise<MapLayerRow[]> {
  return db
    .select()
    .from(mapLayers)
    .where(and(eq(mapLayers.mapId, mapId), isNull(mapLayers.deletedAt)))
    .orderBy(asc(mapLayers.sortOrder), asc(mapLayers.createdAt));
}

/**
 * Layers plus the state of the image each one shows or is processing —
 * `asset` is the layer's current image, `pendingAsset` a newer upload that
 * hasn't finished (or failed) tiling yet.
 */
export async function listLayers(mapId: string) {
  let rows = await listLayerRows(mapId);
  // Safety net for maps created outside the normal POST (e.g. an import).
  if (rows.length === 0) rows = [await createDefaultLayer(mapId)];

  const assets = await db.select().from(mapAssets).where(eq(mapAssets.mapId, mapId)).orderBy(asc(mapAssets.createdAt));
  const byId = new Map(assets.map((a) => [a.id, a]));

  return rows.map((layer) => {
    const current = layer.assetId ? byId.get(layer.assetId) ?? null : null;
    const latest = assets.filter((a) => a.layerId === layer.id).at(-1) ?? null;
    const pending = latest && latest.id !== current?.id && latest.state !== "ready" && latest.state !== "cancelled" ? latest : null;
    return {
      id: layer.id,
      mapId: layer.mapId,
      name: layer.name,
      sortOrder: layer.sortOrder,
      visible: layer.visible,
      imageOpacity: layer.imageOpacity,
      imageAlwaysVisible: layer.imageAlwaysVisible,
      zonesAlwaysVisible: layer.zonesAlwaysVisible,
      markersAlwaysVisible: layer.markersAlwaysVisible,
      textsAlwaysVisible: layer.textsAlwaysVisible,
      linesAlwaysVisible: layer.linesAlwaysVisible,
      asset: current && current.state === "ready" ? { id: current.id, width: current.width, height: current.height } : null,
      pendingAsset: pending ? { id: pending.id, state: pending.state } : null,
    };
  });
}

/** A non-deleted layer, or null. */
export async function findLayer(layerId: string): Promise<MapLayerRow | null> {
  const layer = await db.query.mapLayers.findFirst({
    where: and(eq(mapLayers.id, layerId), isNull(mapLayers.deletedAt)),
  });
  return layer ?? null;
}

/** True when `layerId` is a live layer of `mapId` (used to validate client-sent ids). */
export async function isLayerOfMap(layerId: unknown, mapId: string): Promise<boolean> {
  if (typeof layerId !== "string") return false;
  const layer = await findLayer(layerId);
  return layer?.mapId === mapId;
}

/**
 * Validated `extra_layer_ids` column value for an item whose home layer is
 * `homeLayerId`, or null when `raw` isn't a list (leave the column alone).
 */
export async function sanitizeExtraLayerIds(raw: unknown, mapId: string, homeLayerId: string | null): Promise<string | null> {
  const ids = new Set((await listLayerRows(mapId)).map((l) => l.id));
  const normalized = normalizeExtraLayerIds(raw, ids, homeLayerId);
  return normalized ? encodeLayerIds(normalized) : null;
}

/** The top-of-list layer — the fallback target for map-level uploads. */
export async function firstLayer(mapId: string): Promise<MapLayerRow> {
  const rows = await listLayerRows(mapId);
  return rows[0] ?? (await createDefaultLayer(mapId));
}

/** Rewrites sortOrder to follow `orderedIds` (ids not of this map are ignored). */
export async function reorderLayers(mapId: string, orderedIds: string[]): Promise<void> {
  const rows = await listLayerRows(mapId);
  const known = new Set(rows.map((r) => r.id));
  const ids = orderedIds.filter((id) => known.has(id));
  // Layers missing from the request keep their relative order, after the rest.
  for (const r of rows) if (!ids.includes(r.id)) ids.push(r.id);
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) {
      await tx.update(mapLayers).set({ sortOrder: i, updatedAt: new Date() }).where(eq(mapLayers.id, id));
    }
  });
}
