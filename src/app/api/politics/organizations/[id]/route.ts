import { NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, people, authorityAssignments } from "@/server/db/schema";
import { ORGANIZATION_KINDS } from "@/server/politics/hierarchy-config";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, id) });
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const patch: Partial<typeof organizations.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if ("descriptionDocumentId" in body) {
    patch.descriptionDocumentId = body.descriptionDocumentId === null ? null : String(body.descriptionDocumentId);
  }
  if (typeof body.kind === "string" && (ORGANIZATION_KINDS as readonly string[]).includes(body.kind)) patch.kind = body.kind;

  const [updated] = await db.update(organizations).set(patch).where(eq(organizations.id, id)).returning();
  return NextResponse.json({ organization: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await db.query.people.findFirst({ where: and(eq(people.houseId, id), isNull(people.deletedAt)) });
  if (member) return NextResponse.json({ error: "Cannot delete: a person still lists this as their house." }, { status: 409 });
  const holding = await db.query.authorityAssignments.findFirst({ where: eq(authorityAssignments.holderId, id) });
  if (holding) return NextResponse.json({ error: "Cannot delete: this organization still holds an authority assignment." }, { status: 409 });

  await db.update(organizations).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(organizations.id, id));
  return NextResponse.json({ ok: true });
}
