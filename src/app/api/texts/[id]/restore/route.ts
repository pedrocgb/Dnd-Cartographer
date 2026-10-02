import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapTexts } from "@/server/db/schema";
import { withLayerIds } from "@/server/layers/layer-ids";
import { folderError } from "@/server/maps/layer-folders";
import { notInWorld } from "@/server/world/guards";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await notInWorld("map_texts", id, "Text not found.");
  if (denied) return denied;
  const row = await db.query.mapTexts.findFirst({ where: eq(mapTexts.id, id) });
  if (!row) return NextResponse.json({ error: "Text not found." }, { status: 404 });
  // Its folder may be gone (or on another layer) since: it comes back Ungrouped then.
  const keepGroup = row.groupId !== null && (await folderError("text", row.groupId, row.mapId, row.layerId, false)) === null;
  const [restored] = await db
    .update(mapTexts)
    .set({ deletedAt: null, updatedAt: new Date(), ...(keepGroup ? {} : { groupId: null }) })
    .where(eq(mapTexts.id, id))
    .returning();
  return NextResponse.json({ text: withLayerIds(restored) });
}
