import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { quests } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";
import { questFields } from "@/server/quests/fields";
import { questContextOf, questOf, toClientQuest } from "@/server/quests/store";
import { campaignOf } from "@/server/sessions/store";

type RouteContext = { params: Promise<{ id: string }> };

const stale = () => NextResponse.json({ error: "This quest was changed elsewhere. Reload it and try again.", stale: true }, { status: 409 });

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const row = await questOf(await requireWorldId(), id);
  if (!row) return notFound("Quest not found.");
  return NextResponse.json({ quest: toClientQuest(row) });
}

/** Edits a quest (`expectedVersion` required); a board move is just `{ status, sortOrder }`. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const row = await questOf(worldId, id);
  if (!row) return notFound("Quest not found.");
  const campaign = await campaignOf(worldId, row.campaignId);
  if (!campaign) return notFound("Campaign not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  if (body.expectedVersion !== row.version) return stale();
  try {
    const fields = await questFields(body, await questContextOf(campaign), id);
    const [updated] = await db
      .update(quests)
      .set({ ...fields, version: row.version + 1, updatedAt: new Date() })
      .where(and(eq(quests.id, id), eq(quests.version, row.version)))
      .returning();
    return updated ? NextResponse.json({ quest: toClientQuest(updated) }) : stale();
  } catch (error) {
    return calendarErrorResponse(error);
  }
}

/** Soft-deletes a quest; its sub-quests move up to its parent. Sessions keep their log lines (shown as a removed quest). */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const row = await questOf(await requireWorldId(), id);
  if (!row) return notFound("Quest not found.");
  await db.transaction(async (tx) => {
    await tx
      .update(quests)
      .set({ parentId: row.parentId, updatedAt: new Date() })
      .where(and(eq(quests.parentId, id), isNull(quests.deletedAt)));
    await tx.update(quests).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(quests.id, id));
  });
  return NextResponse.json({ ok: true });
}
