import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { seasonProfiles } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { cleanName, parseProfileData } from "@/server/calendars/parse";
import { checkProfile } from "@/server/calendars/profiles";
import { toClientProfile } from "@/server/calendars/store";
import { badRequest, calendarErrorResponse, readBody } from "@/server/calendars/respond";

/** Creates a named season profile (schedule data only — articles choose it through their Season Profile field). */
export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  try {
    const name = cleanName(body.name);
    if (!name) return badRequest("A profile name is required.");
    if (typeof body.calendarId !== "string") return badRequest("Pick the calendar this profile's dates are read in.");
    const worldId = await ensureDefaultWorld();
    const data = { ...parseProfileData(body.data), calendarId: body.calendarId };
    await checkProfile(worldId, data);
    const { calendarId, ...rest } = data;
    const existing = await db.select({ id: seasonProfiles.id }).from(seasonProfiles).where(eq(seasonProfiles.worldId, worldId));
    const [row] = await db
      .insert(seasonProfiles)
      .values({ worldId, name, description: cleanName(body.description, 4000), calendarId, data: JSON.stringify(rest), isDefault: existing.length === 0 })
      .returning();
    return NextResponse.json({ profile: toClientProfile(row) }, { status: 201 });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
