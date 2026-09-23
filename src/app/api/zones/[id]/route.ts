import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { zones, zoneRegions } from "@/server/db/schema";
import {
  validateZoneGeometry,
  clampOpacity,
  clampStrokeWidth,
  normalizeColor,
} from "@/server/zones/zone-config";
import { sanitizeExtraLayerIds } from "@/server/layers/layers";
import { parseLayerIds, withLayerIds } from "@/server/layers/layer-ids";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const zone = await db.query.zones.findFirst({ where: eq(zones.id, id) });
  if (!zone) return NextResponse.json({ error: "Zone not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const region = await db.query.zoneRegions.findFirst({ where: eq(zoneRegions.id, zone.regionId) });
  const structuralKeys = ["name", "geometry", "shapeType", "fillColor", "fillOpacity", "strokeColor", "strokeOpacity", "strokeWidth", "sortOrder", "regionId", "territoryId"];
  const wantsStructuralChange = structuralKeys.some((k) => k in body);

  // Zone/Region locks protect geometry and structural edits; visibility and
  // the lock flag itself always remain toggleable so a locked zone can still
  // be inspected, hidden, and unlocked.
  if (wantsStructuralChange && zone.locked) {
    return NextResponse.json({ error: "Zone is locked." }, { status: 409 });
  }
  if (wantsStructuralChange && region?.locked) {
    return NextResponse.json({ error: "This zone's Region is locked." }, { status: 409 });
  }

  const patch: Partial<typeof zones.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.visible === "boolean") patch.visible = body.visible;
  if (typeof body.locked === "boolean") patch.locked = body.locked;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;
  if (typeof body.fillColor === "string") patch.fillColor = normalizeColor(body.fillColor, zone.fillColor);
  if (typeof body.strokeColor === "string") patch.strokeColor = normalizeColor(body.strokeColor, zone.strokeColor);
  if (typeof body.fillOpacity === "number") patch.fillOpacity = clampOpacity(body.fillOpacity);
  if (typeof body.strokeOpacity === "number") patch.strokeOpacity = clampOpacity(body.strokeOpacity);
  if (typeof body.strokeWidth === "number") patch.strokeWidth = clampStrokeWidth(body.strokeWidth);
  if ("territoryId" in body) patch.territoryId = body.territoryId === null ? null : String(body.territoryId);

  if (body.geometry) {
    const imageWidth = Number(body.imageWidth);
    const imageHeight = Number(body.imageHeight);
    if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
      return NextResponse.json({ error: "Valid image dimensions are required to validate geometry." }, { status: 400 });
    }
    // Painting onto a rectangle/circle/polygon converts it to an area; no
    // other shape change is possible, since geometry is shape-specific.
    const shapeType = body.shapeType === "area" ? "area" : zone.shapeType;
    // Accept the geometry as an object or as the JSON text the zones table
    // stores (the client long sent the latter, which every edit rejected).
    let rawGeometry: unknown = body.geometry;
    if (typeof rawGeometry === "string") {
      try {
        rawGeometry = JSON.parse(rawGeometry);
      } catch {
        rawGeometry = null;
      }
    }
    const geometry = validateZoneGeometry(shapeType, rawGeometry, imageWidth, imageHeight);
    if (!geometry) return NextResponse.json({ error: "Invalid or out-of-bounds shape geometry." }, { status: 400 });
    patch.geometry = JSON.stringify(geometry);
    patch.shapeType = shapeType;
  }

  if (typeof body.regionId === "string" && body.regionId !== zone.regionId) {
    const target = await db.query.zoneRegions.findFirst({ where: eq(zoneRegions.id, body.regionId) });
    if (!target || target.mapId !== zone.mapId || target.deletedAt) {
      return NextResponse.json({ error: "Target Region not found on this map." }, { status: 400 });
    }
    if (target.locked) return NextResponse.json({ error: "Target Region is locked." }, { status: 409 });
    patch.regionId = body.regionId;
  }

  // "Also show on" layers (a display setting, so allowed on locked zones).
  // A zone's home layer is its region's; re-checked when the region changes.
  if ("extraLayerIds" in body || patch.regionId !== undefined) {
    const homeRegion = patch.regionId
      ? await db.query.zoneRegions.findFirst({ where: eq(zoneRegions.id, patch.regionId) })
      : region;
    const raw = "extraLayerIds" in body ? body.extraLayerIds : parseLayerIds(zone.extraLayerIds);
    const encoded = await sanitizeExtraLayerIds(raw, zone.mapId, homeRegion?.layerId ?? null);
    if (encoded !== null) patch.extraLayerIds = encoded;
  }

  const [updated] = await db.update(zones).set(patch).where(eq(zones.id, id)).returning();
  return NextResponse.json({ zone: withLayerIds(updated) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const zone = await db.query.zones.findFirst({ where: eq(zones.id, id) });
  if (!zone) return NextResponse.json({ error: "Zone not found." }, { status: 404 });
  if (zone.locked) return NextResponse.json({ error: "Zone is locked." }, { status: 409 });

  const region = await db.query.zoneRegions.findFirst({ where: eq(zoneRegions.id, zone.regionId) });
  if (region?.locked) return NextResponse.json({ error: "This zone's Region is locked." }, { status: 409 });

  await db.update(zones).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(zones.id, id));
  return NextResponse.json({ ok: true });
}
