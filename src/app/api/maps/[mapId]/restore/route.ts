import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { maps } from "@/server/db/schema";

export async function POST(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) {
    return NextResponse.json({ error: "Map not found." }, { status: 404 });
  }

  // If the parent is gone or still deleted, restore this map as a root
  // rather than leaving it hanging off a parent that no longer exists.
  let parentId = map.parentId;
  if (parentId) {
    const parent = await db.query.maps.findFirst({ where: eq(maps.id, parentId) });
    if (!parent || parent.deletedAt) {
      parentId = null;
    }
  }

  const [restored] = await db
    .update(maps)
    .set({ deletedAt: null, parentId, updatedAt: new Date() })
    .where(eq(maps.id, mapId))
    .returning();

  return NextResponse.json({ map: restored });
}
