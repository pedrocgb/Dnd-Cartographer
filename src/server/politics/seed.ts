import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { hierarchyProfiles } from "../db/schema";
import { DEFAULT_HIERARCHY_LEVELS, DEFAULT_PROFILE_NAME, encodeHierarchyLevels } from "./hierarchy-config";

/** Ensures the world has at least the seeded "Default" hierarchy profile, returning its id. */
export async function ensureDefaultHierarchyProfile(worldId: string): Promise<string> {
  const existing = await db.query.hierarchyProfiles.findFirst({
    where: and(eq(hierarchyProfiles.worldId, worldId), eq(hierarchyProfiles.name, DEFAULT_PROFILE_NAME)),
  });
  if (existing) return existing.id;

  const [created] = await db
    .insert(hierarchyProfiles)
    .values({
      worldId,
      name: DEFAULT_PROFILE_NAME,
      description: "Empire (optional) → Kingdom → Duchy → County → Barony (optional). Duchy and County are required.",
      levels: encodeHierarchyLevels(DEFAULT_HIERARCHY_LEVELS),
    })
    .returning({ id: hierarchyProfiles.id });
  return created.id;
}
