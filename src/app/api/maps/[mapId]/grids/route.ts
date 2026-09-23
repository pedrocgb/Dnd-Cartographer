import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapGrids } from "@/server/db/schema";

/** Every layer's grid on this map (at most one per layer). */
export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const grids = await db.select().from(mapGrids).where(eq(mapGrids.mapId, mapId));
  return NextResponse.json({ grids });
}
