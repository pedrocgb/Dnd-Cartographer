import { NextResponse } from "next/server";
import { and, eq, isNull, like } from "drizzle-orm";
import { db } from "@/server/db/client";
import { calendarEntries, celestialObjects } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { celestialIssues, type CelestialType } from "@/server/calendars/celestial";
import { cleanColor, cleanName, parseArticleLinks, parseCalendarIds, parseCelestialConfig } from "@/server/calendars/parse";
import { checkCalendarIds, recordRevision, toClientCelestial } from "@/server/calendars/store";
import { checkArticles } from "@/server/calendars/entries";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";

type RouteContext = { params: Promise<{ id: string }> };

async function objectOf(worldId: string, id: string) {
  const [row] = await db.select().from(celestialObjects).where(and(eq(celestialObjects.id, id), eq(celestialObjects.worldId, worldId)));
  return row ?? null;
}

/**
 * Edits an object (`expectedVersion` required). A changed `config` (phases,
 * anchor, restarts, overrides, schedules) snapshots the previous one as a
 * restorable revision first. The type never changes after creation.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await ensureDefaultWorld();
  const row = await objectOf(worldId, id);
  if (!row) return notFound("Celestial object not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  if (body.expectedVersion !== row.version) return NextResponse.json({ error: "This object was changed elsewhere. Reload it and try again.", stale: true }, { status: 409 });

  try {
    const patch: Partial<typeof celestialObjects.$inferInsert> = { version: row.version + 1, updatedAt: new Date() };
    if ("name" in body) {
      const name = cleanName(body.name);
      if (!name) return badRequest("A name is required.");
      patch.name = name;
    }
    if ("color" in body) patch.color = cleanColor(body.color) ?? row.color;
    if ("icon" in body) patch.icon = cleanName(body.icon, 4);
    if ("description" in body) patch.description = cleanName(body.description, 4000);
    if ("articleLinks" in body) {
      const links = parseArticleLinks(body.articleLinks);
      await checkArticles(links);
      patch.articleLinks = JSON.stringify(links);
    }
    if ("showDayIcon" in body) patch.showDayIcon = body.showDayIcon !== false;
    if ("prioritizeDayIcon" in body) patch.prioritizeDayIcon = body.prioritizeDayIcon === true;
    if ("calendarIds" in body) {
      const calendarIds = parseCalendarIds(body.calendarIds);
      await checkCalendarIds(worldId, calendarIds);
      patch.calendarIds = calendarIds === null ? null : JSON.stringify(calendarIds);
    }
    if ("archived" in body) patch.archivedAt = body.archived === true ? new Date() : null;
    let configChanged = false;
    if ("config" in body) {
      const config = parseCelestialConfig(body.config);
      const issues = celestialIssues(row.type as CelestialType, config);
      if (issues.length) return NextResponse.json({ error: issues[0], issues }, { status: 400 });
      patch.config = JSON.stringify(config);
      configChanged = patch.config !== row.config;
    }

    const object = await db.transaction(async (tx) => {
      if (configChanged) await recordRevision(tx, worldId, "celestial", id, row.version, { config: JSON.parse(row.config) }, typeof body.reason === "string" ? body.reason.slice(0, 120) : "Cycle change");
      const updated = await tx
        .update(celestialObjects)
        .set(patch)
        .where(and(eq(celestialObjects.id, id), eq(celestialObjects.version, row.version)))
        .returning();
      return updated[0] ?? null;
    });
    if (!object) return NextResponse.json({ error: "This object was changed elsewhere. Reload it and try again.", stale: true }, { status: 409 });
    return NextResponse.json({ object: toClientCelestial(object) });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}

/** Deletes an object nothing refers to; one used by an event condition must be archived instead. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await ensureDefaultWorld();
  if (!(await objectOf(worldId, id))) return notFound("Celestial object not found.");
  const [used] = await db
    .select({ id: calendarEntries.id })
    .from(calendarEntries)
    .where(and(eq(calendarEntries.worldId, worldId), isNull(calendarEntries.deletedAt), like(calendarEntries.recurrence, `%"objectId":"${id}"%`)))
    .limit(1);
  if (used) return NextResponse.json({ error: "An event repeats on this object's phases. Archive it instead, or change that event first." }, { status: 409 });
  await db.delete(celestialObjects).where(eq(celestialObjects.id, id));
  return NextResponse.json({ ok: true });
}
