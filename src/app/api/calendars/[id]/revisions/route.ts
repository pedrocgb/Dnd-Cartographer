import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { definitionRevisions } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { restoreCalendarRevision } from "@/server/calendars/mutations";
import { calendarOf } from "@/server/calendars/store";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";

type RouteContext = { params: Promise<{ id: string }> };

/** The calendar's saved revisions, newest first (what and when — no snapshots). */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  if (!(await calendarOf(worldId, id))) return notFound("Calendar not found.");
  const rows = await db
    .select({ id: definitionRevisions.id, version: definitionRevisions.version, reason: definitionRevisions.reason, createdAt: definitionRevisions.createdAt })
    .from(definitionRevisions)
    .where(and(eq(definitionRevisions.worldId, worldId), eq(definitionRevisions.subjectType, "calendar"), eq(definitionRevisions.subjectId, id)))
    .orderBy(desc(definitionRevisions.createdAt))
    .limit(50);
  return NextResponse.json({ revisions: rows });
}

/** Restores `revisionId` (with `expectedVersion`) as a new version; the entries it had moved go back too. */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const row = await calendarOf(worldId, id);
  if (!row) return notFound("Calendar not found.");
  const body = await readBody(request);
  if (!body || typeof body.revisionId !== "string") return badRequest("Pick a revision to restore.");
  if (body.expectedVersion !== row.version) return NextResponse.json({ error: "This calendar was changed elsewhere. Reload it and try again.", stale: true }, { status: 409 });
  try {
    return NextResponse.json({ calendar: await restoreCalendarRevision(worldId, row, body.revisionId) });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
