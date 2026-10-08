import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { db } from "@/server/db/client";
import { campaignStatusLog } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { checkArticles } from "@/server/calendars/entries";
import { calendarErrorResponse, readBody } from "@/server/calendars/respond";
import { campaignOf, sessionOf } from "@/server/sessions/store";
import { parseOptionalId, parseStatusKind, parseStatusText, parseSubject } from "@/server/writer/parse";
import { statusLogOf, toClientEntry } from "@/server/writer/store";

type RouteContext = { params: Promise<{ id: string }> };

/** The campaign status log: what changed in the world, newest first. */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!(await campaignOf(await requireWorldId(), id))) return errorResponse("campaignNotFound", 404);
  return NextResponse.json({ entries: (await statusLogOf(id)).map(toClientEntry) });
}

/** Records a change: `{ text, kind?, subject?, sessionId? }` (dated on the session's last in-world day). */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  if (!(await campaignOf(worldId, id))) return errorResponse("campaignNotFound", 404);
  const body = await readBody(request);
  if (!body) return errorResponse("invalidBody", 400);
  try {
    const text = parseStatusText(body.text);
    const subject = parseSubject(body.subject);
    if (subject) await checkArticles(worldId, [subject]);
    const sessionId = parseOptionalId(body.sessionId, "The session");
    const session = sessionId ? await sessionOf(worldId, sessionId) : null;
    if (sessionId && (!session || session.campaignId !== id)) return errorResponse("sessionNotInCampaign", 400);
    const [row] = await db
      .insert(campaignStatusLog)
      .values({ worldId, campaignId: id, text, kind: parseStatusKind(body.kind), subject: subject ? JSON.stringify(subject) : null, sessionId, worldDay: session?.endDay ?? session?.startDay ?? null })
      .returning();
    return NextResponse.json({ entry: toClientEntry(row) }, { status: 201 });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
