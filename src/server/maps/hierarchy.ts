import { translate } from "../../i18n/translate";
import type { MessageKey } from "../../i18n/messages";

export interface MapNode {
  id: string;
  worldId: string;
  parentId: string | null;
}

/** A refused move in the map hierarchy. `key` words it for the user (errors namespace); `message` is the en-US text. */
export class InvalidReparentError extends Error {
  constructor(readonly key: MessageKey<"errors">) {
    super(translate("en-US", "errors", key));
  }
}

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
    throw new InvalidReparentError("mapOwnParent");
  }

  const byId = new Map(allMaps.map((m) => [m.id, m]));
  const map = byId.get(mapId);
  const newParent = byId.get(newParentId);

  if (!map) {
    throw new InvalidReparentError("mapNotFound");
  }
  if (!newParent) {
    throw new InvalidReparentError("unknownParentMap");
  }
  if (newParent.worldId !== map.worldId) {
    throw new InvalidReparentError("mapsSameWorld");
  }

  // Walk up from the proposed parent; if we hit mapId, this would create a cycle.
  let cursor: MapNode | undefined = newParent;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor.id === mapId) {
      throw new InvalidReparentError("mapCycle");
    }
    if (seen.has(cursor.id)) {
      throw new InvalidReparentError("mapHierarchyCycle");
    }
    seen.add(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
}
