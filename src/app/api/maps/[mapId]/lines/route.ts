import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapLines, maps } from "@/server/db/schema";
import { isLayerOfMap } from "@/server/layers/layers";
import { LINE_KINDS, defaultLineStyle, sanitizeLinePatch, sanitizePoints, toClientLine, type LineKind } from "@/server/lines/line-config";

export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const rows = await db
    .select()
    .from(mapLines)
    .where(and(eq(mapLines.mapId, mapId), isNull(mapLines.deletedAt)));
  return NextResponse.json({ lines: rows.map(toClientLine) });
}

export async function POST(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });
  if (!map.frameWidth || !map.frameHeight) return NextResponse.json({ error: "Upload a map image first." }, { status: 409 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  if (!(await isLayerOfMap(body.layerId, mapId))) {
    return NextResponse.json({ error: "A layer of this map is required." }, { status: 400 });
  }
  if (!(LINE_KINDS as readonly string[]).includes(body.kind)) {
    return NextResponse.json({ error: "kind must be 'free' or 'pen'." }, { status: 400 });
  }
  const kind = body.kind as LineKind;
  const frame = { width: map.frameWidth, height: map.frameHeight };
  const points = sanitizePoints(kind, body.points, frame);
  if (!points) return NextResponse.json({ error: "A line needs 2 or more valid points." }, { status: 400 });

  const style = { ...defaultLineStyle(frame.width, frame.height), ...sanitizeLinePatch(body, frame) };
  const [created] = await db
    .insert(mapLines)
    .values({ ...style, mapId, layerId: body.layerId, kind, points: JSON.stringify(points) })
    .returning();
  return NextResponse.json({ line: toClientLine(created) }, { status: 201 });
}
