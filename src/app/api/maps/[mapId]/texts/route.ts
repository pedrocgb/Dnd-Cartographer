import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapTexts, maps } from "@/server/db/schema";
import { isLayerOfMap } from "@/server/layers/layers";
import { withLayerIds } from "@/server/layers/layer-ids";
import { defaultTextStyle, sanitizeTextPatch } from "@/server/texts/text-config";

export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const texts = await db
    .select()
    .from(mapTexts)
    .where(and(eq(mapTexts.mapId, mapId), isNull(mapTexts.deletedAt)));
  return NextResponse.json({ texts: texts.map(withLayerIds) });
}

export async function POST(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });
  if (!map.frameWidth || !map.frameHeight) {
    return NextResponse.json({ error: "Upload a map image first." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  if (!(await isLayerOfMap(body.layerId, mapId))) {
    return NextResponse.json({ error: "A layer of this map is required." }, { status: 400 });
  }

  const frame = { width: map.frameWidth, height: map.frameHeight };
  const fields = { ...defaultTextStyle(frame.width, frame.height), ...sanitizeTextPatch(body, frame) };
  if (!fields.text?.trim()) return NextResponse.json({ error: "Text can't be empty." }, { status: 400 });
  if (fields.x === undefined || fields.y === undefined) {
    return NextResponse.json({ error: "A position (x, y) is required." }, { status: 400 });
  }

  const [created] = await db
    .insert(mapTexts)
    .values({ ...fields, text: fields.text, x: fields.x, y: fields.y, mapId, layerId: body.layerId })
    .returning();
  return NextResponse.json({ text: withLayerIds(created) }, { status: 201 });
}
