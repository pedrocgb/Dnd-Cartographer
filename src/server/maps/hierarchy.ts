export interface MapNode {
  id: string;
  worldId: string;
  parentId: string | null;
}

export class InvalidReparentError extends Error {}

/**
 * Pure validation, independent of the database, so it can be unit tested
 * without a live connection and reused inside a DB transaction.
 */
export function validateReparent(
  allMaps: MapNode[],
  mapId: string,
  newParentId: string | null
): void {
  if (newParentId === null) return;

  if (newParentId === mapId) {
    throw new InvalidReparentError("A map cannot be its own parent.");
  }

  const byId = new Map(allMaps.map((m) => [m.id, m]));
  const map = byId.get(mapId);
  const newParent = byId.get(newParentId);

  if (!map) {
    throw new InvalidReparentError(`Unknown map: ${mapId}`);
  }
  if (!newParent) {
    throw new InvalidReparentError(`Unknown parent map: ${newParentId}`);
  }
  if (newParent.worldId !== map.worldId) {
    throw new InvalidReparentError("Maps must share the same world to be linked.");
  }

  // Walk up from the proposed parent; if we hit mapId, this would create a cycle.
  let cursor: MapNode | undefined = newParent;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor.id === mapId) {
      throw new InvalidReparentError("This move would create a cycle.");
    }
    if (seen.has(cursor.id)) {
      throw new InvalidReparentError("Existing hierarchy already contains a cycle.");
    }
    seen.add(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
}
