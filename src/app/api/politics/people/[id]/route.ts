import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { encodeTags, sanitizeTags } from "@/server/articles/tags";
import { TEMPLATE_LABELS } from "@/server/articles/templates";
import { sanitizeInfo } from "@/server/articles/info-fields";
import { CHARACTER_INFO } from "@/server/articles/info-sets";
import { people, authorityAssignments } from "@/server/db/schema";
import { getAuthoritiesForPerson } from "@/server/politics/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await db.query.people.findFirst({ where: eq(people.id, id) });
  if (!person) return NextResponse.json({ error: "Person not found." }, { status: 404 });

  const authorities = await getAuthoritiesForPerson(id);
  return NextResponse.json({ person, authorities });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await db.query.people.findFirst({ where: eq(people.id, id) });
  if (!person) return NextResponse.json({ error: "Person not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const patch: Partial<typeof people.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if ("descriptionDocumentId" in body) {
    patch.descriptionDocumentId = body.descriptionDocumentId === null ? null : String(body.descriptionDocumentId);
  }
  if ("sidebarDocumentId" in body) {
    patch.sidebarDocumentId = body.sidebarDocumentId === null ? null : String(body.sidebarDocumentId);
  }
  if ("footerDocumentId" in body) {
    patch.footerDocumentId = body.footerDocumentId === null ? null : String(body.footerDocumentId);
  }
  const tags = sanitizeTags(body.tags, TEMPLATE_LABELS.character);
  if (tags) patch.tags = encodeTags(tags);
  if ("houseId" in body) patch.houseId = body.houseId === null ? null : String(body.houseId);
  if ("status" in body) patch.status = body.status === null ? null : String(body.status);
  const info = sanitizeInfo(CHARACTER_INFO, body.info);
  if (info) patch.info = JSON.stringify(info);

  const [updated] = await db.update(people).set(patch).where(eq(people.id, id)).returning();
  return NextResponse.json({ person: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const holding = await db.query.authorityAssignments.findFirst({
    where: eq(authorityAssignments.holderId, id),
  });
  if (holding) {
    return NextResponse.json({ error: "Cannot delete: this person still holds an authority assignment." }, { status: 409 });
  }
  await db.update(people).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(people.id, id));
  return NextResponse.json({ ok: true });
}
