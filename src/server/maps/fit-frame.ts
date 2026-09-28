import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { mapAssets, mapGrids, mapLayers, mapLines, mapTexts, maps, markers, zones } from "../db/schema";
import { MAX_GRID_LINES } from "../grid/grid-config";
import { translateZoneGeometry } from "@/components/paste-geometry";
import { growGrid, growImagePlacement, growMarkerUV, planFrameGrowth, type Frame } from "./frame-growth";

interface Pt {
  x: number;
  y: number;
  cin?: Pt;
  cout?: Pt;
}

function shiftLinePoints(json: string, dx: number, dy: number): string {
  let points: Pt[];
  try {
    points = JSON.parse(json);
  } catch {
    return json; // a corrupt value stays as it was (the client already shows it as empty)
  }
  if (!Array.isArray(points)) return json;
  const move = (p: Pt): Pt => ({ ...p, x: p.x + dx, y: p.y + dy });
  return JSON.stringify(points.map((p) => ({ ...move(p), ...(p.cin ? { cin: move(p.cin) } : {}), ...(p.cout ? { cout: move(p.cout) } : {}) })));
}

function shiftZoneGeometry(json: string, dx: number, dy: number): string {
  try {
    return JSON.stringify(translateZoneGeometry(JSON.parse(json), dx, dy));
  } catch {
    return json;
  }
}

/**
 * Grows the map's frame to cover every layer image (see frame-growth.ts),
 * rewriting all stored coordinates in one transaction — soft-deleted items
 * too, so a restore lands where it was. Returns the new frame, or null when
 * nothing had to change.
 */
export async function fitFrameToImages(mapId: string): Promise<Frame | null> {
  return db.transaction(async (tx) => {
    const map = await tx.query.maps.findFirst({ where: eq(maps.id, mapId) });
    if (!map?.frameWidth || !map.frameHeight) return null;
    const frame: Frame = { width: map.frameWidth, height: map.frameHeight };

    const layers = await tx.select().from(mapLayers).where(eq(mapLayers.mapId, mapId));
    const assets = await tx.select().from(mapAssets).where(and(eq(mapAssets.mapId, mapId), eq(mapAssets.state, "ready")));
    const assetById = new Map(assets.map((a) => [a.id, a]));
    const placed = layers.flatMap((l) => {
      const asset = !l.deletedAt && l.assetId ? assetById.get(l.assetId) : undefined;
      return asset?.width && asset.height ? [{ ...l, assetWidth: asset.width, assetHeight: asset.height }] : [];
    });
    const g = planFrameGrowth(frame, placed);
    if (!g) return null;

    for (const l of layers) {
      await tx.update(mapLayers).set(growImagePlacement(frame, g, l)).where(eq(mapLayers.id, l.id));
    }
    for (const m of await tx.select({ id: markers.id, u: markers.u, v: markers.v }).from(markers).where(eq(markers.mapId, mapId))) {
      await tx.update(markers).set(growMarkerUV(frame, g, m.u, m.v)).where(eq(markers.id, m.id));
    }
    if (g.dx || g.dy) {
      for (const t of await tx.select({ id: mapTexts.id, x: mapTexts.x, y: mapTexts.y }).from(mapTexts).where(eq(mapTexts.mapId, mapId))) {
        await tx.update(mapTexts).set({ x: t.x + g.dx, y: t.y + g.dy }).where(eq(mapTexts.id, t.id));
      }
      for (const l of await tx.select({ id: mapLines.id, points: mapLines.points }).from(mapLines).where(eq(mapLines.mapId, mapId))) {
        await tx.update(mapLines).set({ points: shiftLinePoints(l.points, g.dx, g.dy) }).where(eq(mapLines.id, l.id));
      }
      for (const z of await tx.select({ id: zones.id, geometry: zones.geometry }).from(zones).where(eq(zones.mapId, mapId))) {
        await tx.update(zones).set({ geometry: shiftZoneGeometry(z.geometry, g.dx, g.dy) }).where(eq(zones.id, z.id));
      }
    }
    for (const grid of await tx.select().from(mapGrids).where(eq(mapGrids.mapId, mapId))) {
      await tx.update(mapGrids).set(growGrid(frame, g, grid, MAX_GRID_LINES)).where(eq(mapGrids.id, grid.id));
    }
    await tx.update(maps).set({ frameWidth: g.width, frameHeight: g.height, updatedAt: new Date() }).where(eq(maps.id, mapId));
    return { width: g.width, height: g.height };
  });
}
