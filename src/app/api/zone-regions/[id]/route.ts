import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { zoneRegions, zones } from "@/server/db/schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const region = await db.query.zoneRegions.findFirst({ where: eq(zoneRegions.id, id) });
  if (!region) return NextResponse.json({ error: "Zone Region not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const patch: Partial<typeof zoneRegions.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.visible === "boolean") patch.visible = body.visible;
  if (typeof body.locked === "boolean") patch.locked = body.locked;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;

  const [updated] = await db.update(zoneRegions).set(patch).where(eq(zoneRegions.id, id)).returning();
  return NextResponse.json({ region: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const region = await db.query.zoneRegions.findFirst({ where: eq(zoneRegions.id, id) });
  if (!region) return NextResponse.json({ error: "Zone Region not found." }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const targetRegionId = searchParams.get("targetRegionId");

  const children = await db.query.zones.findMany({ where: and(eq(zones.regionId, id), isNull(zones.deletedAt)) });

  if (children.length > 0 && mode !== "cascade" && mode !== "move") {
    return NextResponse.json(
      { error: `This Region still contains ${children.length} zone(s).`, zoneCount: children.length },
      { status: 409 }
    );
  }

  if (children.length > 0 && mode === "move") {
    if (!targetRegionId) return NextResponse.json({ error: "A target Region is required to move zones." }, { status: 400 });
    const target = await db.query.zoneRegions.findFirst({ where: eq(zoneRegions.id, targetRegionId) });
    if (!target || target.mapId !== region.mapId) {
      return NextResponse.json({ error: "Target Region not found on this map." }, { status: 400 });
    }
    if (target.locked) return NextResponse.json({ error: "Target Region is locked." }, { status: 409 });
    await db.update(zones).set({ regionId: targetRegionId, updatedAt: new Date() }).where(eq(zones.regionId, id));
  }

  if (children.length > 0 && mode === "cascade") {
    await db.update(zones).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(zones.regionId, id));
  }

  await db.update(zoneRegions).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(zoneRegions.id, id));
  return NextResponse.json({ ok: true });
}
