import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { outlineNodes } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";
import { descendantIds } from "@/server/writer/logic";
import { nodeFields } from "@/server/writer/fields";
import { nodeOf, nodesOf, toClientNode, writerContextOf } from "@/server/writer/store";

type RouteContext = { params: Promise<{ nodeId: string }> };

const stale = () => NextResponse.json({ error: "This was changed elsewhere. Reload it and try again.", stale: true }, { status: 409 });

/** Edits an outline item (`expectedVersion` required). */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { nodeId } = await params;
  const row = await nodeOf(await requireWorldId(), nodeId);
  if (!row) return notFound("Outline item not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  if (body.expectedVersion !== row.version) return stale();
  try {
    const fields = nodeFields(body, await writerContextOf(row.campaignId));
    const [updated] = await db
      .update(outlineNodes)
      .set({ ...fields, version: row.version + 1, updatedAt: new Date() })
      .where(and(eq(outlineNodes.id, nodeId), eq(outlineNodes.version, row.version)))
      .returning();
    return updated ? NextResponse.json({ node: toClientNode(updated) }) : stale();
  } catch (error) {
    return calendarErrorResponse(error);
  }
}

/** Soft-deletes an outline item with everything inside it. Returns the ids removed. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { nodeId } = await params;
  const row = await nodeOf(await requireWorldId(), nodeId);
  if (!row) return notFound("Outline item not found.");
  const ids = [nodeId, ...descendantIds(await nodesOf(row.campaignId), nodeId)];
  await db.update(outlineNodes).set({ deletedAt: new Date(), updatedAt: new Date() }).where(inArray(outlineNodes.id, ids));
  return NextResponse.json({ removed: ids });
}
