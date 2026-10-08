import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaignStatusLog } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { checkArticles } from "@/server/calendars/entries";
import { calendarErrorResponse, readBody } from "@/server/calendars/respond";
import { parseStatusKind, parseStatusText, parseSubject } from "@/server/writer/parse";
import { toClientEntry } from "@/server/writer/store";

type RouteContext = { params: Promise<{ entryId: string }> };

async function entryOf(worldId: string, entryId: string) {
  const [row] = await db.select().from(campaignStatusLog).where(and(eq(campaignStatusLog.id, entryId), eq(campaignStatusLog.worldId, worldId)));
  return row ?? null;
}

/** Edits a change's text, type or subject. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { entryId } = await params;
  const worldId = await requireWorldId();
  const row = await entryOf(worldId, entryId);
  if (!row) return errorResponse("statusChangeNotFound", 404);
  const body = await readBody(request);
  if (!body) return errorResponse("invalidBody", 400);
  try {
    const patch: Partial<typeof campaignStatusLog.$inferInsert> = { updatedAt: new Date() };
    if ("text" in body) patch.text = parseStatusText(body.text);
    if ("kind" in body) patch.kind = parseStatusKind(body.kind);
    if ("subject" in body) {
      const subject = parseSubject(body.subject);
      if (subject) await checkArticles(worldId, [subject]);
      patch.subject = subject ? JSON.stringify(subject) : null;
    }
    const [updated] = await db.update(campaignStatusLog).set(patch).where(eq(campaignStatusLog.id, entryId)).returning();
    return NextResponse.json({ entry: toClientEntry(updated) });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { entryId } = await params;
  if (!(await entryOf(await requireWorldId(), entryId))) return errorResponse("statusChangeNotFound", 404);
  await db.delete(campaignStatusLog).where(eq(campaignStatusLog.id, entryId));
  return NextResponse.json({ ok: true });
}
