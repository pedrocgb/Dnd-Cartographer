import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { maps } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { listMapSummaries } from "@/server/maps/tree";
import { createDefaultLayer } from "@/server/layers/layers";
import type { MapNode } from "@/server/maps/hierarchy";

export async function GET(request: Request) {
  const worldId = await ensureDefaultWorld();
  const includeDeleted = new URL(request.url).searchParams.get("trash") === "true";
  const summaries = await listMapSummaries(worldId, { includeDeleted });
  return NextResponse.json({ maps: summaries });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : null;
  const parentId = typeof body?.parentId === "string" ? body.parentId : null;

  if (!name) {
    return NextResponse.json({ error: "A map name is required." }, { status: 400 });
  }

  const worldId = await ensureDefaultWorld();

  if (parentId) {
    const existing = await db.select({ id: maps.id, worldId: maps.worldId, parentId: maps.parentId }).from(maps);
    const nodes: MapNode[] = existing;
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) {
      return NextResponse.json({ error: "Unknown parent map." }, { status: 400 });
    }
    if (parent.worldId !== worldId) {
      return NextResponse.json({ error: "Maps must share the same world to be linked." }, { status: 400 });
    }
  }

  const [map] = await db.insert(maps).values({ worldId, name, categoryId, parentId }).returning();
  await createDefaultLayer(map.id);
  return NextResponse.json({ map }, { status: 201 });
}
