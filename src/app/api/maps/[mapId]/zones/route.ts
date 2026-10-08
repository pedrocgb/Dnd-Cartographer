import { NextResponse } from "next/server";
import { and, eq, isNull, asc } from "drizzle-orm";
import { db } from "@/server/db/client";
import { zones, zoneRegions, maps } from "@/server/db/schema";
import {
  isValidZoneShape,
  validateZoneGeometry,
  randomZoneColor,
  clampOpacity,
  clampStrokeWidth,
  normalizeColor,
  DEFAULT_FILL_OPACITY,
  DEFAULT_STROKE_OPACITY,
  DEFAULT_STROKE_WIDTH,
} from "@/server/zones/zone-config";
import { withLayerIds } from "@/server/layers/layer-ids";
import { notInWorld } from "@/server/world/guards";
import { requireWorldId } from "@/server/world/active-world";
import { foreignIdResponse, idsInWorld } from "@/server/world/guards";
import { errorResponse, serverT } from "@/i18n/server";

export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "mapNotFound");
  if (denied) return denied;
  const rows = await db.query.zones.findMany({
    where: and(eq(zones.mapId, mapId), isNull(zones.deletedAt)),
    orderBy: [asc(zones.sortOrder)],
  });
  return NextResponse.json({ zones: rows.map(withLayerIds) });
}

export async function POST(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "mapNotFound");
  if (denied) return denied;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) return errorResponse("mapNotFound", 404);

  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("invalidBody", 400);

  const regionId = typeof body.regionId === "string" ? body.regionId : "";
  const region = await db.query.zoneRegions.findFirst({ where: eq(zoneRegions.id, regionId) });
  if (!region || region.mapId !== mapId || region.deletedAt) {
    return errorResponse("zoneRegionNotOnMap", 400);
  }
  if (region.locked) return errorResponse("regionLocked", 409);
  if (!region.visible) return errorResponse("regionHidden", 409);

  const shapeType = typeof body.shapeType === "string" ? body.shapeType : "";
  if (!isValidZoneShape(shapeType)) return errorResponse("shapeTypeInvalid", 400);

  const imageWidth = Number(body.imageWidth);
  const imageHeight = Number(body.imageHeight);
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
    return errorResponse("imageDimensionsRequired", 400);
  }

  const geometry = validateZoneGeometry(shapeType, body.geometry, imageWidth, imageHeight);
  if (!geometry) return errorResponse("shapeGeometryInvalid", 400);

  const siblings = await db.query.zones.findMany({ where: and(eq(zones.regionId, regionId), isNull(zones.deletedAt)) });
  let name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "";
  if (!name) {
    const t = await serverT("maps");
    let n = siblings.length + 1;
    const taken = new Set(siblings.map((z) => z.name));
    while (taken.has(t("defaults.zone", { n }))) n++;
    name = t("defaults.zone", { n });
  }
  const sortOrder = siblings.length > 0 ? Math.min(...siblings.map((z) => z.sortOrder)) - 1 : 0;
  // Style is optional (a pasted zone keeps its source's); a new drawing gets a random color.
  const num = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  const fillColor = typeof body.fillColor === "string" ? normalizeColor(body.fillColor, randomZoneColor()) : randomZoneColor();
  const strokeColor = typeof body.strokeColor === "string" ? normalizeColor(body.strokeColor, fillColor) : fillColor;

  if (!(await idsInWorld(await requireWorldId(), [["territories", typeof body.territoryId === "string" ? body.territoryId : null]]))) return foreignIdResponse();
  const [zone] = await db
    .insert(zones)
    .values({
      regionId,
      mapId,
      name,
      shapeType,
      geometry: JSON.stringify(geometry),
      fillColor,
      fillOpacity: num(body.fillOpacity) ? clampOpacity(body.fillOpacity) : DEFAULT_FILL_OPACITY,
      strokeColor,
      strokeOpacity: num(body.strokeOpacity) ? clampOpacity(body.strokeOpacity) : DEFAULT_STROKE_OPACITY,
      strokeWidth: num(body.strokeWidth) ? clampStrokeWidth(body.strokeWidth) : DEFAULT_STROKE_WIDTH,
      territoryId: typeof body.territoryId === "string" ? body.territoryId : null,
      visible: typeof body.visible === "boolean" ? body.visible : true,
      locked: typeof body.locked === "boolean" ? body.locked : false,
      sortOrder,
    })
    .returning();
  return NextResponse.json({ zone: withLayerIds(zone) }, { status: 201 });
}
