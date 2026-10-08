import { NextResponse } from "next/server";
import { errorResponse, serverT } from "@/i18n/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { outlineNodes } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { calendarErrorResponse, readBody } from "@/server/calendars/respond";
import { campaignOf } from "@/server/sessions/store";
import { templateChildren } from "@/server/writer/logic";
import { ident, parseOptionalId } from "@/server/writer/parse";
import { nodesOf, toClientNode } from "@/server/writer/store";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Lays a story structure out under a parent (`parentId` null: the campaign
 * itself, making arcs): one child per beat, after any existing children,
 * each titled after its beat with the beat's hint as synopsis. The parent
 * remembers the structure. Returns the whole outline.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  if (!(await campaignOf(worldId, id))) return errorResponse("campaignNotFound", 404);
  const body = await readBody(request);
  if (!body) return errorResponse("invalidBody", 400);
  try {
    const template = ident(body.template, "The story structure");
    const parentId = parseOptionalId(body.parentId, "The parent");
    const nodes = await nodesOf(id);
    const parent = parentId === null ? null : nodes.find((n) => n.id === parentId);
    if (parent === undefined) return errorResponse("outlinePlaceMissing", 400);
    const drafts = templateChildren(template, parent?.kind ?? null, await serverT("writer"));
    if (!drafts) return errorResponse(parent?.kind === "scene" ? "sceneCantHoldStructure" : "structureMissing", 400);
    const start = nodes.filter((n) => n.parentId === parentId).reduce((max, n) => Math.max(max, n.sortOrder + 1), 0);
    await db.transaction(async (tx) => {
      if (parent) await tx.update(outlineNodes).set({ beatTemplate: template, version: parent.version + 1, updatedAt: new Date() }).where(eq(outlineNodes.id, parent.id));
      await tx.insert(outlineNodes).values(drafts.map((d, i) => ({ ...d, worldId, campaignId: id, parentId, sortOrder: start + i })));
    });
    return NextResponse.json({ nodes: (await nodesOf(id)).map(toClientNode) });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
