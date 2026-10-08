import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { hierarchyProfiles, richDocuments } from "../db/schema";
import { DEFAULT_HIERARCHY_LEVELS, DEFAULT_PROFILE_NAME, encodeHierarchyLevels } from "./hierarchy-config";
import { SCHEMA_VERSION } from "../documents/schema";
import { serverT } from "@/i18n/server";

/** Ensures the world has at least the seeded "Default" hierarchy profile, returning its id. */
export async function ensureDefaultHierarchyProfile(worldId: string): Promise<string> {
  const existing = await db.query.hierarchyProfiles.findFirst({
    where: and(eq(hierarchyProfiles.worldId, worldId), eq(hierarchyProfiles.name, DEFAULT_PROFILE_NAME)),
  });
  if (existing) return existing.id;

  // Written in the user's language; after that it is the user's own text.
  const description = (await serverT("politics"))("defaultProfile.description");

  const [doc] = await db
    .insert(richDocuments)
    .values({
      worldId,
      jsonText: JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: description }] }],
      }),
      plainText: description,
      schemaVersion: SCHEMA_VERSION,
    })
    .returning({ id: richDocuments.id });

  const [created] = await db
    .insert(hierarchyProfiles)
    .values({
      worldId,
      name: DEFAULT_PROFILE_NAME,
      descriptionDocumentId: doc.id,
      levels: encodeHierarchyLevels(DEFAULT_HIERARCHY_LEVELS),
    })
    .returning({ id: hierarchyProfiles.id });
  return created.id;
}
