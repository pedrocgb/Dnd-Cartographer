import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapRoutes } from "@/server/db/schema";
import { folderError } from "@/server/maps/layer-folders";
import { toClientRoute } from "@/server/travel/route-config";
import { notInWorld } from "@/server/world/guards";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await notInWorld("map_routes", id, "Route not found.");
  if (denied) return denied;
  const row = await db.query.mapRoutes.findFirst({ where: eq(mapRoutes.id, id) });
  if (!row) return NextResponse.json({ error: "Route not found." }, { status: 404 });
  // Its folder may be gone (or moved layers) since: it comes back Ungrouped then.
  const keepGroup = row.groupId !== null && (await folderError("route", row.groupId, row.mapId, row.layerId, false)) === null;
  const [restored] = await db
    .update(mapRoutes)
    .set({ deletedAt: null, updatedAt: new Date(), ...(keepGroup ? {} : { groupId: null }) })
    .where(eq(mapRoutes.id, id))
    .returning();
  return NextResponse.json({ route: toClientRoute(restored) });
}
