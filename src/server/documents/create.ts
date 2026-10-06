import { db } from "@/server/db/client";
import { richDocuments } from "@/server/db/schema";
import { SCHEMA_VERSION, deriveText, validateDocument } from "@/server/documents/schema";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

/** Inserts an empty rich document into the world and returns its row. */
export async function createEmptyDocument(worldId: string) {
  return createDocument(worldId, EMPTY_DOC);
}

/** Inserts a rich document with the given content (validated) and returns its row. */
export async function createDocument(worldId: string, json: unknown, executor: Executor = db) {
  validateDocument(json);
  const [doc] = await executor
    .insert(richDocuments)
    .values({ worldId, jsonText: JSON.stringify(json), plainText: deriveText(json), schemaVersion: SCHEMA_VERSION })
    .returning();
  return doc;
}
