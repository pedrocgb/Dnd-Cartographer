import { NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaignCharacters, campaigns, sessions, quests, fronts, outlineNodes, plotThreads, threadBeats, campaignStatusLog } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { cleanName } from "@/server/calendars/parse";
import { checkCalendarIds } from "@/server/calendars/store";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";
import { parseCurrencies } from "@/server/sessions/parse";
import { campaignOf, rosterOf, sessionsOf, sessionsUsingCurrency, toClientCampaign } from "@/server/sessions/store";
import type { Currency } from "@/server/sessions/types";
import { safeJson } from "@/server/calendars/parse";
import { parseSetup, readSetup } from "@/server/writer/parse";

type RouteContext = { params: Promise<{ id: string }> };

/** Edits name, description, calendar, coins, status, archived or the writer setup (merged). A coin still used by a session can't be removed. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const row = await campaignOf(worldId, id);
  if (!row) return notFound("Campaign not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  try {
    const patch: Partial<typeof campaigns.$inferInsert> = { updatedAt: new Date() };
    if ("name" in body) {
      const name = cleanName(body.name);
      if (!name) return badRequest("A campaign name is required.");
      patch.name = name;
    }
    if ("description" in body) patch.description = cleanName(body.description, 4000);
    if ("calendarId" in body) {
      if (typeof body.calendarId !== "string" || !body.calendarId) return badRequest("Pick the calendar this campaign's dates are read in.");
      await checkCalendarIds(worldId, [body.calendarId]);
      patch.calendarId = body.calendarId;
    }
    if ("currencies" in body) {
      const next = parseCurrencies(body.currencies);
      const removed = new Set(safeJson<Currency[]>(row.currencies, []).map((c) => c.id).filter((cid) => !next.some((c) => c.id === cid)));
      if (removed.size) {
        const users = sessionsUsingCurrency(await sessionsOf(id), removed);
        if (users.length) return NextResponse.json({ error: `A removed coin is still used in session ${users.map((s) => s.number).join(", ")}. Remove it there first.` }, { status: 409 });
      }
      patch.currencies = JSON.stringify(next);
    }
    if ("status" in body) {
      if (body.status !== "active" && body.status !== "finished") return badRequest("Status must be active or finished.");
      patch.status = body.status;
    }
    if ("setup" in body) patch.setup = JSON.stringify(parseSetup(body.setup, readSetup(safeJson<unknown>(row.setup, {}))));
    if ("archived" in body) patch.archivedAt = body.archived === true ? new Date() : null;
    const [updated] = await db.update(campaigns).set(patch).where(eq(campaigns.id, id)).returning();
    return NextResponse.json({ campaign: toClientCampaign(updated, await rosterOf(id)) });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}

/** Deletes a campaign with no sessions, quests or fronts left (deleted ones and the roster go with it); otherwise archive it. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  if (!(await campaignOf(worldId, id))) return notFound("Campaign not found.");
  const live = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.campaignId, id), isNull(sessions.deletedAt)));
  if (live.length) return NextResponse.json({ error: `It still has ${live.length} session${live.length === 1 ? "" : "s"}. Delete them first, or archive the campaign instead.` }, { status: 409 });
  const liveQuests = await db.select({ id: quests.id }).from(quests).where(and(eq(quests.campaignId, id), isNull(quests.deletedAt)));
  if (liveQuests.length) return NextResponse.json({ error: `It still has ${liveQuests.length} quest${liveQuests.length === 1 ? "" : "s"}. Delete them first, or archive the campaign instead.` }, { status: 409 });
  const liveFronts = await db.select({ id: fronts.id }).from(fronts).where(and(eq(fronts.campaignId, id), isNull(fronts.deletedAt)));
  if (liveFronts.length) return NextResponse.json({ error: `It still has ${liveFronts.length} front${liveFronts.length === 1 ? "" : "s"}. Delete them first, or archive the campaign instead.` }, { status: 409 });
  const liveOutline = await db.select({ id: outlineNodes.id }).from(outlineNodes).where(and(eq(outlineNodes.campaignId, id), isNull(outlineNodes.deletedAt)));
  if (liveOutline.length) return NextResponse.json({ error: `Its story outline still has ${liveOutline.length} item${liveOutline.length === 1 ? "" : "s"}. Delete them in the Writer first, or archive the campaign instead.` }, { status: 409 });
  const threadIds = (await db.select({ id: plotThreads.id }).from(plotThreads).where(eq(plotThreads.campaignId, id))).map((t) => t.id);
  await db.transaction(async (tx) => {
    if (threadIds.length) await tx.delete(threadBeats).where(inArray(threadBeats.threadId, threadIds));
    await tx.delete(plotThreads).where(eq(plotThreads.campaignId, id));
    await tx.delete(outlineNodes).where(eq(outlineNodes.campaignId, id));
    await tx.delete(campaignStatusLog).where(eq(campaignStatusLog.campaignId, id));
    await tx.delete(quests).where(eq(quests.campaignId, id));
    await tx.delete(fronts).where(eq(fronts.campaignId, id));
    await tx.delete(sessions).where(eq(sessions.campaignId, id));
    await tx.delete(campaignCharacters).where(eq(campaignCharacters.campaignId, id));
    await tx.delete(campaigns).where(eq(campaigns.id, id));
  });
  return NextResponse.json({ ok: true });
}
