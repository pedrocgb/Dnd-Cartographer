import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { maps } from "@/server/db/schema";
import { restoreItems } from "@/server/trash/restore";

/** Same as restoring the map from the Trash (see restoreItems). */
export async function POST(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) {
    return NextResponse.json({ error: "Map not found." }, { status: 404 });
  }
  await restoreItems([{ kind: "map", id: mapId }]);
  return NextResponse.json({ map: await db.query.maps.findFirst({ where: eq(maps.id, mapId) }) });
}
