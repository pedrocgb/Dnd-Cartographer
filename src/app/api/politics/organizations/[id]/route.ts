import { NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { requireWorldId } from "@/server/world/active-world";
import { encodeTags, sanitizeTags } from "@/server/articles/tags";
import { TEMPLATE_LABELS } from "@/server/articles/templates";
import { organizations, people, authorityAssignments } from "@/server/db/schema";
import { ORGANIZATION_KINDS } from "@/server/politics/hierarchy-config";
import { sanitizeColor, sanitizeInfo } from "@/server/articles/info-fields";
import { ORGANIZATION_INFO } from "@/server/articles/info-sets";
import { RelationError } from "@/server/relations/store";
import { relationErrorResponse } from "@/server/relations/respond";
import { withRelationSync } from "@/server/relations/sync";
import { foreignIdResponse, idsInWorld } from "@/server/world/guards";
import { errorResponse } from "@/i18n/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const org = await db.query.organizations.findFirst({ where: and(eq(organizations.id, id), eq(organizations.worldId, worldId)) });
  if (!org) return errorResponse("organizationNotFound", 404);

  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("invalidBody", 400);

  const patch: Partial<typeof organizations.$inferInsert> = { updatedAt: new Date() };
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
  const tags = sanitizeTags(body.tags, TEMPLATE_LABELS.organization);
  if (tags) patch.tags = encodeTags(tags);
  if ("color" in body) patch.color = sanitizeColor(body.color);
  if (typeof body.kind === "string" && (ORGANIZATION_KINDS as readonly string[]).includes(body.kind)) patch.kind = body.kind;
  const info = sanitizeInfo(ORGANIZATION_INFO, body.info);
  if (info) patch.info = JSON.stringify(info);

  let updated;
  try {
    if (!(await idsInWorld(worldId, [["rich_documents", patch.descriptionDocumentId], ["rich_documents", patch.sidebarDocumentId], ["rich_documents", patch.footerDocumentId]]))) return foreignIdResponse();
    updated = await withRelationSync(ORGANIZATION_INFO, org, body.info, async (ex) => {
      const [row] = await ex.update(organizations).set(patch).where(and(eq(organizations.id, id), eq(organizations.worldId, worldId))).returning();
      return row;
    });
  } catch (err) {
    if (err instanceof RelationError) return relationErrorResponse(err);
    throw err;
  }
  return NextResponse.json({ organization: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const member = await db.query.people.findFirst({ where: and(eq(people.houseId, id), isNull(people.deletedAt)) });
  if (member) return errorResponse("organizationHasMembers", 409);
  const holding = await db.query.authorityAssignments.findFirst({ where: eq(authorityAssignments.holderId, id) });
  if (holding) return errorResponse("organizationHoldsAuthority", 409);

  await db.update(organizations).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(organizations.id, id), eq(organizations.worldId, worldId)));
  return NextResponse.json({ ok: true });
}
