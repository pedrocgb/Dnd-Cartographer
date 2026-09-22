import { eq, inArray, and, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { territories, hierarchyProfiles, markerAffiliations, authorityAssignments, markers, maps } from "../db/schema";
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

/** Every authority a given person holds, with the territory's name resolved for display. */
export async function getAuthoritiesForPerson(personId: string) {
  const rows = await db.query.authorityAssignments.findMany({
    where: and(eq(authorityAssignments.holderType, "person"), eq(authorityAssignments.holderId, personId)),
  });
  if (rows.length === 0) return [];

  const territoryIds = Array.from(new Set(rows.map((r) => r.territoryId)));
  const territoryRows = await db.query.territories.findMany({ where: inArray(territories.id, territoryIds) });
  const territoryNameById = new Map(territoryRows.map((t) => [t.id, t.name]));

  return rows.map((r) => ({
    territoryId: r.territoryId,
    territoryName: territoryNameById.get(r.territoryId) ?? "Unknown territory",
    role: r.role,
    title: r.title,
  }));
}

/** Every non-deleted descendant of `rootId` (not including itself), via BFS over parentId. */
export async function collectDescendantTerritories(rootId: string): Promise<TerritoryRow[]> {
  const result: TerritoryRow[] = [];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await db.query.territories.findMany({
      where: and(eq(territories.parentId, frontier[0]), isNull(territories.deletedAt)),
    });
    frontier = frontier.slice(1);
    for (const child of children) {
      result.push(child);
      frontier.push(child.id);
    }
  }
  return result;
}

/**
 * Markers with an accepted affiliation anywhere in this territory's own
 * subtree (itself or any descendant) — a Kingdom's page lists every marker
 * in every Duchy/County/Settlement beneath it, not just markers affiliated
 * with the Kingdom row directly.
 */
export async function getAffiliatedMarkers(territoryId: string) {
  const descendants = await collectDescendantTerritories(territoryId);
  const territoryIds = [territoryId, ...descendants.map((t) => t.id)];
  const affiliations = await db.query.markerAffiliations.findMany({
    where: and(inArray(markerAffiliations.territoryId, territoryIds), eq(markerAffiliations.status, "accepted")),
  });
  if (affiliations.length === 0) return [];

  const markerIds = Array.from(new Set(affiliations.map((a) => a.markerId)));
  const markerRows = await db.query.markers.findMany({ where: and(inArray(markers.id, markerIds), isNull(markers.deletedAt)) });
  const mapIds = Array.from(new Set(markerRows.map((m) => m.mapId)));
  const mapRows = mapIds.length > 0 ? await db.query.maps.findMany({ where: inArray(maps.id, mapIds) }) : [];
  const mapNameById = new Map(mapRows.map((m) => [m.id, m.name]));
  const selfRow = await db.query.territories.findFirst({ where: eq(territories.id, territoryId) });
  const territoryNameById = new Map([...descendants, ...(selfRow ? [selfRow] : [])].map((t) => [t.id, t.name]));

  const affiliationByMarker = new Map(affiliations.map((a) => [a.markerId, a.territoryId]));
  return markerRows
    .map((m) => ({
      id: m.id,
      name: m.name,
      mapId: m.mapId,
      mapName: mapNameById.get(m.mapId) ?? "Unknown map",
      viaTerritoryName: territoryNameById.get(affiliationByMarker.get(m.id) ?? "") ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
