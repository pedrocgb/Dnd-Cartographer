import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { db } from "@/server/db/client";
import { quests } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { createEmptyDocument } from "@/server/documents/create";
import { calendarErrorResponse, readBody } from "@/server/calendars/respond";
import { campaignOf } from "@/server/sessions/store";
import { questFields } from "@/server/quests/fields";
import { questContextOf, questsOf, toClientQuest } from "@/server/quests/store";

type RouteContext = { params: Promise<{ id: string }> };

/** The campaign's live quests (board order). */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  if (!(await campaignOf(worldId, id))) return errorResponse("campaignNotFound", 404);
  return NextResponse.json({ quests: (await questsOf(id)).map(toClientQuest) });
}

/** Creates a quest (a hook by default) at the end of its board column, with empty notes. */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const campaign = await campaignOf(worldId, id);
  if (!campaign) return errorResponse("campaignNotFound", 404);
  const body = await readBody(request);
  if (!body) return errorResponse("invalidBody", 400);
  if (!("title" in body)) return errorResponse("questTitleRequired", 400);
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
