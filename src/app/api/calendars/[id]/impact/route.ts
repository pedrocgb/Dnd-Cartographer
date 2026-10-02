import { NextResponse } from "next/server";
import { requireWorldId } from "@/server/world/active-world";
import { validateDefinition } from "@/server/calendars/engine";
import { parseDefinition } from "@/server/calendars/parse";
import { previewImpact } from "@/server/calendars/mutations";
import { calendarOf } from "@/server/calendars/store";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";

type RouteContext = { params: Promise<{ id: string }> };

/** What a proposed `definition` would change (labels, named-date shifts, broken references). Changes nothing. */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const row = await calendarOf(worldId, id);
  if (!row) return notFound("Calendar not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  try {
    const definition = parseDefinition(body.definition);
    const issues = validateDefinition(definition);
    if (issues.length) return NextResponse.json({ error: issues[0].message, issues }, { status: 400 });
    return NextResponse.json({ impact: await previewImpact(worldId, row, definition) });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
