import { NextResponse } from "next/server";
import { errorResponse, serverT } from "@/i18n/server";
import { db } from "@/server/db/client";
import { outlineNodes } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { calendarErrorResponse, readBody } from "@/server/calendars/respond";
import { campaignOf } from "@/server/sessions/store";
import { canNest, nestError } from "@/server/writer/logic";
import { nodeFields } from "@/server/writer/fields";
import { parseNodeKind, parseOptionalId } from "@/server/writer/parse";
import { nodesOf, toClientNode, writerContextOf, writerStateOf } from "@/server/writer/store";

type RouteContext = { params: Promise<{ id: string }> };

/** The campaign's story outline, threads and where they show up. */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!(await campaignOf(await requireWorldId(), id))) return errorResponse("campaignNotFound", 404);
  return NextResponse.json(await writerStateOf(id));
}

/** Adds an arc (no parent), a chapter (in an arc) or a scene (in a chapter), last among its siblings. Its text is created on first open. */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  if (!(await campaignOf(worldId, id))) return errorResponse("campaignNotFound", 404);
  const body = await readBody(request);
  if (!body) return errorResponse("invalidBody", 400);
  if (!("title" in body)) return errorResponse("nodeTitleRequired", 400);
  try {
    const kind = parseNodeKind(body.kind);
    const parentId = parseOptionalId(body.parentId, "The parent");
    const nodes = await nodesOf(id);
    const parent = parentId === null ? null : nodes.find((n) => n.id === parentId);
    if (parent === undefined) return errorResponse("outlinePlaceMissing", 400);
    if (!canNest(parent?.kind ?? null, kind)) return NextResponse.json({ error: nestError(kind, await serverT("writer")) }, { status: 400 });
    const fields = nodeFields(body, await writerContextOf(id));
    const sortOrder = fields.sortOrder ?? nodes.filter((n) => n.parentId === parentId).reduce((max, n) => Math.max(max, n.sortOrder + 1), 0);
    const [row] = await db
      .insert(outlineNodes)
      .values({ ...fields, title: fields.title!, kind, parentId, sortOrder, worldId, campaignId: id })
      .returning();
    return NextResponse.json({ node: toClientNode(row) }, { status: 201 });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
