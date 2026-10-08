import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { seasonProfiles } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { cleanName, parseProfileData } from "@/server/calendars/parse";
import { checkProfile } from "@/server/calendars/profiles";
import { toClientProfile } from "@/server/calendars/store";
import { calendarErrorResponse, readBody } from "@/server/calendars/respond";
import { errorResponse } from "@/i18n/server";

/** Creates a named season profile (schedule data only — articles choose it through their Season Profile field). */
export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return errorResponse("invalidBody", 400);
  try {
    const name = cleanName(body.name);
    if (!name) return errorResponse("profileNameRequired", 400);
    if (typeof body.calendarId !== "string") return errorResponse("profileCalendarPick", 400);
    const worldId = await requireWorldId();
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
