import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapLines } from "@/server/db/schema";
import { folderError } from "@/server/maps/layer-folders";
import { toClientLine } from "@/server/lines/line-config";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.query.mapLines.findFirst({ where: eq(mapLines.id, id) });
  if (!row) return NextResponse.json({ error: "Line not found." }, { status: 404 });
  // Its folder may be gone (or moved layers) since: it comes back Ungrouped then.
  const keepGroup = row.groupId !== null && (await folderError("line", row.groupId, row.mapId, row.layerId, false)) === null;
  const [restored] = await db
    .update(mapLines)
    .set({ deletedAt: null, updatedAt: new Date(), ...(keepGroup ? {} : { groupId: null }) })
    .where(eq(mapLines.id, id))
    .returning();
  return NextResponse.json({ line: toClientLine(restored) });
}
