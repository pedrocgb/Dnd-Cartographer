import { eq, inArray, and } from "drizzle-orm";
import { db } from "../db/client";
import { territories, hierarchyProfiles, markerAffiliations, authorityAssignments } from "../db/schema";
import { parseHierarchyLevels, type HierarchyLevel, type TerritoryLike } from "./hierarchy-config";

export type TerritoryRow = typeof territories.$inferSelect;

/** Walks parentId up to the root, returning [root, ..., leaf]. Throws nothing on a cycle — stops once it revisits an id. */
export async function resolveChain(territoryId: string): Promise<TerritoryRow[]> {
  const chain: TerritoryRow[] = [];
  const seen = new Set<string>();
  let currentId: string | null = territoryId;
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const row: TerritoryRow | undefined = await db.query.territories.findFirst({ where: eq(territories.id, currentId) });
    if (!row) break;
    chain.unshift(row);
    currentId = row.parentId;
  }
  return chain;
}

export async function levelsByProfileId(profileIds: string[]): Promise<Map<string, HierarchyLevel[]>> {
  const uniqueIds = Array.from(new Set(profileIds));
  if (uniqueIds.length === 0) return new Map();
  const rows = await db.query.hierarchyProfiles.findMany({ where: inArray(hierarchyProfiles.id, uniqueIds) });
  const map = new Map<string, HierarchyLevel[]>();
  for (const row of rows) map.set(row.id, parseHierarchyLevels(row.levels));
  return map;
}

export function toTerritoryLike(rows: TerritoryRow[]): TerritoryLike[] {
  return rows.map((r) => ({ id: r.id, type: r.type, parentId: r.parentId, hierarchyProfileId: r.hierarchyProfileId }));
}

export async function getAcceptedAffiliation(markerId: string) {
  return db.query.markerAffiliations.findFirst({
    where: and(eq(markerAffiliations.markerId, markerId), eq(markerAffiliations.status, "accepted")),
  });
}

export async function getDraftAffiliation(markerId: string) {
  return db.query.markerAffiliations.findFirst({
    where: and(eq(markerAffiliations.markerId, markerId), eq(markerAffiliations.status, "draft")),
  });
}

export async function getAuthoritiesForChain(territoryIds: string[]) {
  if (territoryIds.length === 0) return [];
  return db.query.authorityAssignments.findMany({ where: inArray(authorityAssignments.territoryId, territoryIds) });
}
