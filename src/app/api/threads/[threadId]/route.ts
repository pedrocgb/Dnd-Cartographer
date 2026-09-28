import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { plotThreads, threadBeats } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";
import { threadFields } from "@/server/writer/fields";
import { threadOf, toClientThread, writerContextOf } from "@/server/writer/store";

type RouteContext = { params: Promise<{ threadId: string }> };

const stale = () => NextResponse.json({ error: "This thread was changed elsewhere. Reload it and try again.", stale: true }, { status: 409 });

/** Edits a thread (`expectedVersion` required). */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { threadId } = await params;
  const row = await threadOf(await ensureDefaultWorld(), threadId);
  if (!row) return notFound("Thread not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
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
  const row = await threadOf(await ensureDefaultWorld(), threadId);
  if (!row) return notFound("Thread not found.");
  await db.transaction(async (tx) => {
    await tx.delete(threadBeats).where(eq(threadBeats.threadId, threadId));
    await tx.update(plotThreads).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(plotThreads.id, threadId));
  });
  return NextResponse.json({ ok: true });
}
