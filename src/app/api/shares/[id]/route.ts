import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { shareLinks } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";

/** Revokes a share link: its URL stops working for good. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const now = new Date();
  const [row] = await db
    .update(shareLinks)
    .set({ revokedAt: now, updatedAt: now })
    .where(and(eq(shareLinks.id, id), eq(shareLinks.worldId, worldId), isNull(shareLinks.revokedAt)))
    .returning({ id: shareLinks.id });
  if (!row) return NextResponse.json({ error: "Share link not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
