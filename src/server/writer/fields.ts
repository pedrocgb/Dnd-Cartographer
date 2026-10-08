import type { outlineNodes, plotThreads } from "@/server/db/schema";
import { InvalidError } from "@/server/calendars/mutations";
import { templateByKey } from "./templates";
import {
  parseChangeNote,
  parseColor,
  parseMiceType,
  parseNodeStatus,
  parseNodeTitle,
  parseOptionalId,
  parseOutlineLinks,
  parseSortIndex,
  parseSynopsis,
  parseThreadKind,
  parseThreadName,
  parseThreadStatus,
  parseThreadSummary,
} from "./parse";

/** What outline and thread fields are checked against: the campaign's quests, fronts and sessions. */
export interface WriterContext {
  questIds: ReadonlySet<string>;
  frontIds: ReadonlySet<string>;
  sessionIds: ReadonlySet<string>;
}

type NodePatch = Partial<typeof outlineNodes.$inferInsert>;
type ThreadPatch = Partial<typeof plotThreads.$inferInsert>;

/**
 * The editable outline fields present in a body, validated (kind and parent
 * are set on create and by moves, never here): linked quests and fronts and
 * the planned session must be the campaign's.
 */
export function nodeFields(body: Record<string, unknown>, { questIds, frontIds, sessionIds }: WriterContext): NodePatch {
  const patch: NodePatch = {};
  if ("title" in body) patch.title = parseNodeTitle(body.title);
  if ("synopsis" in body) patch.synopsis = parseSynopsis(body.synopsis);
  if ("status" in body) patch.status = parseNodeStatus(body.status);
  if ("changeNote" in body) patch.changeNote = parseChangeNote(body.changeNote);
  if ("sortOrder" in body) patch.sortOrder = parseSortIndex(body.sortOrder);
  if ("hidden" in body) {
    if (typeof body.hidden !== "boolean") throw new InvalidError("Hidden must be true or false.");
    patch.hiddenFromShares = body.hidden;
  }
  if ("beatTemplate" in body) {
    const key = parseOptionalId(body.beatTemplate, "The story structure");
    if (key !== null && !templateByKey(key)) throw new InvalidError({ ns: "campaign", key: "problem.noStructure" });
    patch.beatTemplate = key;
  }
  if ("plannedSessionId" in body) {
    const sessionId = parseOptionalId(body.plannedSessionId, "The session");
    if (sessionId !== null && !sessionIds.has(sessionId)) throw new InvalidError({ ns: "campaign", key: "problem.sessionNotInCampaign" });
    patch.plannedSessionId = sessionId;
  }
  if ("links" in body) {
    const links = parseOutlineLinks(body.links);
    for (const l of links) {
      if (!(l.kind === "quest" ? questIds : frontIds).has(l.id)) throw new InvalidError({ ns: "campaign", key: l.kind === "quest" ? "problem.linkedQuest" : "problem.linkedFront" });
    }
    patch.links = JSON.stringify(links);
  }
  return patch;
}

/** The thread fields present in a body, validated; a linked quest must be the campaign's. */
export function threadFields(body: Record<string, unknown>, { questIds }: Pick<WriterContext, "questIds">): ThreadPatch {
  const patch: ThreadPatch = {};
  if ("name" in body) patch.name = parseThreadName(body.name);
  if ("kind" in body) patch.kind = parseThreadKind(body.kind);
  if ("miceType" in body) patch.miceType = parseMiceType(body.miceType);
  if ("status" in body) patch.status = parseThreadStatus(body.status);
  if ("summary" in body) patch.summary = parseThreadSummary(body.summary);
  if ("color" in body) patch.color = parseColor(body.color);
  if ("sortOrder" in body) patch.sortOrder = parseSortIndex(body.sortOrder);
  if ("questId" in body) {
    const questId = parseOptionalId(body.questId, "The quest");
    if (questId !== null && !questIds.has(questId)) throw new InvalidError({ ns: "campaign", key: "problem.questNotInCampaign" });
    patch.questId = questId;
  }
  return patch;
}
