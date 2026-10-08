import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { articleFolders } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { cleanFolderName } from "@/server/maps/folders";
import { findArticleFolder, listArticleFolderItems } from "@/server/articles/folders";
import { errorResponse } from "@/i18n/server";

/** Every folder and every membership (`{ folderId, articleId }`). */
export async function GET() {
  const worldId = await requireWorldId();
  const [folders, items] = await Promise.all([db.select().from(articleFolders).where(eq(articleFolders.worldId, worldId)), listArticleFolderItems(worldId)]);
  return NextResponse.json({ folders, items });
}

/** Creates a folder at the root, or inside `parentId`. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = cleanFolderName(body?.name);
  if (!name) return errorResponse("folderNameRequired", 400);

  const worldId = await requireWorldId();
  const parentId = typeof body?.parentId === "string" && body.parentId ? body.parentId : null;
  if (parentId && !(await findArticleFolder(worldId, parentId))) return errorResponse("parentFolderUnknown", 400);

  const [folder] = await db.insert(articleFolders).values({ worldId, name, parentId }).returning();
  return NextResponse.json({ folder }, { status: 201 });
}
