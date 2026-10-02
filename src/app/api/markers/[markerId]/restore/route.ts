import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { markers } from "@/server/db/schema";
import { toClientMarker } from "@/server/markers/tag-registry";
import { notInWorld } from "@/server/world/guards";

export async function POST(_request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const denied = await notInWorld("markers", markerId, "Marker not found.");
  if (denied) return denied;
  const [restored] = await db
    .update(markers)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(markers.id, markerId))
    .returning();
  if (!restored) {
    return NextResponse.json({ error: "Marker not found." }, { status: 404 });
  }
  return NextResponse.json({ marker: toClientMarker(restored) });
}
