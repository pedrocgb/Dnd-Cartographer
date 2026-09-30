import { NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { maps } from "@/server/db/schema";
import { isLayerOfMap } from "@/server/layers/layers";
import { folderPatch, folderTable, itemTable, sanitizeFolderName, toClientFolder, type GroupedKind } from "./layer-folders";

/**
 * Route handlers for line, text and route folders (zone regions keep their
 * own routes). The folder tables and their item tables have the same
 * columns, so one implementation serves them all.
 */

type Kind = GroupedKind;

type MapContext = { params: Promise<{ mapId: string }> };
type FolderContext = { params: Promise<{ id: string }> };

export function folderCollectionRoutes(kind: Kind) {
  const table = folderTable(kind);
  return {
    async GET(_request: Request, { params }: MapContext) {
      const { mapId } = await params;
      const rows = await db
        .select()
        .from(table)
        .where(and(eq(table.mapId, mapId), isNull(table.deletedAt)))
        .orderBy(asc(table.sortOrder));
      return NextResponse.json({ groups: rows.map(toClientFolder) });
    },

    async POST(request: Request, { params }: MapContext) {
      const { mapId } = await params;
      const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
      if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });
      const body = await request.json().catch(() => null);
      const name = sanitizeFolderName(body?.name);
      if (!name) return NextResponse.json({ error: "A folder name is required." }, { status: 400 });
      if (!(await isLayerOfMap(body?.layerId, mapId))) return NextResponse.json({ error: "A layer of this map is required." }, { status: 400 });
      const layerId: string = body.layerId;
      const existing = await db
        .select({ sortOrder: table.sortOrder })
        .from(table)
        .where(and(eq(table.layerId, layerId), isNull(table.deletedAt)));
      // New folders land at the top, like zone regions.
      const sortOrder = existing.length > 0 ? Math.min(...existing.map((g) => g.sortOrder)) - 1 : 0;
      const [group] = await db.insert(table).values({ mapId, layerId, name, sortOrder }).returning();
      return NextResponse.json({ group: toClientFolder(group) }, { status: 201 });
    },
  };
}

export function folderItemRoutes(kind: Kind) {
  const table = folderTable(kind);
  const items = itemTable(kind);
  const live = async (id: string) => (await db.select().from(table).where(and(eq(table.id, id), isNull(table.deletedAt))))[0];
  return {
    async PATCH(request: Request, { params }: FolderContext) {
      const { id } = await params;
      const folder = await live(id);
      if (!folder) return NextResponse.json({ error: "Folder not found." }, { status: 404 });
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
      const result = await folderPatch(kind, body, folder);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
      const [group] = await db.update(table).set(result.patch).where(eq(table.id, id)).returning();
      return NextResponse.json({ group: toClientFolder(group) });
    },

    /** Its items move to Ungrouped, or with `?mode=cascade` are deleted with it (soft). */
    async DELETE(request: Request, { params }: FolderContext) {
      const { id } = await params;
      if (!(await live(id))) return NextResponse.json({ error: "Folder not found." }, { status: 404 });
      const cascade = new URL(request.url).searchParams.get("mode") === "cascade";
      const now = new Date();
      await db.transaction(async (tx) => {
        const inFolder = and(eq(items.groupId, id), isNull(items.deletedAt));
        if (cascade) await tx.update(items).set({ deletedAt: now, updatedAt: now }).where(inFolder);
        else await tx.update(items).set({ groupId: null, updatedAt: now }).where(inFolder);
        await tx.update(table).set({ deletedAt: now, updatedAt: now }).where(eq(table.id, id));
      });
      return NextResponse.json({ ok: true });
    },
  };
}
