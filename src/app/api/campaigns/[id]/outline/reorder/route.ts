import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { outlineNodes } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";
import { campaignOf } from "@/server/sessions/store";
import { checkMoves } from "@/server/writer/logic";
import { parseMoves } from "@/server/writer/parse";
import { nodesOf, toClientNode } from "@/server/writer/store";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Moves outline items: `{ moves: [{ id, parentId, sortOrder }] }`, all or
 * nothing. A move only changes where an item sits, so it doesn't bump its
 * version (an open editor keeps saving). Returns the whole outline.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!(await campaignOf(await requireWorldId(), id))) return notFound("Campaign not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  try {
    const moves = parseMoves(body.moves);
    const nodes = await nodesOf(id);
    const problem = checkMoves(nodes, moves);
    if (problem) return badRequest(problem);
    await db.transaction(async (tx) => {
      for (const m of moves) {
        await tx.update(outlineNodes).set({ parentId: m.parentId, sortOrder: m.sortOrder, updatedAt: new Date() }).where(and(eq(outlineNodes.id, m.id), eq(outlineNodes.campaignId, id)));
      }
    });
    return NextResponse.json({ nodes: (await nodesOf(id)).map(toClientNode) });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
