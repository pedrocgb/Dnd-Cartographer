import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { calendarEntries } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { duplicateLink, linkedNames, parseEntryFields, type EntryKind } from "@/server/calendars/entries";
import { parseException, safeJson } from "@/server/calendars/parse";
import { toClientEntry } from "@/server/calendars/store";
import type { OccurrenceException } from "@/server/calendars/recurrence";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";

type RouteContext = { params: Promise<{ id: string }> };

async function entryOf(worldId: string, id: string) {
  const [row] = await db.select().from(calendarEntries).where(and(eq(calendarEntries.id, id), eq(calendarEntries.worldId, worldId), isNull(calendarEntries.deletedAt)));
  return row ?? null;
}

/**
 * Entire Series: patch the entry's own fields (its occurrence exceptions
 * are kept). This Occurrence: `{ occurrence: <original start day>,
 * exception: { cancelled | moveTo | title | description } }`, or
 * `exception: null` to restore that occurrence.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await ensureDefaultWorld();
  const row = await entryOf(worldId, id);
  if (!row) return notFound("Entry not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");

  try {
    const patch: Partial<typeof calendarEntries.$inferInsert> = { updatedAt: new Date() };
    if ("occurrence" in body) {
      if (!Number.isSafeInteger(body.occurrence)) return badRequest("Pick the occurrence to change.");
      const exceptions = safeJson<Record<string, OccurrenceException>>(row.exceptions, {});
      const key = String(body.occurrence);
      if (body.exception === null) delete exceptions[key];
      else exceptions[key] = parseException(body.exception);
      if (Object.keys(exceptions).length > 2000) return badRequest("This series has too many changed occurrences; edit the series instead.");
      patch.exceptions = JSON.stringify(exceptions);
    } else {
      Object.assign(patch, await parseEntryFields(worldId, row.kind as EntryKind, body));
      if (row.kind === "event" && patch.title === "") return badRequest("An event needs a title.");
      const worldDay = patch.worldDay ?? row.worldDay;
      const articleId = patch.articleId ?? row.articleId;
      if (row.kind === "link" && articleId && (await duplicateLink(worldId, worldDay, articleId, id))) {
        return NextResponse.json({ error: "That article is already linked to this day." }, { status: 409 });
      }
    }
    const [updated] = await db.update(calendarEntries).set(patch).where(eq(calendarEntries.id, id)).returning();
    const entry = toClientEntry(updated);
    return NextResponse.json({ entry, articleNames: await linkedNames([entry]) });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}

/** Removes the whole entry (a series with all its occurrences). Kept as a soft delete. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await ensureDefaultWorld();
  if (!(await entryOf(worldId, id))) return notFound("Entry not found.");
  await db.update(calendarEntries).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(calendarEntries.id, id));
  return NextResponse.json({ ok: true });
}
