import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { threadBeats } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { calendarErrorResponse, readBody } from "@/server/calendars/respond";
import { parseBeatNote, parseBeatRole } from "@/server/writer/parse";
import { nodeOf, threadOf, toClientBeat } from "@/server/writer/store";

type RouteContext = { params: Promise<{ threadId: string; nodeId: string }> };

/** Marks where a thread shows up in an outline item: `{ role, note? }` (one beat per thread and item). */
export async function PUT(request: Request, { params }: RouteContext) {
  const { threadId, nodeId } = await params;
  const worldId = await requireWorldId();
  const [thread, node] = await Promise.all([threadOf(worldId, threadId), nodeOf(worldId, nodeId)]);
  if (!thread || !node) return errorResponse("threadOrNodeNotFound", 404);
  if (thread.campaignId !== node.campaignId) return errorResponse("threadNodeCampaigns", 400);
  const body = await readBody(request);
  if (!body) return errorResponse("invalidBody", 400);
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
  const thread = await threadOf(await requireWorldId(), threadId);
  if (!thread) return errorResponse("threadNotFound", 404);
  await db.delete(threadBeats).where(and(eq(threadBeats.threadId, threadId), eq(threadBeats.nodeId, nodeId)));
  return NextResponse.json({ ok: true });
}
