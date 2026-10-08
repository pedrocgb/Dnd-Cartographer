import { NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { calendars, celestialObjects } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { calendarOf, toClientCalendar } from "@/server/calendars/store";
import { errorResponse, serverT } from "@/i18n/server";

type RouteContext = { params: Promise<{ id: string }> };

/** A copy with the same definition and synchronization; celestial objects shown in the original are shown in the copy too (shared, not copied). */
export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const row = await calendarOf(worldId, id);
  if (!row) return errorResponse("calendarNotFound", 404);
  const count = (await db.select({ id: calendars.id }).from(calendars).where(eq(calendars.worldId, worldId))).length;
  const [copy] = await db
    .insert(calendars)
    .values({ worldId, name: (await serverT("calendars"))("copyName", { name: row.name }).slice(0, 80), description: row.description, definition: row.definition, articleLinks: row.articleLinks, sortOrder: count })
    .returning();
  const bound = await db
    .select({ id: celestialObjects.id, calendarIds: celestialObjects.calendarIds, version: celestialObjects.version })
    .from(celestialObjects)
    .where(and(eq(celestialObjects.worldId, worldId), isNotNull(celestialObjects.calendarIds)));
  for (const o of bound) {
    const ids = JSON.parse(o.calendarIds ?? "[]") as string[];
    if (ids.includes(id)) await db.update(celestialObjects).set({ calendarIds: JSON.stringify([...ids, copy.id]), version: o.version + 1, updatedAt: new Date() }).where(eq(celestialObjects.id, o.id));
  }
  return NextResponse.json({ calendar: toClientCalendar(copy) }, { status: 201 });
}
