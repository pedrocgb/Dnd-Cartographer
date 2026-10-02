import { NextResponse } from "next/server";
import { worldArticleLinksJson } from "@/server/calendars/entries";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { calendars } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { validateDefinition } from "@/server/calendars/engine";
import { cleanName, parseArticleLinks, parseDefinition } from "@/server/calendars/parse";
import { chronologyOf, loadWorldCalendars, toClientCalendar, updateChronology } from "@/server/calendars/store";
import { badRequest, calendarErrorResponse, readBody } from "@/server/calendars/respond";

/** The world's chronology, calendars, celestial objects, seasons and profiles. */
export async function GET() {
  const worldId = await requireWorldId();
  return NextResponse.json(await loadWorldCalendars(worldId));
}

/** Creates a calendar. The world's first one becomes the default. */
export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  try {
    const name = cleanName(body.name);
    if (!name) return badRequest("A calendar name is required.");
    const definition = parseDefinition(body.definition);
    const issues = validateDefinition(definition);
    if (issues.length) return NextResponse.json({ error: issues[0].message, issues }, { status: 400 });

    const worldId = await requireWorldId();
    const existing = await db.select({ id: calendars.id }).from(calendars).where(eq(calendars.worldId, worldId));
    const [row] = await db
      .insert(calendars)
      .values({
        worldId,
        name,
        description: cleanName(body.description, 4000),
        definition: JSON.stringify(definition),
        articleLinks: await worldArticleLinksJson(worldId, parseArticleLinks(body.articleLinks)),
        sortOrder: existing.length,
      })
      .returning();
    const chronology = await chronologyOf(worldId);
    if (!chronology.defaultCalendarId) await updateChronology(worldId, chronology.revision, { defaultCalendarId: row.id });
    return NextResponse.json({ calendar: toClientCalendar(row) }, { status: 201 });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
