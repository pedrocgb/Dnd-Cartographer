import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { calendarWeather } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { errorResponse } from "@/i18n/server";

/** Detaches a weather day from the calendar, for good (the generator's history keeps its own copy). */
export async function DELETE(_request: Request, { params }: RouteContext<"/api/calendar-weather/[id]">) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const deleted = await db
    .delete(calendarWeather)
    .where(and(eq(calendarWeather.id, id), eq(calendarWeather.worldId, worldId)))
    .returning({ id: calendarWeather.id });
  if (!deleted.length) return errorResponse("weatherNotFound", 404);
  return NextResponse.json({ ok: true });
}
