import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { articleFolderItems } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { findArticleFolder } from "@/server/articles/folders";

/** Body: `{ articleId, from, to }`. Moves an article from one folder to another (a drag between folders). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { articleId, from, to } = (body ?? {}) as Record<string, unknown>;
  if (typeof articleId !== "string" || typeof from !== "string" || typeof to !== "string" || !articleId || from === to) {
    return NextResponse.json({ error: "Invalid move." }, { status: 400 });
  }
  const worldId = await requireWorldId();
  const [source, target] = await Promise.all([findArticleFolder(worldId, from), findArticleFolder(worldId, to)]);
  if (!source || !target) return NextResponse.json({ error: "Folder not found." }, { status: 404 });

  const moved = await db.transaction(async (tx) => {
    const removed = await tx
      .delete(articleFolderItems)
      .where(and(eq(articleFolderItems.folderId, from), eq(articleFolderItems.articleId, articleId)))
      .returning({ articleId: articleFolderItems.articleId });
    if (removed.length === 0) return false;
    await tx.insert(articleFolderItems).values({ folderId: to, articleId }).onConflictDoNothing();
    return true;
  });
  if (!moved) return NextResponse.json({ error: "That article is not in the folder it was dragged from." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
