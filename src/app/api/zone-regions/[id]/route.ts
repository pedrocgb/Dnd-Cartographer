import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { zoneRegions, zones } from "@/server/db/schema";
import { folderPatch, toClientFolder } from "@/server/maps/layer-folders";
import { notInWorld } from "@/server/world/guards";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await notInWorld("zone_regions", id, "zoneRegionNotFound");
  if (denied) return denied;
  const region = await db.query.zoneRegions.findFirst({ where: eq(zoneRegions.id, id) });
  if (!region) return errorResponse("zoneRegionNotFound", 404);

  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("invalidBody", 400);

  // Name, visible, locked, order, "Also show on" layers and the default style of new zones.
  const result = await folderPatch("zone", body, region);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  const [updated] = await db.update(zoneRegions).set(result.patch).where(eq(zoneRegions.id, id)).returning();
  return NextResponse.json({ region: toClientFolder(updated) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await notInWorld("zone_regions", id, "zoneRegionNotFound");
  if (denied) return denied;
  const region = await db.query.zoneRegions.findFirst({ where: eq(zoneRegions.id, id) });
  if (!region) return errorResponse("zoneRegionNotFound", 404);

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const targetRegionId = searchParams.get("targetRegionId");

  const children = await db.query.zones.findMany({ where: and(eq(zones.regionId, id), isNull(zones.deletedAt)) });

  if (children.length > 0 && mode !== "cascade" && mode !== "move") {
    return errorResponse("regionHasZones", 409, { zoneCount: children.length }, { count: children.length });
  }

  if (children.length > 0 && mode === "move") {
    if (!targetRegionId) return errorResponse("targetRegionRequired", 400);
    const target = await db.query.zoneRegions.findFirst({ where: eq(zoneRegions.id, targetRegionId) });
    if (!target || target.mapId !== region.mapId) {
      return errorResponse("targetRegionNotOnMap", 400);
    }
    if (target.locked) return errorResponse("targetRegionLocked", 409);
    await db.update(zones).set({ regionId: targetRegionId, updatedAt: new Date() }).where(eq(zones.regionId, id));
  }

  if (children.length > 0 && mode === "cascade") {
    await db.update(zones).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(zones.regionId, id));
  }

  await db.update(zoneRegions).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(zoneRegions.id, id));
  return NextResponse.json({ ok: true });
}
