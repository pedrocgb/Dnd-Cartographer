import { NextResponse } from "next/server";
import { worldArticleLinksJson } from "@/server/calendars/entries";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { calendars } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { cleanName, parseArticleLinks, parseDefinition } from "@/server/calendars/parse";
import { applyDefinition, parseMigration } from "@/server/calendars/mutations";
import { calendarOf, chronologyOf, StaleError, toClientCalendar } from "@/server/calendars/store";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";

type RouteContext = { params: Promise<{ id: string }> };

const stale = () => NextResponse.json({ error: "This calendar was changed elsewhere. Reload it and try again.", stale: true }, { status: 409 });

/**
 * Edits a calendar: `expectedVersion` is required (stale edits get 409).
 * Name/description/articleLinks change freely; a new `definition`
 * goes through the impact review (`migration` = { mode, keepPhysical,
 * acknowledgeReferences }) and leaves a restorable revision.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const row = await calendarOf(worldId, id);
  if (!row) return notFound("Calendar not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  if (body.expectedVersion !== row.version) return stale();

  try {
    const extra: Partial<typeof calendars.$inferInsert> = {};
    if ("name" in body) {
      const name = cleanName(body.name);
      if (!name) return badRequest("A calendar name is required.");
      extra.name = name;
    }
    if ("description" in body) extra.description = cleanName(body.description, 4000);
    if ("articleLinks" in body) extra.articleLinks = await worldArticleLinksJson(worldId, parseArticleLinks(body.articleLinks));

    if ("definition" in body) {
      const definition = parseDefinition(body.definition);
      if (JSON.stringify(definition) !== row.definition) {
        const calendar = await applyDefinition(worldId, row, definition, parseMigration(body.migration), extra);
        return NextResponse.json({ calendar });
      }
    }
    const updated = await db
      .update(calendars)
      .set({ ...extra, version: row.version + 1, updatedAt: new Date() })
      .where(and(eq(calendars.id, id), eq(calendars.version, row.version)))
      .returning();
    if (updated.length === 0) throw new StaleError("This calendar was changed elsewhere. Reload it and try again.");
    return NextResponse.json({ calendar: toClientCalendar(updated[0]) });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}

/**
 * Moves a calendar to the Trash (restored or purged from there). Its rows
 * stay, so campaigns, season profiles and repeat rules that use it keep
 * reading their dates; the default calendar can't go.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const row = await calendarOf(worldId, id);
  if (!row) return notFound("Calendar not found.");
  const chronology = await chronologyOf(worldId);
  if (chronology.defaultCalendarId === id) return badRequest("This is the default calendar. Make another calendar the default before deleting it.");
  const now = new Date();
  await db
    .update(calendars)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(calendars.id, id), isNull(calendars.deletedAt)));
  return NextResponse.json({ ok: true });
}
