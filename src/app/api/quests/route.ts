import { NextResponse } from "next/server";
import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaigns, quests } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { badRequest } from "@/server/calendars/respond";
import { questsForArticle } from "@/server/quests/store";
import type { BriefQuest } from "@/server/quests/types";

/** Widest in-world window one request may ask for, like sessions and calendar entries. */
const MAX_WINDOW = 50_000;
const MAX_RANGE_ROWS = 2000;

/** Campaign names of the live (not archived) campaigns among these ids. */
async function liveCampaigns(ids: string[]) {
  const rows = ids.length ? await db.select({ id: campaigns.id, name: campaigns.name, archivedAt: campaigns.archivedAt }).from(campaigns).where(inArray(campaigns.id, ids)) : [];
  return new Map(rows.filter((c) => c.archivedAt === null).map((c) => [c.id, c.name]));
}

/**
 * `articleId`: live quests (of live campaigns) that involve the article or
 * were given by it, for its "In quests" card. `from`/`to`: quests starting,
 * due or ending in that in-world range, for the calendar.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const worldId = await ensureDefaultWorld();
  const articleId = url.searchParams.get("articleId")?.slice(0, 64);
  if (articleId) {
    const rows = await questsForArticle(worldId, articleId);
    const live = await liveCampaigns([...new Set(rows.map((r) => r.campaignId))]);
    return NextResponse.json({
      quests: rows
        .filter((r) => live.has(r.campaignId))
        .map((r) => ({ id: r.id, campaignId: r.campaignId, campaignName: live.get(r.campaignId)!, title: r.title, status: r.status, kind: r.kind })),
    });
  }
  const from = Number(url.searchParams.get("from"));
  const to = Number(url.searchParams.get("to"));
  if (!url.searchParams.has("from") || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || to < from) return badRequest("Pass an articleId, or a from/to day range.");
  if (to - from > MAX_WINDOW) return badRequest(`Ask for at most ${MAX_WINDOW} days at once.`);
  const inRange = (col: typeof quests.startDay | typeof quests.deadlineDay | typeof quests.endDay) => and(gte(col, from), lte(col, to));
  const rows = await db
    .select()
    .from(quests)
    .where(and(eq(quests.worldId, worldId), isNull(quests.deletedAt), or(inRange(quests.startDay), inRange(quests.deadlineDay), inRange(quests.endDay))))
    .limit(MAX_RANGE_ROWS);
  const live = await liveCampaigns([...new Set(rows.map((r) => r.campaignId))]);
  const out: BriefQuest[] = rows
    .filter((r) => live.has(r.campaignId))
    .map((r) => ({ id: r.id, campaignId: r.campaignId, campaignName: live.get(r.campaignId)!, title: r.title, status: r.status, kind: r.kind, startDay: r.startDay, deadlineDay: r.deadlineDay, endDay: r.endDay }));
  return NextResponse.json({ quests: out });
}
