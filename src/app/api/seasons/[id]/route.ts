import { NextResponse } from "next/server";
import { worldArticleLinksJson } from "@/server/calendars/entries";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/server/db/client";
import { seasonProfiles, seasons } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { cleanColor, cleanName, parseArticleLinks, parseSeasonCalendar } from "@/server/calendars/parse";
import { checkCalendarIds, toClientSeason } from "@/server/calendars/store";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";

type RouteContext = { params: Promise<{ id: string }> };

async function seasonOf(worldId: string, id: string) {
  const [row] = await db.select().from(seasons).where(and(eq(seasons.id, id), eq(seasons.worldId, worldId)));
  return row ?? null;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const row = await seasonOf(worldId, id);
  if (!row) return notFound("Season not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  try {
    const patch: Partial<typeof seasons.$inferInsert> = { updatedAt: new Date() };
    if ("name" in body) {
      const name = cleanName(body.name);
      if (!name) return badRequest("A season name is required.");
      patch.name = name;
    }
    if ("description" in body) patch.description = cleanName(body.description, 4000);
    if ("color" in body) patch.color = cleanColor(body.color) ?? row.color;
    if ("icon" in body) patch.icon = cleanName(body.icon, 4);
    if ("articleLinks" in body) patch.articleLinks = await worldArticleLinksJson(worldId, parseArticleLinks(body.articleLinks));
    if ("archived" in body) patch.archivedAt = body.archived === true ? new Date() : null;
    if ("calendarId" in body) {
      const calendarId = parseSeasonCalendar(body.calendarId);
      await checkCalendarIds(worldId, calendarId ? [calendarId] : null);
      if (calendarId) {
        // Profiles of other calendars can't keep a season that moves away from them.
        const users = await db
          .select({ name: seasonProfiles.name, calendarId: seasonProfiles.calendarId })
          .from(seasonProfiles)
          .where(and(eq(seasonProfiles.worldId, worldId), like(seasonProfiles.data, `%"seasonId":"${id}"%`)));
        const elsewhere = users.filter((u) => u.calendarId !== calendarId);
        if (elsewhere.length) return NextResponse.json({ error: `Used by ${elsewhere.map((u) => `"${u.name}"`).join(", ")} in another calendar. Remove it there first, or keep it shared.` }, { status: 409 });
      }
      patch.calendarId = calendarId;
    }
    const [updated] = await db.update(seasons).set(patch).where(eq(seasons.id, id)).returning();
    return NextResponse.json({ season: toClientSeason(updated) });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}

/** Deletes a season no profile uses; a season in use must be archived (or removed from its profiles) first. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  if (!(await seasonOf(worldId, id))) return notFound("Season not found.");
  const users = await db
    .select({ name: seasonProfiles.name })
    .from(seasonProfiles)
    .where(and(eq(seasonProfiles.worldId, worldId), like(seasonProfiles.data, `%"seasonId":"${id}"%`)));
  if (users.length) return NextResponse.json({ error: `Used by ${users.map((u) => `"${u.name}"`).join(", ")}. Remove it from those profiles, or archive it instead.` }, { status: 409 });
  await db.delete(seasons).where(eq(seasons.id, id));
  return NextResponse.json({ ok: true });
}
