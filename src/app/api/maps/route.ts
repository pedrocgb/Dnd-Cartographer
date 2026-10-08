import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { maps } from "@/server/db/schema";
import { validFolderId } from "@/server/maps/folder-lookup";
import { requireWorldId } from "@/server/world/active-world";
import { listMapSummaries } from "@/server/maps/tree";
import { createDefaultLayer } from "@/server/layers/layers";
import type { MapNode } from "@/server/maps/hierarchy";
import { foreignIdResponse, idsInWorld } from "@/server/world/guards";
import { errorResponse } from "@/i18n/server";

export async function GET(request: Request) {
  const worldId = await requireWorldId();
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
    return errorResponse("mapNameRequired", 400);
  }

  const worldId = await requireWorldId();

  if (parentId) {
    const existing = await db.select({ id: maps.id, worldId: maps.worldId, parentId: maps.parentId }).from(maps);
    const nodes: MapNode[] = existing;
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) {
      return errorResponse("unknownParentMap", 400);
    }
    if (parent.worldId !== worldId) {
      return errorResponse("mapsSameWorld", 400);
    }
  }

  const folderId = await validFolderId(worldId, body?.folderId);
  if (folderId === undefined) return errorResponse("unknownFolder", 400);

  if (!(await idsInWorld(worldId, [["map_categories", categoryId]]))) return foreignIdResponse();
  const [map] = await db.insert(maps).values({ worldId, name, categoryId, parentId, folderId }).returning();
  await createDefaultLayer(map.id);
  return NextResponse.json({ map }, { status: 201 });
}
