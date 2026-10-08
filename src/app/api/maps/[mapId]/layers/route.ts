import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapLayers, maps } from "@/server/db/schema";
import { listLayerRows, listLayers } from "@/server/layers/layers";
import { notInWorld } from "@/server/world/guards";
import { errorResponse, serverT } from "@/i18n/server";

export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "mapNotFound");
  if (denied) return denied;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) return errorResponse("mapNotFound", 404);
  return NextResponse.json({ layers: await listLayers(mapId) });
}

/** New layers are added at the top of the list (drawn on top). */
export async function POST(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "mapNotFound");
  if (denied) return denied;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) return errorResponse("mapNotFound", 404);

  const body = await request.json().catch(() => ({}));
  const existing = await listLayerRows(mapId);
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : (await serverT("maps"))("defaults.layer", { n: existing.length + 1 });
  const minOrder = existing.reduce((m, l) => Math.min(m, l.sortOrder), 0);

  await db.insert(mapLayers).values({ mapId, name, sortOrder: minOrder - 1 });
  return NextResponse.json({ layers: await listLayers(mapId) }, { status: 201 });
}
