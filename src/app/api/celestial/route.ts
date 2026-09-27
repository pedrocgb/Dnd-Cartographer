import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { celestialObjects } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { celestialIssues } from "@/server/calendars/celestial";
import { cleanColor, cleanName, parseArticleLinks, parseCalendarIds, parseCelestialConfig, parseCelestialType } from "@/server/calendars/parse";
import { checkCalendarIds, toClientCelestial } from "@/server/calendars/store";
import { checkArticles } from "@/server/calendars/entries";
import { badRequest, calendarErrorResponse, readBody } from "@/server/calendars/respond";

/** Creates a celestial object, shown in the given `calendarIds` (null = every calendar). */
export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  try {
    const name = cleanName(body.name);
    if (!name) return badRequest("A name is required.");
    const type = parseCelestialType(body.type);
    const config = parseCelestialConfig(body.config);
    const issues = celestialIssues(type, config);
    if (issues.length) return NextResponse.json({ error: issues[0], issues }, { status: 400 });
    const articleLinks = parseArticleLinks(body.articleLinks);
    await checkArticles(articleLinks);
    const worldId = await ensureDefaultWorld();
    const calendarIds = parseCalendarIds(body.calendarIds ?? null);
    await checkCalendarIds(worldId, calendarIds);
    const [row] = await db
      .insert(celestialObjects)
      .values({
        worldId,
        type,
        name,
        color: cleanColor(body.color) ?? "#E8E3D5",
        icon: cleanName(body.icon, 4),
        description: cleanName(body.description, 4000),
        articleLinks: JSON.stringify(articleLinks),
        config: JSON.stringify(config),
        showDayIcon: body.showDayIcon !== false,
        prioritizeDayIcon: body.prioritizeDayIcon === true,
        calendarIds: calendarIds === null ? null : JSON.stringify(calendarIds),
      })
      .returning();
    return NextResponse.json({ object: toClientCelestial(row) }, { status: 201 });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
