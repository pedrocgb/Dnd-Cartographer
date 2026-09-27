import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { mapFolders } from "../db/schema";

/** A folder id from an untrusted body: null for none, undefined when it isn't one of this world's folders. */
export async function validFolderId(worldId: string, raw: unknown): Promise<string | null | undefined> {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return undefined;
  const [folder] = await db.select({ id: mapFolders.id }).from(mapFolders).where(and(eq(mapFolders.id, raw), eq(mapFolders.worldId, worldId)));
  return folder ? folder.id : undefined;
}
