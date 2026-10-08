import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/server/db/client";
import { seasonProfiles } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { cleanName, parseProfileData } from "@/server/calendars/parse";
import { checkProfile, profileUsers } from "@/server/calendars/profiles";
import { recordRevision, toClientProfile } from "@/server/calendars/store";
import { calendarErrorResponse, readBody } from "@/server/calendars/respond";
import { errorResponse, serverT } from "@/i18n/server";

type RouteContext = { params: Promise<{ id: string }> };

async function profileOf(worldId: string, id: string) {
  const [row] = await db.select().from(seasonProfiles).where(and(eq(seasonProfiles.id, id), eq(seasonProfiles.worldId, worldId)));
  return row ?? null;
}

const stale = () => errorResponse("seasonProfileStale", 409, { stale: true });

/**
 * Edits a profile (`expectedVersion` required). A changed schedule or
 * reference calendar snapshots the previous one as a revision. `isDefault`
 * makes it the generic preview profile (not a geographic assignment).
 * Articles keep pointing at it by id through renames.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const row = await profileOf(worldId, id);
  if (!row) return errorResponse("seasonProfileNotFound", 404);
  const body = await readBody(request);
  if (!body) return errorResponse("invalidBody", 400);
  if (body.expectedVersion !== row.version) return stale();

  try {
    const patch: Partial<typeof seasonProfiles.$inferInsert> = { version: row.version + 1, updatedAt: new Date() };
    if ("name" in body) {
      const name = cleanName(body.name);
      if (!name) return errorResponse("profileNameRequired", 400);
      patch.name = name;
    }
    if ("description" in body) patch.description = cleanName(body.description, 4000);
    if ("archived" in body) patch.archivedAt = body.archived === true ? new Date() : null;
    let scheduleChanged = false;
    if ("data" in body || "calendarId" in body) {
      const calendarId = typeof body.calendarId === "string" ? body.calendarId : row.calendarId;
      const data = { ...parseProfileData("data" in body ? body.data : JSON.parse(row.data)), calendarId };
      await checkProfile(worldId, data);
      const { calendarId: _calendarId, ...rest } = data;
      void _calendarId;
      patch.calendarId = calendarId;
      patch.data = JSON.stringify(rest);
      scheduleChanged = patch.data !== row.data || calendarId !== row.calendarId;
    }

    const profile = await db.transaction(async (tx) => {
      if (scheduleChanged) await recordRevision(tx, worldId, "profile", id, row.version, { calendarId: row.calendarId, data: JSON.parse(row.data) }, "Schedule change");
      if (body.isDefault === true) {
        await tx.update(seasonProfiles).set({ isDefault: false }).where(and(eq(seasonProfiles.worldId, worldId), ne(seasonProfiles.id, id)));
        patch.isDefault = true;
      }
      const updated = await tx
        .update(seasonProfiles)
        .set(patch)
        .where(and(eq(seasonProfiles.id, id), eq(seasonProfiles.version, row.version)))
        .returning();
      return updated[0] ?? null;
    });
    if (!profile) return stale();
    return NextResponse.json({ profile: toClientProfile(profile) });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}

/** Hard delete only when no article or event refers to it; otherwise archive it or reassign those articles first. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  if (!(await profileOf(worldId, id))) return errorResponse("seasonProfileNotFound", 404);
  const users = await profileUsers(worldId, id);
  if (users.articles.length || users.events.length) {
    const t = await serverT("errors");
    const who = [...users.articles.map((name) => t("usedByArticle", { name })), ...users.events.map((name) => t("usedByEvent", { name }))];
    return errorResponse("seasonProfileInUse", 409, { users }, { list: who.slice(0, 5).join(", "), more: who.length > 5 ? t("andMore", { n: who.length - 5 }) : "" });
  }
  await db.delete(seasonProfiles).where(eq(seasonProfiles.id, id));
  return NextResponse.json({ ok: true });
}
