import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { campaignStatusLog } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { checkArticles } from "@/server/calendars/entries";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";
import { campaignOf, sessionOf } from "@/server/sessions/store";
import { parseOptionalId, parseStatusKind, parseStatusText, parseSubject } from "@/server/writer/parse";
import { statusLogOf, toClientEntry } from "@/server/writer/store";

type RouteContext = { params: Promise<{ id: string }> };

/** The campaign status log: what changed in the world, newest first. */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!(await campaignOf(await requireWorldId(), id))) return notFound("Campaign not found.");
  return NextResponse.json({ entries: (await statusLogOf(id)).map(toClientEntry) });
}

/** Records a change: `{ text, kind?, subject?, sessionId? }` (dated on the session's last in-world day). */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  if (!(await campaignOf(worldId, id))) return notFound("Campaign not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  try {
    const text = parseStatusText(body.text);
    const subject = parseSubject(body.subject);
    if (subject) await checkArticles(worldId, [subject]);
    const sessionId = parseOptionalId(body.sessionId, "The session");
    const session = sessionId ? await sessionOf(worldId, sessionId) : null;
    if (sessionId && (!session || session.campaignId !== id)) return badRequest("That session isn't in this campaign.");
    const [row] = await db
      .insert(campaignStatusLog)
      .values({ worldId, campaignId: id, text, kind: parseStatusKind(body.kind), subject: subject ? JSON.stringify(subject) : null, sessionId, worldDay: session?.endDay ?? session?.startDay ?? null })
      .returning();
    return NextResponse.json({ entry: toClientEntry(row) }, { status: 201 });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
