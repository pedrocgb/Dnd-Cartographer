import { NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { requireWorldId } from "@/server/world/active-world";
import { hierarchyProfiles, territories } from "@/server/db/schema";
import { encodeHierarchyLevels, parseHierarchyLevels, territoryTypeLabel } from "@/server/politics/hierarchy-config";
import { errorResponse, serverT } from "@/i18n/server";

function serialize(row: typeof hierarchyProfiles.$inferSelect) {
  return { ...row, levels: parseHierarchyLevels(row.levels) };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const profile = await db.query.hierarchyProfiles.findFirst({ where: and(eq(hierarchyProfiles.id, id), eq(hierarchyProfiles.worldId, worldId)) });
  if (!profile) return errorResponse("profileNotFound", 404);

  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("invalidBody", 400);

  const patch: Partial<typeof hierarchyProfiles.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if ("descriptionDocumentId" in body) {
    patch.descriptionDocumentId = body.descriptionDocumentId === null ? null : String(body.descriptionDocumentId);
  }
  if (Array.isArray(body.levels)) patch.levels = encodeHierarchyLevels(body.levels);

  // Editing rules atomically: reject the whole change if any territory
  // currently using this profile would be left with an invalid root type,
  // rather than silently orphaning part of the tree. Descendant edges are
  // re-validated lazily (on next chain resolution) since they're cheap to
  // check and this keeps the edit itself fast.
  if (patch.levels) {
    const usingProfile = await db.query.territories.findMany({
      where: and(eq(territories.hierarchyProfileId, id), isNull(territories.deletedAt)),
    });
    const newLevels = parseHierarchyLevels(patch.levels);
    for (const t of usingProfile) {
      if (t.parentId === null) {
        const stillValidRoot = newLevels.some((l) => l.type === t.type && l.canBeRoot);
        if (!stillValidRoot) {
          return errorResponse("profileRootInvalid", 409, undefined, { name: t.name, type: territoryTypeLabel(t.type, await serverT("politics")) });
        }
      }
    }
  }

  const [updated] = await db.update(hierarchyProfiles).set(patch).where(and(eq(hierarchyProfiles.id, id), eq(hierarchyProfiles.worldId, worldId))).returning();
  return NextResponse.json({ profile: serialize(updated) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const inUse = await db.query.territories.findFirst({
    where: and(eq(territories.hierarchyProfileId, id), isNull(territories.deletedAt)),
  });
  if (inUse) {
    return errorResponse("profileInUse", 409);
  }
  await db.delete(hierarchyProfiles).where(and(eq(hierarchyProfiles.id, id), eq(hierarchyProfiles.worldId, worldId)));
  return NextResponse.json({ ok: true });
}
