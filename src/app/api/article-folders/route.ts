import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { articleFolders } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { cleanFolderName } from "@/server/maps/folders";
import { findArticleFolder, listArticleFolderItems } from "@/server/articles/folders";

/** Every folder and every membership (`{ folderId, articleId }`). */
export async function GET() {
  const worldId = await ensureDefaultWorld();
  const [folders, items] = await Promise.all([db.select().from(articleFolders).where(eq(articleFolders.worldId, worldId)), listArticleFolderItems(worldId)]);
  return NextResponse.json({ folders, items });
}

/** Creates a folder at the root, or inside `parentId`. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = cleanFolderName(body?.name);
  if (!name) return NextResponse.json({ error: "A folder name is required." }, { status: 400 });

  const worldId = await ensureDefaultWorld();
  const parentId = typeof body?.parentId === "string" && body.parentId ? body.parentId : null;
  if (parentId && !(await findArticleFolder(worldId, parentId))) return NextResponse.json({ error: "Unknown parent folder." }, { status: 400 });

  const [folder] = await db.insert(articleFolders).values({ worldId, name, parentId }).returning();
  return NextResponse.json({ folder }, { status: 201 });
}
