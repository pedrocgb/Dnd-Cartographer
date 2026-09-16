import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { mapCategories } from "../db/schema";

const SEEDED_LABELS = [
  "Cosmology / Planes",
  "World",
  "Continent",
  "Region",
  "Realm / Nation",
  "Province",
  "Archipelago / Island",
  "Settlement",
  "City",
  "District",
  "Wilderness",
  "Underground",
  "Dungeon",
  "Building / Interior",
  "Battlemap",
  "Custom",
];

/**
 * Seeded categories describe maps without dictating parent/child type
 * relationships — see the plan's map organization section. Called on every
 * request that needs the category list, so this must be safe under
 * concurrent calls (e.g. multiple tabs/components loading at once) — the
 * check-then-insert below is *not* atomic by itself (two concurrent calls
 * can both see zero existing rows and both insert a full set), so the real
 * guard is the unique (world_id, label) index plus onConflictDoNothing:
 * worst case, concurrent calls redundantly attempt the same 16 inserts and
 * all but one silently no-op. Confirmed this was a real bug, not a
 * theoretical one — see scripts/dedupe-map-categories.mjs, which repairs
 * data seeded before this fix.
 */
export async function ensureSeededCategories(worldId: string): Promise<void> {
  const existing = await db
    .select({ id: mapCategories.id })
    .from(mapCategories)
    .where(eq(mapCategories.worldId, worldId))
    .limit(1);
  if (existing.length > 0) return;

  await db
    .insert(mapCategories)
    .values(SEEDED_LABELS.map((label, index) => ({ worldId, label, sortOrder: index })))
    .onConflictDoNothing();
}
