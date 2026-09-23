import { NextResponse } from "next/server";
import { and, eq, isNull, asc } from "drizzle-orm";
import { db } from "@/server/db/client";
import { zoneRegions, maps } from "@/server/db/schema";
import { isLayerOfMap } from "@/server/layers/layers";

export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const regions = await db.query.zoneRegions.findMany({
    where: and(eq(zoneRegions.mapId, mapId), isNull(zoneRegions.deletedAt)),
    orderBy: [asc(zoneRegions.sortOrder)],
  });
  return NextResponse.json({ regions });
}

export async function POST(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "A Region name is required." }, { status: 400 });
  if (!(await isLayerOfMap(body?.layerId, mapId))) {
    return NextResponse.json({ error: "A layer of this map is required." }, { status: 400 });
  }
  const layerId: string = body.layerId;

  const existing = await db.query.zoneRegions.findMany({
    where: and(eq(zoneRegions.layerId, layerId), isNull(zoneRegions.deletedAt)),
  });
  // New Regions land at the top of the list, matching the "insert at top,
  // select it" convention used for newly drawn zones.
  const sortOrder = existing.length > 0 ? Math.min(...existing.map((r) => r.sortOrder)) - 1 : 0;

  const [region] = await db.insert(zoneRegions).values({ mapId, layerId, name, sortOrder }).returning();
  return NextResponse.json({ region }, { status: 201 });
}
