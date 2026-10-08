import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { articleFolderItems, articleFolders } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { cleanFolderColor, cleanFolderName, folderMoveError, folderSubtree } from "@/server/maps/folders";
import { errorResponse } from "@/i18n/server";
import { worldArticleFolders } from "@/server/articles/folders";

type RouteContext = { params: Promise<{ id: string }> };

/** Renames (`name`), recolors (`color`, null for the default) and/or moves (`parentId`, null for the root) a folder. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const folders = await worldArticleFolders(await requireWorldId());
  if (!folders.some((f) => f.id === id)) return errorResponse("folderNotFound", 404);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("invalidBody", 400);

  const patch: Partial<typeof articleFolders.$inferInsert> = { updatedAt: new Date() };
  if ("name" in body) {
    const name = cleanFolderName(body.name);
    if (!name) return errorResponse("folderNameRequired", 400);
    patch.name = name;
  }
  if ("color" in body) {
    const color = cleanFolderColor(body.color);
    if (color === undefined) return errorResponse("colorInvalid", 400);
    patch.color = color;
  }
  if ("parentId" in body) {
    const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;
    const error = folderMoveError(folders, id, parentId);
    if (error) return errorResponse(error, 400);
    patch.parentId = parentId;
  }

  const [folder] = await db.update(articleFolders).set(patch).where(eq(articleFolders.id, id)).returning();
  return NextResponse.json({ folder });
}

/** Deletes the folder, its subfolders and what was filed in them. Never deletes an article. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const folders = await worldArticleFolders(await requireWorldId());
  if (!folders.some((f) => f.id === id)) return errorResponse("folderNotFound", 404);

  const ids = [...folderSubtree(folders, id)];
  await db.transaction(async (tx) => {
    await tx.delete(articleFolderItems).where(inArray(articleFolderItems.folderId, ids));
    await tx.delete(articleFolders).where(inArray(articleFolders.id, ids));
  });
  return NextResponse.json({ ok: true, deletedFolderIds: ids });
}
