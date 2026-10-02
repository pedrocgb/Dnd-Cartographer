import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db/client";
import { requireWorldId } from "@/server/world/active-world";
import { encodeTags, sanitizeTags } from "@/server/articles/tags";
import { TEMPLATE_LABELS, personTemplate } from "@/server/articles/templates";
import { sanitizeInfo } from "@/server/articles/info-fields";
import { personInfoSet } from "@/server/articles/info-sets";
import { people, authorityAssignments } from "@/server/db/schema";
import { getAuthoritiesForPerson } from "@/server/politics/queries";
import { RelationError } from "@/server/relations/store";
import { withRelationSync } from "@/server/relations/sync";
import { foreignIdResponse, idsInWorld } from "@/server/world/guards";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const person = await db.query.people.findFirst({ where: and(eq(people.id, id), eq(people.worldId, worldId)) });
  if (!person) return NextResponse.json({ error: "Person not found." }, { status: 404 });

  const authorities = await getAuthoritiesForPerson(worldId, id);
  return NextResponse.json({ person, authorities });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const person = await db.query.people.findFirst({ where: and(eq(people.id, id), eq(people.worldId, worldId)) });
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
  const tags = sanitizeTags(body.tags, TEMPLATE_LABELS[personTemplate(person.kind)]);
  if (tags) patch.tags = encodeTags(tags);
  if ("houseId" in body) patch.houseId = body.houseId === null ? null : String(body.houseId);
  if ("status" in body) patch.status = body.status === null ? null : String(body.status);
  const info = sanitizeInfo(personInfoSet(person.kind), body.info);
  if (info) patch.info = JSON.stringify(info);

  try {
    if (!(await idsInWorld(worldId, [["rich_documents", patch.descriptionDocumentId], ["rich_documents", patch.sidebarDocumentId], ["rich_documents", patch.footerDocumentId], ["organizations", patch.houseId]]))) return foreignIdResponse();
    const updated = await withRelationSync(personInfoSet(person.kind), person, body.info, async (ex) => {
      const [row] = await ex.update(people).set(patch).where(and(eq(people.id, id), eq(people.worldId, worldId))).returning();
      return row;
    });
    return NextResponse.json({ person: updated });
  } catch (err) {
    if (err instanceof RelationError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const holding = await db.query.authorityAssignments.findFirst({
    where: eq(authorityAssignments.holderId, id),
  });
  if (holding) {
    return NextResponse.json({ error: "Cannot delete: this person still holds an authority assignment." }, { status: 409 });
  }
  await db.update(people).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(people.id, id), eq(people.worldId, worldId)));
  return NextResponse.json({ ok: true });
}
