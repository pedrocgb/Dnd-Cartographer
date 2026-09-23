import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapTexts } from "@/server/db/schema";
import { withLayerIds } from "@/server/layers/layer-ids";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [restored] = await db.update(mapTexts).set({ deletedAt: null, updatedAt: new Date() }).where(eq(mapTexts.id, id)).returning();
  if (!restored) return NextResponse.json({ error: "Text not found." }, { status: 404 });
  return NextResponse.json({ text: withLayerIds(restored) });
}
