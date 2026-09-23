import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapLayers, maps } from "@/server/db/schema";
import { listLayerRows, listLayers } from "@/server/layers/layers";

export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });
  return NextResponse.json({ layers: await listLayers(mapId) });
}

/** New layers are added at the top of the list (drawn on top). */
export async function POST(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const existing = await listLayerRows(mapId);
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : `Layer ${existing.length + 1}`;
  const minOrder = existing.reduce((m, l) => Math.min(m, l.sortOrder), 0);

  await db.insert(mapLayers).values({ mapId, name, sortOrder: minOrder - 1 });
  return NextResponse.json({ layers: await listLayers(mapId) }, { status: 201 });
}
