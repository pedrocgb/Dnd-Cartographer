import type { quests } from "@/server/db/schema";
import { checkArticles } from "@/server/calendars/entries";
import { InvalidError } from "@/server/calendars/mutations";
import { wouldCycle } from "./logic";
import { parseClock, parseClues, parseGiver, parseQuestDays, parseObjectives, parseQuestKind, parseQuestLinks, parseQuestPriority, parseQuestStatus, parseQuestSummary, parseQuestTitle, parseRewards, parseSortOrder } from "./parse";

/** What a quest's fields are checked against: its campaign's quests, fronts and coins. */
export interface QuestContext {
  worldId: string;
  campaignQuests: readonly { id: string; parentId: string | null }[];
  frontIds: ReadonlySet<string>;
  currencyIds: ReadonlySet<string>;
}

type QuestPatch = Partial<typeof quests.$inferInsert>;

/**
 * The quest fields present in a create/edit body, validated: a parent must be
 * another quest of the same campaign and never loop, a front must be the
 * campaign's, rewards use its coins; linked articles, the giver, clue places
 * and reward items must exist. `selfId` is null when creating.
 */
export async function questFields(body: Record<string, unknown>, { worldId, campaignQuests, frontIds, currencyIds }: QuestContext, selfId: string | null): Promise<QuestPatch> {
  const patch: QuestPatch = {};
  if ("title" in body) patch.title = parseQuestTitle(body.title);
  if ("summary" in body) patch.summary = parseQuestSummary(body.summary);
  if ("kind" in body) patch.kind = parseQuestKind(body.kind);
  if ("status" in body) patch.status = parseQuestStatus(body.status);
  if ("priority" in body) patch.priority = parseQuestPriority(body.priority);
  if ("sortOrder" in body) patch.sortOrder = parseSortOrder(body.sortOrder);
  Object.assign(patch, parseQuestDays(body));
  if ("objectives" in body) patch.objectives = JSON.stringify(parseObjectives(body.objectives));
  if ("parentId" in body) {
    const parentId = body.parentId === null || body.parentId === "" ? null : String(body.parentId);
    if (parentId !== null && !campaignQuests.some((q) => q.id === parentId)) throw new InvalidError("The parent quest isn't in this campaign.");
    if (parentId !== null && selfId !== null && wouldCycle(campaignQuests, selfId, parentId)) throw new InvalidError("A quest can't sit under itself or one of its own sub-quests.");
    patch.parentId = parentId;
  }
  if ("frontId" in body) {
    const frontId = body.frontId === null || body.frontId === "" ? null : String(body.frontId);
    if (frontId !== null && !frontIds.has(frontId)) throw new InvalidError("That front isn't in this campaign.");
    patch.frontId = frontId;
  }
  if ("clock" in body) {
    const clock = parseClock(body.clock);
    patch.clock = clock ? JSON.stringify(clock) : null;
  }
  const refs: { template: string; articleId: string }[] = [];
  if ("clues" in body) {
    const clues = parseClues(body.clues);
    refs.push(...clues.flatMap((c) => c.placedIn));
    patch.clues = JSON.stringify(clues);
  }
  if ("rewards" in body) {
    const rewards = parseRewards(body.rewards, currencyIds);
    refs.push(...(rewards?.items.flatMap((it) => (it.template && it.articleId ? [{ template: it.template, articleId: it.articleId }] : [])) ?? []));
    patch.rewards = rewards ? JSON.stringify(rewards) : null;
  }
  if ("giver" in body) {
    const giver = parseGiver(body.giver);
    if (giver) refs.push(giver);
    patch.giver = giver ? JSON.stringify(giver) : null;
  }
  if ("articleLinks" in body) {
    const links = parseQuestLinks(body.articleLinks);
    refs.push(...links);
    patch.articleLinks = JSON.stringify(links);
  }
  if (refs.length) await checkArticles(worldId, refs);
  return patch;
}
