import { and, asc, eq, isNull, like, or } from "drizzle-orm";
import { db } from "@/server/db/client";
import { fronts, quests } from "@/server/db/schema";
import { safeJson } from "@/server/calendars/parse";
import type { ArticleRef, Clock, Clue, FrontData, Objective, Portent, QuestData, QuestLink, QuestPriority, Rewards } from "./types";

export type QuestRow = typeof quests.$inferSelect;
export type FrontRow = typeof fronts.$inferSelect;

/** Backlink lookups are capped like the other article backlinks. */
const MAX_BACKLINKS = 200;

export const toClientQuest = (row: QuestRow): QuestData => ({
  id: row.id,
  campaignId: row.campaignId,
  parentId: row.parentId,
  title: row.title,
  kind: row.kind,
  status: row.status,
  priority: (row.priority === 0 || row.priority === 2 ? row.priority : 1) as QuestPriority,
  summary: row.summary,
  bodyDocumentId: row.bodyDocumentId,
  giver: safeJson<ArticleRef | null>(row.giver, null),
  articleLinks: safeJson<QuestLink[]>(row.articleLinks, []),
  objectives: safeJson<Objective[]>(row.objectives, []),
  frontId: row.frontId,
  clues: safeJson<Clue[]>(row.clues, []),
  clock: safeJson<Clock | null>(row.clock, null),
  rewards: safeJson<Rewards | null>(row.rewards, null),
  startDay: row.startDay,
  deadlineDay: row.deadlineDay,
  endDay: row.endDay,
  sortOrder: row.sortOrder,
  version: row.version,
});

export const toClientFront = (row: FrontRow): FrontData => ({
  id: row.id,
  campaignId: row.campaignId,
  name: row.name,
  kind: row.kind,
  status: row.status,
  threat: row.threat,
  doom: row.doom,
  portents: safeJson<Portent[]>(row.portents, []),
  clock: safeJson<Clock | null>(row.clock, null),
  clockPerPortent: row.clockPerPortent,
  color: row.color,
  sortOrder: row.sortOrder,
  version: row.version,
});

/** A live front of this world, or null. */
export async function frontOf(worldId: string, id: string): Promise<FrontRow | null> {
  const [row] = await db.select().from(fronts).where(and(eq(fronts.id, id), eq(fronts.worldId, worldId), isNull(fronts.deletedAt)));
  return row ?? null;
}

/** A campaign's live fronts, in order. */
export async function frontsOf(campaignId: string): Promise<FrontRow[]> {
  return db
    .select()
    .from(fronts)
    .where(and(eq(fronts.campaignId, campaignId), isNull(fronts.deletedAt)))
    .orderBy(asc(fronts.sortOrder), asc(fronts.name));
}

/** What a campaign's quest fields are checked against (see questFields). */
export async function questContextOf(campaign: { id: string; worldId: string; currencies: string }) {
  const [campaignQuests, campaignFronts] = await Promise.all([questsOf(campaign.id), frontsOf(campaign.id)]);
  return {
    worldId: campaign.worldId,
    campaignQuests,
    frontIds: new Set(campaignFronts.map((f) => f.id)),
    currencyIds: new Set(safeJson<{ id: string }[]>(campaign.currencies, []).map((c) => c.id)),
  };
}

/** A live quest of this world, or null. */
export async function questOf(worldId: string, id: string): Promise<QuestRow | null> {
  const [row] = await db.select().from(quests).where(and(eq(quests.id, id), eq(quests.worldId, worldId), isNull(quests.deletedAt)));
  return row ?? null;
}

/** A campaign's live quests, in board order. */
export async function questsOf(campaignId: string): Promise<QuestRow[]> {
  return db
    .select()
    .from(quests)
    .where(and(eq(quests.campaignId, campaignId), isNull(quests.deletedAt)))
    .orderBy(asc(quests.sortOrder), asc(quests.title));
}

/** Live quests that link this article (involved, giver, or where a clue is placed). */
export async function questsForArticle(worldId: string, articleId: string): Promise<QuestRow[]> {
  const pattern = `%"articleId":"${articleId.replace(/[%_"\\]/g, "")}"%`;
  const rows = await db
    .select()
    .from(quests)
    .where(and(eq(quests.worldId, worldId), isNull(quests.deletedAt), or(like(quests.articleLinks, pattern), like(quests.giver, pattern), like(quests.clues, pattern))))
    .limit(MAX_BACKLINKS);
  // LIKE narrows; the parsed JSON decides (ids are opaque, never a prefix match).
  return rows.filter((r) => {
    const q = toClientQuest(r);
    return q.giver?.articleId === articleId || q.articleLinks.some((l) => l.articleId === articleId) || q.clues.some((c) => c.placedIn.some((p) => p.articleId === articleId));
  });
}
