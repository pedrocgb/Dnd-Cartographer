import { NextResponse } from "next/server";
import { and, desc, eq, isNull, like, or } from "drizzle-orm";
import { db } from "@/server/db/client";
import { calendarEntries } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { createEmptyDocument } from "@/server/documents/create";
import { ENTRY_KINDS, duplicateLink, linkedNames, parseEntryFields, type EntryKind } from "@/server/calendars/entries";
import { entriesForArticle, entriesInRange, toClientEntry } from "@/server/calendars/store";
import { badRequest, calendarErrorResponse, readBody } from "@/server/calendars/respond";

/** Widest record window one request may ask for (occurrences are expanded client-side for the viewed range only). */
const MAX_WINDOW = 50_000;

/**
 * Entries by `from`/`to` (inclusive worldDays: one-time entries overlapping
 * the range plus the series that may occur in it), by `articleId`
 * (backlinks), or by `q` (search, newest 100). Each response carries the
 * names of the linked articles; deleted ones are absent.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const worldId = await requireWorldId();
  let entries;
  const articleId = url.searchParams.get("articleId");
  const q = url.searchParams.get("q")?.trim();
  if (articleId) entries = await entriesForArticle(worldId, articleId);
  else if (q) {
    const pattern = `%${q.replace(/[%_]/g, "").slice(0, 80)}%`;
    const rows = await db
      .select()
      .from(calendarEntries)
      .where(
        and(
          eq(calendarEntries.worldId, worldId),
          isNull(calendarEntries.deletedAt),
          or(like(calendarEntries.title, pattern), like(calendarEntries.description, pattern), like(calendarEntries.category, pattern))
        )
      )
      .orderBy(desc(calendarEntries.worldDay))
      .limit(100);
    entries = rows.map(toClientEntry);
  } else {
    const from = Number(url.searchParams.get("from"));
    const to = Number(url.searchParams.get("to"));
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || to < from) return badRequest("Pass a from/to day range.");
    if (to - from > MAX_WINDOW) return badRequest(`Ask for at most ${MAX_WINDOW} days at once.`);
    entries = await entriesInRange(worldId, from, to);
  }
  return NextResponse.json({ entries, articleNames: await linkedNames(worldId, entries) });
}

/**
 * Creates a note (with its own rich document), an event, or a direct
 * article link on `worldDay`. The same article can't be linked twice to
 * the same day.
 */
export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  const kind = body.kind as EntryKind;
  if (!ENTRY_KINDS.includes(kind)) return badRequest("Pick what to add: a note, an event or an article link.");
  if (!("worldDay" in body)) return badRequest("Pick a date.");
  try {
    const worldId = await requireWorldId();
    const fields = await parseEntryFields(worldId, kind, body);
    if (kind === "link" && !fields.articleId) return badRequest("Pick the article to link.");
    if (kind === "event" && !fields.title) return badRequest("An event needs a title.");
    if (kind === "link" && (await duplicateLink(worldId, fields.worldDay!, fields.articleId!))) {
      return NextResponse.json({ error: "That article is already linked to this day." }, { status: 409 });
    }
    const documentId = kind === "note" ? (await createEmptyDocument(worldId)).id : null;
    const [row] = await db
      .insert(calendarEntries)
      .values({ worldId, kind, worldDay: fields.worldDay!, ...fields, documentId })
      .returning();
    const entry = toClientEntry(row);
    return NextResponse.json({ entry, articleNames: await linkedNames(worldId, [entry]) }, { status: 201 });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
