import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapFolders, maps } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { cleanFolderColor, cleanFolderName, folderMoveError, folderSubtree } from "@/server/maps/folders";

type RouteContext = { params: Promise<{ id: string }> };

async function worldFolders() {
  const worldId = await requireWorldId();
  return db.select({ id: mapFolders.id, parentId: mapFolders.parentId }).from(mapFolders).where(eq(mapFolders.worldId, worldId));
}

/** Renames (`name`), recolors (`color`, null for the default) and/or moves (`parentId`, null for the root) a folder. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const folders = await worldFolders();
  if (!folders.some((f) => f.id === id)) return NextResponse.json({ error: "Folder not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const patch: Partial<typeof mapFolders.$inferInsert> = { updatedAt: new Date() };
  if ("name" in body) {
    const name = cleanFolderName(body.name);
    if (!name) return NextResponse.json({ error: "A folder name is required." }, { status: 400 });
    patch.name = name;
  }
  if ("color" in body) {
    const color = cleanFolderColor(body.color);
    if (color === undefined) return NextResponse.json({ error: "A color must look like #RRGGBB." }, { status: 400 });
    patch.color = color;
  }
  if ("parentId" in body) {
    const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;
    const error = folderMoveError(folders, id, parentId);
    if (error) return NextResponse.json({ error }, { status: 400 });
    patch.parentId = parentId;
  }

  const [folder] = await db.update(mapFolders).set(patch).where(eq(mapFolders.id, id)).returning();
  return NextResponse.json({ folder });
}

/** Deletes the folder and its subfolders; every map inside any of them goes back to the root. Never deletes a map. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const folders = await worldFolders();
  if (!folders.some((f) => f.id === id)) return NextResponse.json({ error: "Folder not found." }, { status: 404 });

  const ids = [...folderSubtree(folders, id)];
  const now = new Date();
  await db.update(maps).set({ folderId: null, updatedAt: now }).where(inArray(maps.folderId, ids));
  await db.delete(mapFolders).where(inArray(mapFolders.id, ids));
  return NextResponse.json({ ok: true, deletedFolderIds: ids });
}
