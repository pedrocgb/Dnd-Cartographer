import { NextResponse } from "next/server";
import { worldArticleLinksJson } from "@/server/calendars/entries";
import { db } from "@/server/db/client";
import { seasons } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { cleanColor, cleanName, parseArticleLinks, parseSeasonCalendar } from "@/server/calendars/parse";
import { checkCalendarIds, toClientSeason } from "@/server/calendars/store";
import { badRequest, calendarErrorResponse, readBody } from "@/server/calendars/respond";

/** Creates a named season for one calendar's profiles (`calendarId`), or shared by all (null). Its timing lives on each profile. */
export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  try {
    const name = cleanName(body.name);
    if (!name) return badRequest("A season name is required.");
    const worldId = await requireWorldId();
    const calendarId = parseSeasonCalendar(body.calendarId);
    await checkCalendarIds(worldId, calendarId ? [calendarId] : null);
    const [row] = await db
      .insert(seasons)
      .values({
        worldId,
        name,
        description: cleanName(body.description, 4000),
        color: cleanColor(body.color) ?? "#47BFAB",
        icon: cleanName(body.icon, 4),
        articleLinks: await worldArticleLinksJson(worldId, parseArticleLinks(body.articleLinks)),
        calendarId,
      })
      .returning();
    return NextResponse.json({ season: toClientSeason(row) }, { status: 201 });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
