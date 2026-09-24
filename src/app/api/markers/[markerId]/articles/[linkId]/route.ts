import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { markerArticleLinks } from "@/server/db/schema";

export async function DELETE(_request: Request, { params }: { params: Promise<{ markerId: string; linkId: string }> }) {
  const { markerId, linkId } = await params;
  await db.delete(markerArticleLinks).where(and(eq(markerArticleLinks.id, linkId), eq(markerArticleLinks.markerId, markerId)));
  return NextResponse.json({ ok: true });
}
