import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapFolders } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { cleanFolderName } from "@/server/maps/folders";

export async function GET() {
  const worldId = await requireWorldId();
  const folders = await db.select().from(mapFolders).where(eq(mapFolders.worldId, worldId));
  return NextResponse.json({ folders });
}

/** Creates a folder at the root, or inside `parentId`. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = cleanFolderName(body?.name);
  if (!name) return NextResponse.json({ error: "A folder name is required." }, { status: 400 });

  const worldId = await requireWorldId();
  const parentId = typeof body?.parentId === "string" && body.parentId ? body.parentId : null;
  if (parentId) {
    const [parent] = await db.select({ id: mapFolders.id }).from(mapFolders).where(and(eq(mapFolders.id, parentId), eq(mapFolders.worldId, worldId)));
    if (!parent) return NextResponse.json({ error: "Unknown parent folder." }, { status: 400 });
  }

  const [folder] = await db.insert(mapFolders).values({ worldId, name, parentId }).returning();
  return NextResponse.json({ folder }, { status: 201 });
}
