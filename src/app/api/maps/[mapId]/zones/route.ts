import { NextResponse } from "next/server";
import { and, eq, isNull, asc } from "drizzle-orm";
import { db } from "@/server/db/client";
import { zones, zoneRegions, maps } from "@/server/db/schema";
import {
  isValidZoneShape,
  validateRectGeometry,
  validateCircleGeometry,
  validatePolygonGeometry,
  randomZoneColor,
  DEFAULT_FILL_OPACITY,
  DEFAULT_STROKE_OPACITY,
  DEFAULT_STROKE_WIDTH,
} from "@/server/zones/zone-config";

export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const rows = await db.query.zones.findMany({
    where: and(eq(zones.mapId, mapId), isNull(zones.deletedAt)),
    orderBy: [asc(zones.sortOrder)],
  });
  return NextResponse.json({ zones: rows });
}

export async function POST(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const regionId = typeof body.regionId === "string" ? body.regionId : "";
  const region = await db.query.zoneRegions.findFirst({ where: eq(zoneRegions.id, regionId) });
  if (!region || region.mapId !== mapId || region.deletedAt) {
    return NextResponse.json({ error: "Zone Region not found on this map." }, { status: 400 });
  }
  if (region.locked) return NextResponse.json({ error: "Cannot draw into a locked Region." }, { status: 409 });
  if (!region.visible) return NextResponse.json({ error: "Cannot draw into a hidden Region." }, { status: 409 });

  const shapeType = typeof body.shapeType === "string" ? body.shapeType : "";
  if (!isValidZoneShape(shapeType)) return NextResponse.json({ error: "Invalid shape type." }, { status: 400 });

  const imageWidth = Number(body.imageWidth);
  const imageHeight = Number(body.imageHeight);
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
    return NextResponse.json({ error: "Valid image dimensions are required." }, { status: 400 });
  }

  const geometry =
    shapeType === "rectangle"
      ? validateRectGeometry(body.geometry, imageWidth, imageHeight)
      : shapeType === "circle"
        ? validateCircleGeometry(body.geometry, imageWidth, imageHeight)
        : validatePolygonGeometry(body.geometry, imageWidth, imageHeight);
  if (!geometry) return NextResponse.json({ error: "Invalid or out-of-bounds shape geometry." }, { status: 400 });

  const siblings = await db.query.zones.findMany({ where: and(eq(zones.regionId, regionId), isNull(zones.deletedAt)) });
  let name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "";
  if (!name) {
    let n = siblings.length + 1;
    const taken = new Set(siblings.map((z) => z.name));
    while (taken.has(`Zone ${n}`)) n++;
    name = `Zone ${n}`;
  }
  const sortOrder = siblings.length > 0 ? Math.min(...siblings.map((z) => z.sortOrder)) - 1 : 0;
  const fillColor = randomZoneColor();

  const [zone] = await db
    .insert(zones)
    .values({
      regionId,
      mapId,
      name,
      shapeType,
      geometry: JSON.stringify(geometry),
      fillColor,
      fillOpacity: DEFAULT_FILL_OPACITY,
      strokeColor: fillColor,
      strokeOpacity: DEFAULT_STROKE_OPACITY,
      strokeWidth: DEFAULT_STROKE_WIDTH,
      sortOrder,
    })
    .returning();
  return NextResponse.json({ zone }, { status: 201 });
}
