import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { maps } from "../db/schema";
import { validateReparent, type MapNode } from "./hierarchy";

/**
 * Serialized per world (via the transaction) so two concurrent reparents
 * can't both pass validation and jointly create a cycle.
 */
export async function reparentMap(mapId: string, newParentId: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: maps.id, worldId: maps.worldId, parentId: maps.parentId })
      .from(maps);
    const nodes: MapNode[] = rows;

    validateReparent(nodes, mapId, newParentId);

    await tx
      .update(maps)
      .set({ parentId: newParentId, updatedAt: new Date() })
      .where(eq(maps.id, mapId));
  });
}
