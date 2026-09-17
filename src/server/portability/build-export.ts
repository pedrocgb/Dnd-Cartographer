import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../db/client";
import { worlds, mapCategories, markerCategories, maps, markers, mapAssets, richDocuments } from "../db/schema";
import { originalPath } from "../assets/paths";
import { EXPORT_VERSION, type ExportBundle } from "./types";

export async function buildExport(worldId: string): Promise<ExportBundle> {
  const world = await db.query.worlds.findFirst({ where: eq(worlds.id, worldId) });
  if (!world) throw new Error(`Unknown world: ${worldId}`);

  const [categoryRows, markerCategoryRows, mapRows, markerRows, documentRows] = await Promise.all([
    db.select().from(mapCategories).where(eq(mapCategories.worldId, worldId)),
    db.select().from(markerCategories).where(eq(markerCategories.worldId, worldId)),
    db.select().from(maps).where(eq(maps.worldId, worldId)),
    db.select().from(markers),
    db.select().from(richDocuments).where(eq(richDocuments.worldId, worldId)),
  ]);

  const mapIds = new Set(mapRows.map((m) => m.id));
  const relevantMarkers = markerRows.filter((m) => mapIds.has(m.mapId));

  const exportedMaps = await Promise.all(
    mapRows.map(async (map) => {
      let asset: ExportBundle["maps"][number]["asset"] = null;
      if (map.currentAssetId) {
        const assetRow = await db.query.mapAssets.findFirst({ where: eq(mapAssets.id, map.currentAssetId) });
        if (assetRow && assetRow.state === "ready") {
          const extension = path.extname(assetRow.originalKey);
          const filePath = originalPath(assetRow.id, extension);
          try {
            const bytes = await readFile(filePath);
            asset = {
              originalFileName: `original${extension}`,
              width: assetRow.width,
              height: assetRow.height,
              byteSize: assetRow.byteSize,
              dataBase64: bytes.toString("base64"),
            };
          } catch {
            // Original file missing on disk — export the map without its image rather than failing the whole export.
            asset = null;
          }
        }
      }
      return {
        id: map.id,
        parentId: map.parentId,
        categoryId: map.categoryId,
        name: map.name,
        descriptionDocumentId: map.descriptionDocumentId,
        deletedAt: map.deletedAt ? map.deletedAt.toISOString() : null,
        asset,
      };
    })
  );

  return {
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    worldName: world.name,
    mapCategories: categoryRows.map((c) => ({ id: c.id, label: c.label, sortOrder: c.sortOrder })),
    markerCategories: markerCategoryRows.map((c) => ({
      id: c.id,
      label: c.label,
      defaultIconKey: c.defaultIconKey,
      defaultColor: c.defaultColor,
    })),
    documents: documentRows.map((d) => ({
      id: d.id,
      jsonText: d.jsonText,
      plainText: d.plainText,
      schemaVersion: d.schemaVersion,
    })),
    maps: exportedMaps,
    markers: relevantMarkers.map((m) => ({
      id: m.id,
      mapId: m.mapId,
      name: m.name,
      u: m.u,
      v: m.v,
      iconKey: m.iconKey,
      color: m.color,
      backgroundColor: m.backgroundColor,
      outlineColor: m.outlineColor,
      backgroundShape: m.backgroundShape,
      category: m.category,
      categoryId: m.categoryId,
      descriptionDocumentId: m.descriptionDocumentId,
      linkedMapId: m.linkedMapId,
      locked: m.locked,
      statusTags: m.statusTags,
      environment: m.environment,
      ownership: m.ownership,
      deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
    })),
  };
}
