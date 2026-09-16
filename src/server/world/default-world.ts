import { db } from "../db/client";
import { worlds } from "../db/schema";

/**
 * Multi-world UI is out of scope until sharing/collaboration is introduced.
 * For now every map belongs to a single bootstrapped "local" world.
 */
export async function ensureDefaultWorld(): Promise<string> {
  const existing = await db.select({ id: worlds.id }).from(worlds).limit(1);
  if (existing.length > 0) return existing[0].id;

  const [created] = await db
    .insert(worlds)
    .values({ name: "My World" })
    .returning({ id: worlds.id });
  return created.id;
}
