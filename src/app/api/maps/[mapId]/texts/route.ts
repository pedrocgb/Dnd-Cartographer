import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapTexts, maps } from "@/server/db/schema";
import { isLayerOfMap } from "@/server/layers/layers";
import { withLayerIds } from "@/server/layers/layer-ids";
import { folderError, topSortOrder } from "@/server/maps/layer-folders";
import { defaultTextStyle, sanitizeTextPatch } from "@/server/texts/text-config";
import { notInWorld } from "@/server/world/guards";
import { errorResponse } from "@/i18n/server";

export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "mapNotFound");
  if (denied) return denied;
  const texts = await db
    .select()
    .from(mapTexts)
    .where(and(eq(mapTexts.mapId, mapId), isNull(mapTexts.deletedAt)));
  return NextResponse.json({ texts: texts.map(withLayerIds) });
}

export async function POST(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "mapNotFound");
  if (denied) return denied;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) return errorResponse("mapNotFound", 404);
  if (!map.frameWidth || !map.frameHeight) {
    return errorResponse("needMapImage", 409);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("invalidBody", 400);
  if (!(await isLayerOfMap(body.layerId, mapId))) {
    return errorResponse("layerOfMapRequired", 400);
  }

  const frame = { width: map.frameWidth, height: map.frameHeight };
  const fields = { ...defaultTextStyle(frame.width, frame.height), ...sanitizeTextPatch(body, frame) };
  if (!fields.text?.trim()) return errorResponse("textEmpty", 400);
  if (fields.x === undefined || fields.y === undefined) {
    return errorResponse("textPositionRequired", 400);
  }

  const groupId: string | null = typeof body.groupId === "string" ? body.groupId : null;
  const groupError = await folderError("text", groupId, mapId, body.layerId);
  if (groupError) return errorResponse(groupError, 409);
  const sortOrder = await topSortOrder("text", mapId, groupId);

  const [created] = await db
    .insert(mapTexts)
    .values({ ...fields, text: fields.text, x: fields.x, y: fields.y, mapId, layerId: body.layerId, groupId, sortOrder })
    .returning();
  return NextResponse.json({ text: withLayerIds(created) }, { status: 201 });
}
