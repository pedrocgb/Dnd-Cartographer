import { NextResponse } from "next/server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/server/db/client";
import { quests, sessions } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { checkArticles } from "@/server/calendars/entries";
import { cleanName, parseArticleLinks, safeJson } from "@/server/calendars/parse";
import { InvalidError } from "@/server/calendars/mutations";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";
import { parseAttendance, parseCoins, parseDays, parseLoot, parseNotes, parsePlayedOn, parseSessionNumber, parseXpOverrides, parseXpTotal } from "@/server/sessions/parse";
import { campaignOf, rosterOf, sessionOf, toClientSession } from "@/server/sessions/store";
import type { Currency } from "@/server/sessions/types";
import { parseQuestLog } from "@/server/quests/parse";
import { applyLogLine, changedLogLines, type LogChange } from "@/server/quests/logic";
import { questsOf, toClientQuest } from "@/server/quests/store";
import { parsePrep, readPrep } from "@/server/writer/parse";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const row = await sessionOf(worldId, id);
  if (!row) return notFound("Session not found.");
  return NextResponse.json({ session: toClientSession(row) });
}

/**
 * Edits a session (`expectedVersion` required). PCs (attendance, XP, loot
 * and coin recipients) must be in the campaign's party; coins must be the
 * campaign's; linked articles and linked loot items must exist. A changed
 * quest log also updates the quests it names (status, objectives done) in
 * the same transaction (status, objectives done, clues learned, clock ticks);
 * the response lists those quests.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const row = await sessionOf(worldId, id);
  if (!row) return notFound("Session not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  if (body.expectedVersion !== row.version) return NextResponse.json({ error: "This session was changed elsewhere. Reload it and try again.", stale: true }, { status: 409 });
  const campaign = await campaignOf(worldId, row.campaignId);
  if (!campaign) return notFound("Campaign not found.");

  try {
    const roster = new Set((await rosterOf(campaign.id)).map((m) => m.personId));
    const coinIds = new Set(safeJson<Currency[]>(campaign.currencies, []).map((c) => c.id));
    const patch: Partial<typeof sessions.$inferInsert> = { version: row.version + 1, updatedAt: new Date() };
    if ("number" in body) {
      const number = parseSessionNumber(body.number);
      const [clash] = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(and(eq(sessions.campaignId, campaign.id), eq(sessions.number, number), ne(sessions.id, id), isNull(sessions.deletedAt)));
      if (clash) throw new InvalidError(`Session ${number} already exists in this campaign.`);
      patch.number = number;
    }
    if ("title" in body) patch.title = cleanName(body.title, 120);
    if ("playedOn" in body) patch.playedOn = parsePlayedOn(body.playedOn);
    if ("startDay" in body || "endDay" in body) Object.assign(patch, parseDays("startDay" in body ? body.startDay : row.startDay, "endDay" in body ? body.endDay : row.endDay));
    if ("notes" in body) patch.notes = JSON.stringify(parseNotes(body.notes));
    if ("articleLinks" in body) {
      const links = parseArticleLinks(body.articleLinks);
      await checkArticles(worldId, links);
      patch.articleLinks = JSON.stringify(links);
    }
    if ("attendance" in body) patch.attendance = JSON.stringify(parseAttendance(body.attendance, roster));
    if ("xpTotal" in body) patch.xpTotal = parseXpTotal(body.xpTotal);
    if ("xpOverrides" in body) patch.xpOverrides = JSON.stringify(parseXpOverrides(body.xpOverrides, roster));
    if ("loot" in body) {
      const loot = parseLoot(body.loot, roster, coinIds);
      await checkArticles(worldId, loot.flatMap((l) => (l.articleId && l.template ? [{ template: l.template, articleId: l.articleId }] : [])));
      patch.loot = JSON.stringify(loot);
    }
    if ("prep" in body) {
      const prep = parsePrep(body.prep, readPrep(safeJson<unknown>(row.prep, {})));
      await checkArticles(worldId, prep.npcs);
      patch.prep = JSON.stringify(prep);
    }
    if ("coins" in body) patch.coins = JSON.stringify(parseCoins(body.coins, roster, coinIds));
    const campaignQuests = "questLog" in body ? await questsOf(campaign.id) : [];
    let changed: LogChange[] = [];
    if ("questLog" in body) {
      const log = parseQuestLog(body.questLog, new Set(campaignQuests.map((q) => q.id)));
      changed = changedLogLines(toClientSession(row).questLog, log);
      patch.questLog = JSON.stringify(log);
    }
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(sessions)
        .set(patch)
        .where(and(eq(sessions.id, id), eq(sessions.version, row.version)))
        .returning();
      if (!updated) return null;
      const touched = [];
      for (const change of changed) {
        const quest = toClientQuest(campaignQuests.find((q) => q.id === change.line.questId)!);
        const next = applyLogLine(quest, change, id);
        const [saved] = await tx
          .update(quests)
          .set({ status: next.status, objectives: JSON.stringify(next.objectives), clues: JSON.stringify(next.clues), clock: next.clock ? JSON.stringify(next.clock) : null, version: quest.version + 1, updatedAt: new Date() })
          .where(and(eq(quests.id, quest.id), eq(quests.version, quest.version)))
          .returning();
        if (!saved) throw new StaleQuest();
        touched.push(toClientQuest(saved));
      }
      return { session: toClientSession(updated), quests: touched };
    });
    if (!result) return NextResponse.json({ error: "This session was changed elsewhere. Reload it and try again.", stale: true }, { status: 409 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StaleQuest) return NextResponse.json({ error: "A quest in this session's log was changed elsewhere. Reload and try again.", stale: true }, { status: 409 });
    return calendarErrorResponse(error);
  }
}

/** A quest changed between reading it and applying the session's log (the whole save rolls back). */
class StaleQuest extends Error {}

/** Soft-deletes a session (its number becomes free again). */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  if (!(await sessionOf(worldId, id))) return notFound("Session not found.");
  await db.update(sessions).set({ deletedAt: new Date() }).where(eq(sessions.id, id));
  return NextResponse.json({ ok: true });
}
