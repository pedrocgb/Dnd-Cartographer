import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaigns } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { cleanName } from "@/server/calendars/parse";
import { checkCalendarIds } from "@/server/calendars/store";
import { badRequest, calendarErrorResponse, readBody } from "@/server/calendars/respond";
import { parseCurrencies } from "@/server/sessions/parse";
import { rosterOf, toClientCampaign } from "@/server/sessions/store";
import { D_AND_D_COINS } from "@/server/sessions/types";

/** The world's campaigns with their party rosters. */
export async function GET() {
  const worldId = await requireWorldId();
  const rows = await db.select().from(campaigns).where(eq(campaigns.worldId, worldId)).orderBy(asc(campaigns.sortOrder), asc(campaigns.createdAt));
  const list = await Promise.all(rows.map(async (row) => toClientCampaign(row, await rosterOf(row.id))));
  return NextResponse.json({ campaigns: list });
}

/** Creates a campaign read in `calendarId`; coins default to the D&D set. */
export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  try {
    const name = cleanName(body.name);
    if (!name) return badRequest("A campaign name is required.");
    if (typeof body.calendarId !== "string" || !body.calendarId) return badRequest("Pick the calendar this campaign's dates are read in.");
    const worldId = await requireWorldId();
    await checkCalendarIds(worldId, [body.calendarId]);
    const currencies = body.currencies === undefined ? D_AND_D_COINS : parseCurrencies(body.currencies);
    const existing = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.worldId, worldId));
    const [row] = await db
      .insert(campaigns)
      .values({ worldId, name, description: cleanName(body.description, 4000), calendarId: body.calendarId, currencies: JSON.stringify(currencies), sortOrder: existing.length })
      .returning();
    return NextResponse.json({ campaign: toClientCampaign(row, []) }, { status: 201 });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
