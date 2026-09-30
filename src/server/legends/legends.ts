import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { mapLayers, mapLegends } from "../db/schema";
import { parseLayerIds } from "../layers/layer-ids";
import { parseLegendConfig, type ClientLegend } from "./legend-config";

type LegendRow = typeof mapLegends.$inferSelect;

export function toClientLegend(row: LegendRow): ClientLegend {
  return { id: row.id, mapId: row.mapId, layerId: row.layerId, extraLayerIds: parseLayerIds(row.extraLayerIds), visible: row.visible, config: parseLegendConfig(row.config) };
}

/** Every legend of the map whose layer still exists. */
export async function listLegends(mapId: string): Promise<ClientLegend[]> {
  const live = await db.select({ id: mapLayers.id }).from(mapLayers).where(and(eq(mapLayers.mapId, mapId), isNull(mapLayers.deletedAt)));
  if (!live.length) return [];
  const rows = await db.select().from(mapLegends).where(and(eq(mapLegends.mapId, mapId), inArray(mapLegends.layerId, live.map((l) => l.id))));
  return rows.map(toClientLegend);
}
