import { db } from "@/server/db/client";
import { richDocuments } from "@/server/db/schema";
import { SCHEMA_VERSION } from "@/server/documents/schema";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

/** Inserts an empty rich document into the world and returns its row. */
export async function createEmptyDocument(worldId: string) {
  const [doc] = await db
    .insert(richDocuments)
    .values({ worldId, jsonText: JSON.stringify(EMPTY_DOC), plainText: "", schemaVersion: SCHEMA_VERSION })
    .returning();
  return doc;
}
