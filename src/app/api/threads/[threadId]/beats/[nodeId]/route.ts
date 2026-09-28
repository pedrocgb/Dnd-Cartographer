import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { threadBeats } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";
import { parseBeatNote, parseBeatRole } from "@/server/writer/parse";
import { nodeOf, threadOf, toClientBeat } from "@/server/writer/store";

type RouteContext = { params: Promise<{ threadId: string; nodeId: string }> };

/** Marks where a thread shows up in an outline item: `{ role, note? }` (one beat per thread and item). */
export async function PUT(request: Request, { params }: RouteContext) {
  const { threadId, nodeId } = await params;
  const worldId = await ensureDefaultWorld();
  const [thread, node] = await Promise.all([threadOf(worldId, threadId), nodeOf(worldId, nodeId)]);
  if (!thread || !node) return notFound("Thread or outline item not found.");
  if (thread.campaignId !== node.campaignId) return badRequest("The thread and the outline item are in different campaigns.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  try {
    const role = parseBeatRole(body.role);
    const note = "note" in body ? parseBeatNote(body.note) : undefined;
    const [row] = await db
      .insert(threadBeats)
      .values({ threadId, nodeId, role, note: note ?? "" })
      .onConflictDoUpdate({ target: [threadBeats.threadId, threadBeats.nodeId], set: { role, ...(note === undefined ? {} : { note }), updatedAt: new Date() } })
      .returning();
    return NextResponse.json({ beat: toClientBeat(row) });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { threadId, nodeId } = await params;
  const thread = await threadOf(await ensureDefaultWorld(), threadId);
  if (!thread) return notFound("Thread not found.");
  await db.delete(threadBeats).where(and(eq(threadBeats.threadId, threadId), eq(threadBeats.nodeId, nodeId)));
  return NextResponse.json({ ok: true });
}
