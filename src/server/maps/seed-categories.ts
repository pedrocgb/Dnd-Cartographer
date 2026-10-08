import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { mapCategories } from "../db/schema";
import { serverT } from "@/i18n/server";

/** Seeded in the user's language when a world is new; after that the labels are the user's to edit. */
const SEEDED_KEYS = [
  "cosmology",
  "world",
  "continent",
  "region",
  "realm",
  "province",
  "archipelago",
  "settlement",
  "city",
  "district",
  "wilderness",
  "underground",
  "dungeon",
  "building",
  "battlemap",
  "custom",
] as const;

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

  const t = await serverT("maps");
  await db
    .insert(mapCategories)
    .values(SEEDED_KEYS.map((key, index) => ({ worldId, label: t(`seedCategory.${key}`), sortOrder: index })))
    .onConflictDoNothing();
}
