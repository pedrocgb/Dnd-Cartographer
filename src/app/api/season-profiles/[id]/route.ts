import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/server/db/client";
import { seasonProfiles } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { cleanName, parseProfileData } from "@/server/calendars/parse";
import { checkProfile, profileUsers } from "@/server/calendars/profiles";
import { recordRevision, toClientProfile } from "@/server/calendars/store";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";

type RouteContext = { params: Promise<{ id: string }> };

async function profileOf(worldId: string, id: string) {
  const [row] = await db.select().from(seasonProfiles).where(and(eq(seasonProfiles.id, id), eq(seasonProfiles.worldId, worldId)));
  return row ?? null;
}

const stale = () => NextResponse.json({ error: "This profile was changed elsewhere. Reload it and try again.", stale: true }, { status: 409 });

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
  if (!row) return notFound("Season profile not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  if (body.expectedVersion !== row.version) return stale();

  try {
    const patch: Partial<typeof seasonProfiles.$inferInsert> = { version: row.version + 1, updatedAt: new Date() };
    if ("name" in body) {
      const name = cleanName(body.name);
      if (!name) return badRequest("A profile name is required.");
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
  if (!(await profileOf(worldId, id))) return notFound("Season profile not found.");
  const users = await profileUsers(worldId, id);
  if (users.articles.length || users.events.length) {
    const who = [...users.articles.map((n) => `article "${n}"`), ...users.events.map((n) => `event "${n}"`)];
    return NextResponse.json({ error: `Still used by ${who.slice(0, 5).join(", ")}${who.length > 5 ? ` and ${who.length - 5} more` : ""}. Change those first, or archive this profile.`, users }, { status: 409 });
  }
  await db.delete(seasonProfiles).where(eq(seasonProfiles.id, id));
  return NextResponse.json({ ok: true });
}
