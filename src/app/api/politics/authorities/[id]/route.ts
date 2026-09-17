import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { authorityAssignments } from "@/server/db/schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.query.authorityAssignments.findFirst({ where: eq(authorityAssignments.id, id) });
  if (!row) return NextResponse.json({ error: "Authority assignment not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const patch: Partial<typeof authorityAssignments.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.role === "string" && body.role.trim()) patch.role = body.role.trim();
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.notes === "string") patch.notes = body.notes;

  const [updated] = await db.update(authorityAssignments).set(patch).where(eq(authorityAssignments.id, id)).returning();
  return NextResponse.json({ authority: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(authorityAssignments).where(eq(authorityAssignments.id, id));
  return NextResponse.json({ ok: true });
}
