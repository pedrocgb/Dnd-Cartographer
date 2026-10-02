import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapRoutes, maps } from "@/server/db/schema";
import { isLayerOfMap, sanitizeExtraLayerIds } from "@/server/layers/layers";
import { parseLayerIds } from "@/server/layers/layer-ids";
import { folderError, inLockedFolder } from "@/server/maps/layer-folders";
import { sanitizeRouteName, sanitizeRoutePoints, sanitizeRouteStyle, toClientRoute } from "@/server/travel/route-config";
import { sanitizeTravelSettings } from "@/server/travel/travel";
import { notInWorld } from "@/server/world/guards";

/**
 * Style fields, `name`, `visible`, `locked`, `sortOrder`, `points` (redrawn),
 * `settings` (merged over the current ones), `groupId` (a folder on its home
 * layer, or null), `layerId` (leaves a folder of the old layer), `extraLayerIds`.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await notInWorld("map_routes", id, "Route not found.");
  if (denied) return denied;
  const existing = await db.query.mapRoutes.findFirst({ where: eq(mapRoutes.id, id) });
  if (!existing || existing.deletedAt) return NextResponse.json({ error: "Route not found." }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const patch: Partial<typeof mapRoutes.$inferInsert> = { ...sanitizeRouteStyle(body), updatedAt: new Date() };
  if (typeof body.visible === "boolean") patch.visible = body.visible;
  if (typeof body.locked === "boolean") patch.locked = body.locked;
  if (Number.isInteger(body.sortOrder)) patch.sortOrder = body.sortOrder;
  const name = "name" in body ? sanitizeRouteName(body.name) : null;
  if (name !== null) patch.name = name;
  if ("settings" in body) patch.settings = JSON.stringify(sanitizeTravelSettings(body.settings, toClientRoute(existing).settings));
  if ("points" in body) {
    const map = await db.query.maps.findFirst({ where: eq(maps.id, existing.mapId) });
    if (!map?.frameWidth || !map.frameHeight) return NextResponse.json({ error: "Map has no frame." }, { status: 409 });
    const points = sanitizeRoutePoints(body.points, { width: map.frameWidth, height: map.frameHeight });
    if (!points) return NextResponse.json({ error: "A route needs 2 or more valid points." }, { status: 400 });
    patch.points = JSON.stringify(points);
  }
  if ("layerId" in body) {
    if (!(await isLayerOfMap(body.layerId, existing.mapId))) return NextResponse.json({ error: "Layer must belong to the route's map." }, { status: 400 });
    patch.layerId = body.layerId;
  }
  const homeLayerId = patch.layerId ?? existing.layerId;
  if ("groupId" in body && body.groupId !== existing.groupId) {
    if (await inLockedFolder("route", existing.groupId)) return NextResponse.json({ error: "The folder is locked." }, { status: 409 });
    const groupError = await folderError("route", body.groupId, existing.mapId, homeLayerId);
    if (groupError) return NextResponse.json({ error: groupError }, { status: 409 });
    patch.groupId = body.groupId;
  } else if (patch.layerId !== undefined && patch.layerId !== existing.layerId) {
    patch.groupId = null;
  }
  if ("extraLayerIds" in body || patch.layerId !== undefined) {
    const raw = "extraLayerIds" in body ? body.extraLayerIds : parseLayerIds(existing.extraLayerIds);
    const encoded = await sanitizeExtraLayerIds(raw, existing.mapId, homeLayerId);
    if (encoded !== null) patch.extraLayerIds = encoded;
  }

  const [updated] = await db.update(mapRoutes).set(patch).where(eq(mapRoutes.id, id)).returning();
  return NextResponse.json({ route: toClientRoute(updated) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await notInWorld("map_routes", id, "Route not found.");
  if (denied) return denied;
  await db.update(mapRoutes).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(mapRoutes.id, id));
  return NextResponse.json({ ok: true });
}
