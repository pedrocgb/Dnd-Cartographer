import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapGrids, maps } from "@/server/db/schema";
import {
  isValidGridShape,
  clampColumns,
  clampRows,
  clampOffset,
  clampOpacity,
  clampLineWidth,
  normalizeColor,
  DEFAULT_GRID,
} from "@/server/grid/grid-config";

export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const grid = await db.query.mapGrids.findFirst({ where: eq(mapGrids.mapId, mapId) });
  return NextResponse.json({ grid: grid ?? null });
}

export async function POST(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) {
    return NextResponse.json({ error: "Map not found." }, { status: 404 });
  }

  const existing = await db.query.mapGrids.findFirst({ where: eq(mapGrids.mapId, mapId) });
  if (existing) {
    return NextResponse.json({ grid: existing });
  }

  const [grid] = await db
    .insert(mapGrids)
    .values({ mapId, ...DEFAULT_GRID })
    .onConflictDoNothing()
    .returning();
  return NextResponse.json({ grid: grid ?? (await db.query.mapGrids.findFirst({ where: eq(mapGrids.mapId, mapId) })) }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const grid = await db.query.mapGrids.findFirst({ where: eq(mapGrids.mapId, mapId) });
  if (!grid) {
    return NextResponse.json({ error: "Grid not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const patch: Partial<typeof mapGrids.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.shape === "string" && isValidGridShape(body.shape)) patch.shape = body.shape;
  if (typeof body.columns === "number") patch.columns = clampColumns(body.columns);
  if (typeof body.rows === "number") patch.rows = clampRows(body.rows);
  if (typeof body.horizontalOffset === "number") patch.horizontalOffset = clampOffset(body.horizontalOffset);
  if (typeof body.verticalOffset === "number") patch.verticalOffset = clampOffset(body.verticalOffset);
  if (typeof body.opacity === "number") patch.opacity = clampOpacity(body.opacity);
  if (typeof body.lineWidth === "number") patch.lineWidth = clampLineWidth(body.lineWidth);
  if (typeof body.color === "string") patch.color = normalizeColor(body.color, DEFAULT_GRID.color);
  if (typeof body.linkedColumnsRows === "boolean") patch.linkedColumnsRows = body.linkedColumnsRows;

  const [updated] = await db.update(mapGrids).set(patch).where(eq(mapGrids.mapId, mapId)).returning();
  return NextResponse.json({ grid: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  await db.delete(mapGrids).where(eq(mapGrids.mapId, mapId));
  return NextResponse.json({ ok: true });
}
