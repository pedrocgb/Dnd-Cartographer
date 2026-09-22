import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { zones, zoneRegions } from "@/server/db/schema";
import {
  validateRectGeometry,
  validateCircleGeometry,
  validatePolygonGeometry,
  clampOpacity,
  clampStrokeWidth,
  normalizeColor,
} from "@/server/zones/zone-config";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const zone = await db.query.zones.findFirst({ where: eq(zones.id, id) });
  if (!zone) return NextResponse.json({ error: "Zone not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const region = await db.query.zoneRegions.findFirst({ where: eq(zoneRegions.id, zone.regionId) });
  const structuralKeys = ["name", "geometry", "fillColor", "fillOpacity", "strokeColor", "strokeOpacity", "strokeWidth", "sortOrder", "regionId", "territoryId"];
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
    const geometry =
      zone.shapeType === "rectangle"
        ? validateRectGeometry(body.geometry, imageWidth, imageHeight)
        : zone.shapeType === "circle"
          ? validateCircleGeometry(body.geometry, imageWidth, imageHeight)
          : validatePolygonGeometry(body.geometry, imageWidth, imageHeight);
    if (!geometry) return NextResponse.json({ error: "Invalid or out-of-bounds shape geometry." }, { status: 400 });
    patch.geometry = JSON.stringify(geometry);
  }

  if (typeof body.regionId === "string" && body.regionId !== zone.regionId) {
    const target = await db.query.zoneRegions.findFirst({ where: eq(zoneRegions.id, body.regionId) });
    if (!target || target.mapId !== zone.mapId || target.deletedAt) {
      return NextResponse.json({ error: "Target Region not found on this map." }, { status: 400 });
    }
    if (target.locked) return NextResponse.json({ error: "Target Region is locked." }, { status: 409 });
    patch.regionId = body.regionId;
  }

  const [updated] = await db.update(zones).set(patch).where(eq(zones.id, id)).returning();
  return NextResponse.json({ zone: updated });
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
