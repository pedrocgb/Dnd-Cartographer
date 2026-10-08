import { NextResponse } from "next/server";
import { requireWorldId } from "@/server/world/active-world";
import { calendarOf, chronologyOf, toClientCalendar, updateChronology } from "@/server/calendars/store";
import { calendarErrorResponse, readBody } from "@/server/calendars/respond";
import { errorResponse } from "@/i18n/server";

/** Supported shared-day range (physical days from the epoch). */
const MAX_DAY = 100_000_000;

const toClient = (row: { currentDay: number; defaultCalendarId: string | null; revision: number }) => ({
  currentDay: row.currentDay,
  defaultCalendarId: row.defaultCalendarId,
  revision: row.revision,
});

/** The chronology, plus the default calendar (name and definition) to read the current day in. */
export async function GET() {
  const worldId = await requireWorldId();
  const chronology = await chronologyOf(worldId);
  const calendar = chronology.defaultCalendarId ? await calendarOf(worldId, chronology.defaultCalendarId) : null;
  const client = calendar ? toClientCalendar(calendar) : null;
  return NextResponse.json({ chronology: toClient(chronology), calendar: client?.definition ? { id: client.id, name: client.name, definition: client.definition } : null });
}

/**
 * Changes the shared current day and/or the default calendar. Requires
 * `expectedRevision`; a stale one gets 409 with the latest chronology.
 * `currentDay` sets the day (Set as Current Date, undo); `advanceDays`
 * moves it by a signed number of physical days. Viewing never calls this.
 */
export async function PATCH(request: Request) {
  const body = await readBody(request);
  if (!body || !Number.isSafeInteger(body.expectedRevision)) return errorResponse("expectedRevisionRequired", 400);
  const worldId = await requireWorldId();
  const current = await chronologyOf(worldId);
  if (body.expectedRevision !== current.revision) {
    return errorResponse("worldDateStale", 409, { stale: true, chronology: toClient(current) });
  }

  const patch: { currentDay?: number; defaultCalendarId?: string | null } = {};
  if ("currentDay" in body) {
    if (!Number.isSafeInteger(body.currentDay)) return errorResponse("currentDayInvalid", 400);
    patch.currentDay = body.currentDay as number;
  }
  if ("advanceDays" in body) {
    const days = body.advanceDays as number;
    if (!Number.isSafeInteger(days) || days === 0 || Math.abs(days) > 1_000_000) return errorResponse("advanceInvalid", 400, undefined, { max: 1_000_000 });
    patch.currentDay = current.currentDay + days;
  }
  if (patch.currentDay !== undefined && Math.abs(patch.currentDay) > MAX_DAY) return errorResponse("dateOutOfRange", 400);
  if ("defaultCalendarId" in body) {
    const calendar = typeof body.defaultCalendarId === "string" ? await calendarOf(worldId, body.defaultCalendarId) : null;
    if (!calendar) return errorResponse("defaultCalendarPick", 400);
    patch.defaultCalendarId = calendar.id;
  }
  if (Object.keys(patch).length === 0) return errorResponse("nothingToChange", 400);

  try {
    const row = await updateChronology(worldId, current.revision, patch);
    return NextResponse.json({ chronology: toClient(row), previousDay: current.currentDay });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
