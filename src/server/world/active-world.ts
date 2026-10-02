import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { worlds } from "../db/schema";
import { WORLD_COOKIE } from "./world-cookie";

export class NoWorldError extends Error {
  constructor() {
    super("Choose a world first.");
  }
}

/** The open world (id and name), or null when none is chosen or it no longer exists. */
export async function activeWorld(): Promise<{ id: string; name: string } | null> {
  const id = (await cookies()).get(WORLD_COOKIE)?.value;
  if (!id) return null;
  const [row] = await db.select({ id: worlds.id, name: worlds.name }).from(worlds).where(eq(worlds.id, id));
  return row ?? null;
}

/**
 * The id of the open world, for request handlers. Every query is scoped to it.
 * Requests without a world cookie are already answered by src/proxy.ts; this
 * throws when the cookie names a world that no longer exists.
 */
export async function requireWorldId(): Promise<string> {
  const world = await activeWorld();
  if (!world) throw new NoWorldError();
  return world.id;
}
