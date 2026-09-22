import { NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { hierarchyProfiles, territories } from "@/server/db/schema";
import { encodeHierarchyLevels, parseHierarchyLevels } from "@/server/politics/hierarchy-config";

function serialize(row: typeof hierarchyProfiles.$inferSelect) {
  return { ...row, levels: parseHierarchyLevels(row.levels) };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await db.query.hierarchyProfiles.findFirst({ where: eq(hierarchyProfiles.id, id) });
  if (!profile) return NextResponse.json({ error: "Hierarchy profile not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

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
          return NextResponse.json(
            { error: `Cannot save: root territory "${t.name}" (type "${t.type}") would no longer be a valid root under the new levels.` },
            { status: 409 }
          );
        }
      }
    }
  }

  const [updated] = await db.update(hierarchyProfiles).set(patch).where(eq(hierarchyProfiles.id, id)).returning();
  return NextResponse.json({ profile: serialize(updated) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inUse = await db.query.territories.findFirst({
    where: and(eq(territories.hierarchyProfileId, id), isNull(territories.deletedAt)),
  });
  if (inUse) {
    return NextResponse.json({ error: "Cannot delete a hierarchy profile that is still in use by a territory." }, { status: 409 });
  }
  await db.delete(hierarchyProfiles).where(eq(hierarchyProfiles.id, id));
  return NextResponse.json({ ok: true });
}
