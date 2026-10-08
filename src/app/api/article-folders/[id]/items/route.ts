import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { articleFolderItems } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { addToFolder, findArticleFolder, liveArticleIds, parseArticleIds } from "@/server/articles/folders";
import { errorResponse } from "@/i18n/server";

type RouteContext = { params: Promise<{ id: string }> };

/** Body: `{ articleIds }`. Files those articles in the folder (unknown or trashed ones are skipped). */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  if (!(await findArticleFolder(worldId, id))) return errorResponse("folderNotFound", 404);
  const body = await request.json().catch(() => null);
  const articleIds = parseArticleIds(body?.articleIds);
  if (!articleIds) return errorResponse("articleIdsInvalid", 400);

  const live = await liveArticleIds(worldId, articleIds);
  const added = articleIds.filter((a) => live.has(a));
  await addToFolder(id, added);
  return NextResponse.json({ added });
}

/** Body: `{ articleIds }`. Takes them out of this folder only; the articles stay as they are. */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!(await findArticleFolder(await requireWorldId(), id))) return errorResponse("folderNotFound", 404);
  const body = await request.json().catch(() => null);
  const articleIds = parseArticleIds(body?.articleIds);
  if (!articleIds) return errorResponse("articleIdsInvalid", 400);
  await db.delete(articleFolderItems).where(and(eq(articleFolderItems.folderId, id), inArray(articleFolderItems.articleId, articleIds)));
  return NextResponse.json({ ok: true });
}
