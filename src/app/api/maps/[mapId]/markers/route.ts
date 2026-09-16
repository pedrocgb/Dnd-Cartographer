import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { markers, maps } from "@/server/db/schema";
import {
  isValidIconKey,
  normalizeColor,
  isValidBackgroundShape,
  DEFAULT_ICON_KEY,
  DEFAULT_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_OUTLINE_COLOR,
  DEFAULT_BACKGROUND_SHAPE,
} from "@/server/markers/icon-registry";

export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const rows = await db
    .select()
    .from(markers)
    .where(and(eq(markers.mapId, mapId), isNull(markers.deletedAt)));
  return NextResponse.json({ markers: rows });
}

export async function POST(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) {
    return NextResponse.json({ error: "Map not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const u = Number(body?.u);
  const v = Number(body?.v);

  if (!name) {
    return NextResponse.json({ error: "A marker name is required." }, { status: 400 });
  }
  if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) {
    return NextResponse.json({ error: "Marker position must be normalized u/v in [0, 1]." }, { status: 400 });
  }

  const iconKey = typeof body?.iconKey === "string" && isValidIconKey(body.iconKey) ? body.iconKey : DEFAULT_ICON_KEY;
  const color = typeof body?.color === "string" ? normalizeColor(body.color, DEFAULT_COLOR) : DEFAULT_COLOR;
  const backgroundColor =
    typeof body?.backgroundColor === "string"
      ? normalizeColor(body.backgroundColor, DEFAULT_BACKGROUND_COLOR)
      : DEFAULT_BACKGROUND_COLOR;
  const outlineColor =
    typeof body?.outlineColor === "string"
      ? normalizeColor(body.outlineColor, DEFAULT_OUTLINE_COLOR)
      : DEFAULT_OUTLINE_COLOR;
  const backgroundShape =
    typeof body?.backgroundShape === "string" && isValidBackgroundShape(body.backgroundShape)
      ? body.backgroundShape
      : DEFAULT_BACKGROUND_SHAPE;
  const linkedMapId = typeof body?.linkedMapId === "string" ? body.linkedMapId : null;

  if (linkedMapId) {
    const linked = await db.query.maps.findFirst({ where: eq(maps.id, linkedMapId) });
    if (!linked || linked.worldId !== map.worldId) {
      return NextResponse.json({ error: "Linked map must exist in the same world." }, { status: 400 });
    }
  }

  const [marker] = await db
    .insert(markers)
    .values({ mapId, name, u, v, iconKey, color, backgroundColor, outlineColor, backgroundShape, linkedMapId })
    .returning();
  return NextResponse.json({ marker }, { status: 201 });
}
