import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapRoutes, maps } from "@/server/db/schema";
import { isLayerOfMap } from "@/server/layers/layers";
import { folderError, topSortOrder } from "@/server/maps/layer-folders";
import { DEFAULT_ROUTE_STYLE, sanitizeRouteName, sanitizeRoutePoints, sanitizeRouteStyle, toClientRoute } from "@/server/travel/route-config";
import { sanitizeTravelSettings } from "@/server/travel/travel";
import { notInWorld } from "@/server/world/guards";
import { errorResponse } from "@/i18n/server";

export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "mapNotFound");
  if (denied) return denied;
  const rows = await db
    .select()
    .from(mapRoutes)
    .where(and(eq(mapRoutes.mapId, mapId), isNull(mapRoutes.deletedAt)));
  return NextResponse.json({ routes: rows.map(toClientRoute) });
}

/** Body: `layerId`, `points` (frame px), optional `groupId`, `name`, style fields and `settings`. */
export async function POST(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "mapNotFound");
  if (denied) return denied;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) return errorResponse("mapNotFound", 404);
  if (!map.frameWidth || !map.frameHeight) return errorResponse("needMapImage", 409);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("invalidBody", 400);
  if (!(await isLayerOfMap(body.layerId, mapId))) return errorResponse("layerOfMapRequired", 400);
  const points = sanitizeRoutePoints(body.points, { width: map.frameWidth, height: map.frameHeight });
  if (!points) return errorResponse("routePointsRequired", 400);

  const groupId: string | null = typeof body.groupId === "string" ? body.groupId : null;
  const groupError = await folderError("route", groupId, mapId, body.layerId);
  if (groupError) return errorResponse(groupError, 409);

  const sortOrder = await topSortOrder("route", mapId, groupId);
  const [created] = await db
    .insert(mapRoutes)
    .values({
      ...DEFAULT_ROUTE_STYLE,
      ...sanitizeRouteStyle(body),
      mapId,
      layerId: body.layerId,
      groupId,
      name: sanitizeRouteName(body.name) ?? "",
      sortOrder,
      points: JSON.stringify(points),
      settings: JSON.stringify(sanitizeTravelSettings(body.settings)),
    })
    .returning();
  return NextResponse.json({ route: toClientRoute(created) }, { status: 201 });
}
