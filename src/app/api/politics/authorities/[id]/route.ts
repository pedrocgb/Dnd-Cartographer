import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db/client";
import { requireWorldId } from "@/server/world/active-world";
import { authorityAssignments } from "@/server/db/schema";
import { errorResponse } from "@/i18n/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const row = await db.query.authorityAssignments.findFirst({ where: and(eq(authorityAssignments.id, id), eq(authorityAssignments.worldId, worldId)) });
  if (!row) return errorResponse("authorityNotFound", 404);

  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("invalidBody", 400);

  const patch: Partial<typeof authorityAssignments.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.role === "string" && body.role.trim()) patch.role = body.role.trim();
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.notes === "string") patch.notes = body.notes;

  const [updated] = await db.update(authorityAssignments).set(patch).where(and(eq(authorityAssignments.id, id), eq(authorityAssignments.worldId, worldId))).returning();
  return NextResponse.json({ authority: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worldId = await requireWorldId();
  await db.delete(authorityAssignments).where(and(eq(authorityAssignments.id, id), eq(authorityAssignments.worldId, worldId)));
  return NextResponse.json({ ok: true });
}
