import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { celestialObjects, definitionRevisions, seasonProfiles } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { safeJson } from "@/server/calendars/parse";
import { recordRevision, toClientCelestial, toClientProfile } from "@/server/calendars/store";
import { readBody } from "@/server/calendars/respond";
import { errorResponse } from "@/i18n/server";

type RouteContext = { params: Promise<{ id: string }> };

const stale = () => errorResponse("revisionStale", 409, { stale: true });

/**
 * Restores a celestial object's config or a season profile's schedule from
 * revision `id` (with the subject's `expectedVersion`), as a new version —
 * the current one is saved as a revision first.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const [revision] = await db.select().from(definitionRevisions).where(and(eq(definitionRevisions.id, id), eq(definitionRevisions.worldId, worldId)));
  if (!revision || revision.subjectType === "calendar") return errorResponse("revisionNotFound", 404);
  const body = await readBody(request);
  if (!body) return errorResponse("invalidBody", 400);

  if (revision.subjectType === "celestial") {
    const snapshot = safeJson<{ config?: unknown } | null>(revision.snapshot, null);
    const [row] = await db.select().from(celestialObjects).where(and(eq(celestialObjects.id, revision.subjectId), eq(celestialObjects.worldId, worldId)));
    if (!row || !snapshot?.config) return errorResponse("revisionObjectGone", 404);
    if (body.expectedVersion !== row.version) return stale();
    const updated = await db.transaction(async (tx) => {
      await recordRevision(tx, worldId, "celestial", row.id, row.version, { config: safeJson(row.config, {}) }, `Before restoring version ${revision.version}`);
      const rows = await tx
        .update(celestialObjects)
        .set({ config: JSON.stringify(snapshot.config), version: row.version + 1, updatedAt: new Date() })
        .where(and(eq(celestialObjects.id, row.id), eq(celestialObjects.version, row.version)))
        .returning();
      return rows[0] ?? null;
    });
    return updated ? NextResponse.json({ object: toClientCelestial(updated) }) : stale();
  }

  const snapshot = safeJson<{ calendarId?: string; data?: unknown } | null>(revision.snapshot, null);
  const [row] = await db.select().from(seasonProfiles).where(and(eq(seasonProfiles.id, revision.subjectId), eq(seasonProfiles.worldId, worldId)));
  if (!row || !snapshot?.data || !snapshot.calendarId) return errorResponse("revisionProfileGone", 404);
  if (body.expectedVersion !== row.version) return stale();
  const updated = await db.transaction(async (tx) => {
    await recordRevision(tx, worldId, "profile", row.id, row.version, { calendarId: row.calendarId, data: safeJson(row.data, {}) }, `Before restoring version ${revision.version}`);
    const rows = await tx
      .update(seasonProfiles)
      .set({ calendarId: snapshot.calendarId, data: JSON.stringify(snapshot.data), version: row.version + 1, updatedAt: new Date() })
      .where(and(eq(seasonProfiles.id, row.id), eq(seasonProfiles.version, row.version)))
      .returning();
    return rows[0] ?? null;
  });
  return updated ? NextResponse.json({ profile: toClientProfile(updated) }) : stale();
}
