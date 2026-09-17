import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { markers } from "@/server/db/schema";
import { toClientMarker } from "@/server/markers/tag-registry";

export async function POST(_request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
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
