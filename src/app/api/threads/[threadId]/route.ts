import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { plotThreads, threadBeats } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { calendarErrorResponse, readBody } from "@/server/calendars/respond";
import { threadFields } from "@/server/writer/fields";
import { threadOf, toClientThread, writerContextOf } from "@/server/writer/store";

type RouteContext = { params: Promise<{ threadId: string }> };

const stale = () => errorResponse("threadStale", 409, { stale: true });

/** Edits a thread (`expectedVersion` required). */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { threadId } = await params;
  const row = await threadOf(await requireWorldId(), threadId);
  if (!row) return errorResponse("threadNotFound", 404);
  const body = await readBody(request);
  if (!body) return errorResponse("invalidBody", 400);
  if (body.expectedVersion !== row.version) return stale();
  try {
    const fields = threadFields(body, await writerContextOf(row.campaignId));
    const kind = fields.kind ?? row.kind;
    // Only MICE threads have a MICE type.
    const miceType = kind === "mice" ? (fields.miceType ?? row.miceType ?? "inquiry") : null;
    const [updated] = await db
      .update(plotThreads)
      .set({ ...fields, miceType, version: row.version + 1, updatedAt: new Date() })
      .where(and(eq(plotThreads.id, threadId), eq(plotThreads.version, row.version)))
      .returning();
    return updated ? NextResponse.json({ thread: toClientThread(updated) }) : stale();
  } catch (error) {
    return calendarErrorResponse(error);
  }
}

/** Deletes a thread and where it showed up (scenes are untouched). */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { threadId } = await params;
  const row = await threadOf(await requireWorldId(), threadId);
  if (!row) return errorResponse("threadNotFound", 404);
  await db.transaction(async (tx) => {
    await tx.delete(threadBeats).where(eq(threadBeats.threadId, threadId));
    await tx.update(plotThreads).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(plotThreads.id, threadId));
  });
  return NextResponse.json({ ok: true });
}
