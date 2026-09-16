import { NextResponse } from "next/server";
import { and, eq, isNull, like } from "drizzle-orm";
import { db } from "@/server/db/client";
import { maps, markers } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";

export interface SearchResult {
  type: "map" | "marker";
  id: string;
  name: string;
  mapId: string;
  mapName: string;
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const worldId = await ensureDefaultWorld();
  const pattern = `%${q}%`;

  const mapRows = await db
    .select({ id: maps.id, name: maps.name })
    .from(maps)
    .where(and(eq(maps.worldId, worldId), isNull(maps.deletedAt), like(maps.name, pattern)));

  const markerRows = await db
    .select({
      id: markers.id,
      name: markers.name,
      mapId: markers.mapId,
      mapName: maps.name,
    })
    .from(markers)
    .innerJoin(maps, eq(markers.mapId, maps.id))
    .where(
      and(eq(maps.worldId, worldId), isNull(markers.deletedAt), isNull(maps.deletedAt), like(markers.name, pattern))
    );

  const results: SearchResult[] = [
    ...mapRows.map((m) => ({ type: "map" as const, id: m.id, name: m.name, mapId: m.id, mapName: m.name })),
    ...markerRows.map((m) => ({ type: "marker" as const, id: m.id, name: m.name, mapId: m.mapId, mapName: m.mapName })),
  ];

  return NextResponse.json({ results });
}
