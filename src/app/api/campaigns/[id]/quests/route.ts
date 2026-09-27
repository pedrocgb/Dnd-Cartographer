import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { quests } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { createEmptyDocument } from "@/server/documents/create";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";
import { campaignOf } from "@/server/sessions/store";
import { questFields } from "@/server/quests/fields";
import { questContextOf, questsOf, toClientQuest } from "@/server/quests/store";

type RouteContext = { params: Promise<{ id: string }> };

/** The campaign's live quests (board order). */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await ensureDefaultWorld();
  if (!(await campaignOf(worldId, id))) return notFound("Campaign not found.");
  return NextResponse.json({ quests: (await questsOf(id)).map(toClientQuest) });
}

/** Creates a quest (a hook by default) at the end of its board column, with empty notes. */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await ensureDefaultWorld();
  const campaign = await campaignOf(worldId, id);
  if (!campaign) return notFound("Campaign not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  if (!("title" in body)) return badRequest("A quest needs a title.");
  try {
    const context = await questContextOf(campaign);
    const existing = context.campaignQuests;
    const fields = await questFields(body, context, null);
    const status = fields.status ?? "hook";
    const sortOrder = fields.sortOrder ?? existing.filter((q) => q.status === status).reduce((max, q) => Math.max(max, q.sortOrder + 1), 0);
    const notes = await createEmptyDocument(worldId);
    const [row] = await db
      .insert(quests)
      .values({ ...fields, title: fields.title!, status, sortOrder, worldId, campaignId: id, bodyDocumentId: notes.id })
      .returning();
    return NextResponse.json({ quest: toClientQuest(row) }, { status: 201 });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
