import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaignStatusLog } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { checkArticles } from "@/server/calendars/entries";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";
import { parseStatusKind, parseStatusText, parseSubject } from "@/server/writer/parse";
import { toClientEntry } from "@/server/writer/store";

type RouteContext = { params: Promise<{ entryId: string }> };

async function entryOf(entryId: string) {
  const worldId = await ensureDefaultWorld();
  const [row] = await db.select().from(campaignStatusLog).where(and(eq(campaignStatusLog.id, entryId), eq(campaignStatusLog.worldId, worldId)));
  return row ?? null;
}

/** Edits a change's text, type or subject. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { entryId } = await params;
  const row = await entryOf(entryId);
  if (!row) return notFound("Change not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  try {
    const patch: Partial<typeof campaignStatusLog.$inferInsert> = { updatedAt: new Date() };
    if ("text" in body) patch.text = parseStatusText(body.text);
    if ("kind" in body) patch.kind = parseStatusKind(body.kind);
    if ("subject" in body) {
      const subject = parseSubject(body.subject);
      if (subject) await checkArticles([subject]);
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
  if (!(await entryOf(entryId))) return notFound("Change not found.");
  await db.delete(campaignStatusLog).where(eq(campaignStatusLog.id, entryId));
  return NextResponse.json({ ok: true });
}
