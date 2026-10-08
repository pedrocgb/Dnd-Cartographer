import { NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { requireWorldId } from "@/server/world/active-world";
import { encodeTags, sanitizeTags } from "@/server/articles/tags";
import { TEMPLATE_LABELS } from "@/server/articles/templates";
import { territories, hierarchyProfiles, markerAffiliations } from "@/server/db/schema";
import { resolveChain, levelsByProfileId, toTerritoryLike, getAuthoritiesForChain, getAffiliatedMarkers } from "@/server/politics/queries";
import { validateChain, computeMissingRequiredTypes } from "@/server/politics/hierarchy-config";
import { sanitizeInfo } from "@/server/articles/info-fields";
import { TERRITORY_INFO } from "@/server/articles/info-sets";
import { RelationError } from "@/server/relations/store";
import { relationErrorResponse } from "@/server/relations/respond";
import { withRelationSync } from "@/server/relations/sync";
import { errorResponse } from "@/i18n/server";
import { chainErrorResponse, chainErrorText } from "@/server/politics/chain-errors";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const territory = await db.query.territories.findFirst({ where: and(eq(territories.id, id), eq(territories.worldId, worldId)) });
  if (!territory) return errorResponse("territoryNotFound", 404);

  const { searchParams } = new URL(request.url);
  if (searchParams.get("withChain") !== "true") {
    return NextResponse.json({ territory });
  }

  const chain = await resolveChain(worldId, id);
  const levelsMap = await levelsByProfileId(chain.map((t) => t.hierarchyProfileId));
  const missing = computeMissingRequiredTypes(toTerritoryLike(chain), levelsMap);
  const [authorities, children, affiliatedMarkers] = await Promise.all([
    getAuthoritiesForChain(worldId, chain.map((t) => t.id)),
    db.query.territories.findMany({ where: eq(territories.parentId, id) }),
    getAffiliatedMarkers(territory),
  ]);

  return NextResponse.json({ territory, chain, missingRequiredTypes: missing, authorities, children, affiliatedMarkers });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const territory = await db.query.territories.findFirst({ where: and(eq(territories.id, id), eq(territories.worldId, worldId)) });
  if (!territory) return errorResponse("territoryNotFound", 404);

  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("invalidBody", 400);

  const patch: Partial<typeof territories.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.type === "string" && body.type.trim()) patch.type = body.type.trim();
  if ("descriptionDocumentId" in body) {
    patch.descriptionDocumentId = body.descriptionDocumentId === null ? null : String(body.descriptionDocumentId);
  }
  if ("sidebarDocumentId" in body) {
    patch.sidebarDocumentId = body.sidebarDocumentId === null ? null : String(body.sidebarDocumentId);
  }
  if ("footerDocumentId" in body) {
    patch.footerDocumentId = body.footerDocumentId === null ? null : String(body.footerDocumentId);
  }
  const tags = sanitizeTags(body.tags, TEMPLATE_LABELS.territory);
  if (tags) patch.tags = encodeTags(tags);
  if ("governmentForm" in body) patch.governmentForm = body.governmentForm === null ? null : String(body.governmentForm);
  if ("powerHolders" in body) patch.powerHolders = body.powerHolders === null ? null : String(body.powerHolders);
  if ("leadershipSelection" in body) patch.leadershipSelection = body.leadershipSelection === null ? null : String(body.leadershipSelection);
  if ("autonomy" in body) patch.autonomy = body.autonomy === null ? null : String(body.autonomy);
  if ("situation" in body) patch.situation = body.situation === null ? null : String(body.situation);
  const info = sanitizeInfo(TERRITORY_INFO, body.info);
  if (info) patch.info = JSON.stringify(info);

  const reparenting = "parentId" in body;
  const changingType = patch.type !== undefined && patch.type !== territory.type;
  const changingProfile = typeof body.hierarchyProfileId === "string" && body.hierarchyProfileId !== territory.hierarchyProfileId;

  if (reparenting || changingType || changingProfile) {
    const nextParentId = reparenting ? (body.parentId === null || body.parentId === "" ? null : String(body.parentId)) : territory.parentId;
    const nextType = typeof patch.type === "string" ? patch.type : territory.type;
    const nextProfileId = changingProfile ? String(body.hierarchyProfileId) : territory.hierarchyProfileId;

    if (nextParentId === id) {
      return errorResponse("territoryOwnParent", 400);
    }
    if (nextParentId) {
      // Reject if nextParentId is a descendant of this territory (would create a cycle).
      const descendantChain = await resolveChain(worldId, nextParentId);
      if (descendantChain.at(-1)?.id !== nextParentId) return errorResponse("parentTerritoryNotFound", 400);
      if (descendantChain.some((t) => t.id === id)) {
        return errorResponse("territoryCycle", 400);
      }
    }
    if (changingProfile) {
      const profile = await db.query.hierarchyProfiles.findFirst({ where: eq(hierarchyProfiles.id, nextProfileId) });
      if (!profile || profile.worldId !== territory.worldId) {
        return errorResponse("profileNotInWorld", 400);
      }
    }

    const ancestors = nextParentId ? toTerritoryLike(await resolveChain(worldId, nextParentId)) : [];
    const candidate = { id, type: nextType, parentId: nextParentId, hierarchyProfileId: nextProfileId };
    const chain = [...ancestors, candidate];
    const levelsMap = await levelsByProfileId(chain.map((t) => t.hierarchyProfileId));
    const result = validateChain(chain, levelsMap);
    if (!result.valid) return chainErrorResponse(result, 400);

    // Atomic: also verify every existing descendant subtree still validates
    // under the changed root/type/profile before committing anything. Each
    // descendant's chain is resolved from the DB as it stands today (only
    // `id`'s own row is hypothetically changing), then the entry matching
    // `id` is substituted with the candidate values before re-validating.
    const allDescendants = await collectDescendants(id);
    for (const desc of allDescendants) {
      const descChainRows = await resolveChain(worldId, desc.id);
      const descChain = toTerritoryLike(descChainRows).map((t) => (t.id === id ? candidate : t));
      const descLevels = await levelsByProfileId(descChain.map((t) => t.hierarchyProfileId));
      const descResult = validateChain(descChain, descLevels);
      if (!descResult.valid) {
        return errorResponse("descendantInvalid", 409, undefined, { name: desc.name, reason: await chainErrorText(descResult) });
      }
    }

    patch.parentId = nextParentId;
    if (changingProfile) patch.hierarchyProfileId = nextProfileId;
  }

  let updated;
  try {
    updated = await withRelationSync(TERRITORY_INFO, territory, body.info, async (ex) => {
      const [row] = await ex.update(territories).set(patch).where(and(eq(territories.id, id), eq(territories.worldId, worldId))).returning();
      return row;
    });
  } catch (err) {
    if (err instanceof RelationError) return relationErrorResponse(err);
    throw err;
  }
  return NextResponse.json({ territory: updated });
}

async function collectDescendants(rootId: string): Promise<Array<typeof territories.$inferSelect>> {
  const result: Array<typeof territories.$inferSelect> = [];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await db.query.territories.findMany({ where: eq(territories.parentId, frontier[0]) });
    // Process one parent id at a time to keep this simple; dataset sizes here are small (local app).
    frontier = frontier.slice(1);
    for (const child of children) {
      result.push(child);
      frontier.push(child.id);
    }
  }
  return result;
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const territory = await db.query.territories.findFirst({ where: and(eq(territories.id, id), eq(territories.worldId, worldId)) });
  if (!territory) return errorResponse("territoryNotFound", 404);

  const children = await db.query.territories.findMany({ where: and(eq(territories.parentId, id), isNull(territories.deletedAt)) });
  if (children.length > 0) {
    return errorResponse("territoryHasChildren", 409, undefined, { count: children.length, n: children.length });
  }
  const affiliated = await db.query.markerAffiliations.findFirst({
    where: eq(markerAffiliations.territoryId, id),
  });
  if (affiliated) {
    return errorResponse("territoryHasMarkers", 409);
  }

  await db.update(territories).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(territories.id, id), eq(territories.worldId, worldId)));
  return NextResponse.json({ ok: true });
}
