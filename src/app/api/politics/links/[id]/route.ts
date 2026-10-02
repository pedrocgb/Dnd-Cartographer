import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db/client";
import { requireWorldId } from "@/server/world/active-world";
import { politicalLinks } from "@/server/db/schema";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worldId = await requireWorldId();
  await db.delete(politicalLinks).where(and(eq(politicalLinks.id, id), eq(politicalLinks.worldId, worldId)));
  return NextResponse.json({ ok: true });
}
