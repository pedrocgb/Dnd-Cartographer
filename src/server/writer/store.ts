/**
 * Campaign Writer persistence: outline nodes, threads and their beats, and
 * the campaign status log, with the client shapes they're served as. Routes
 * validate with ./parse first.
 */
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaignStatusLog, fronts, outlineNodes, plotThreads, quests, sessions, threadBeats } from "@/server/db/schema";
import { safeJson } from "@/server/calendars/parse";
import type { ArticleRef } from "@/server/quests/types";
import type { OutlineLink, OutlineNode, PlotThread, StatusEntry, ThreadBeat } from "./types";

export type NodeRow = typeof outlineNodes.$inferSelect;
export type ThreadRow = typeof plotThreads.$inferSelect;
export type BeatRow = typeof threadBeats.$inferSelect;
export type StatusRow = typeof campaignStatusLog.$inferSelect;

export const toClientNode = (row: NodeRow): OutlineNode => ({
  id: row.id,
  campaignId: row.campaignId,
  parentId: row.parentId,
  kind: row.kind,
  title: row.title,
  synopsis: row.synopsis,
  documentId: row.documentId,
  beatTemplate: row.beatTemplate,
  beatKey: row.beatKey,
  status: row.status,
  plannedSessionId: row.plannedSessionId,
  playedSessionId: row.playedSessionId,
  changeNote: row.changeNote,
  links: safeJson<OutlineLink[]>(row.links, []),
  sortOrder: row.sortOrder,
  version: row.version,
});

export const toClientThread = (row: ThreadRow): PlotThread => ({
  id: row.id,
  campaignId: row.campaignId,
  name: row.name,
  kind: row.kind,
  miceType: row.miceType,
  status: row.status,
  questId: row.questId,
  summary: row.summary,
  color: row.color,
  sortOrder: row.sortOrder,
  version: row.version,
});

export const toClientBeat = (row: BeatRow): ThreadBeat => ({ id: row.id, threadId: row.threadId, nodeId: row.nodeId, role: row.role, note: row.note });

export const toClientEntry = (row: StatusRow): StatusEntry => ({
  id: row.id,
  campaignId: row.campaignId,
  sessionId: row.sessionId,
  worldDay: row.worldDay,
  kind: row.kind,
  subject: safeJson<ArticleRef | null>(row.subject, null),
  text: row.text,
  createdAt: row.createdAt.toISOString(),
});

/** A campaign's live outline nodes (any order; the client builds the tree). */
export async function nodesOf(campaignId: string): Promise<NodeRow[]> {
  return db
    .select()
    .from(outlineNodes)
    .where(and(eq(outlineNodes.campaignId, campaignId), isNull(outlineNodes.deletedAt)))
    .orderBy(asc(outlineNodes.sortOrder), asc(outlineNodes.title));
}

/** A live outline node of this world, or null. */
export async function nodeOf(worldId: string, id: string): Promise<NodeRow | null> {
  const [row] = await db.select().from(outlineNodes).where(and(eq(outlineNodes.id, id), eq(outlineNodes.worldId, worldId), isNull(outlineNodes.deletedAt)));
  return row ?? null;
}

/** A campaign's live threads, in order. */
export async function threadsOf(campaignId: string): Promise<ThreadRow[]> {
  return db
    .select()
    .from(plotThreads)
    .where(and(eq(plotThreads.campaignId, campaignId), isNull(plotThreads.deletedAt)))
    .orderBy(asc(plotThreads.sortOrder), asc(plotThreads.name));
}

/** A live thread of this world, or null. */
export async function threadOf(worldId: string, id: string): Promise<ThreadRow | null> {
  const [row] = await db.select().from(plotThreads).where(and(eq(plotThreads.id, id), eq(plotThreads.worldId, worldId), isNull(plotThreads.deletedAt)));
  return row ?? null;
}

/** The beats of these threads. */
export async function beatsOf(threadIds: string[]): Promise<BeatRow[]> {
  return threadIds.length ? db.select().from(threadBeats).where(inArray(threadBeats.threadId, threadIds)) : [];
}

/** A campaign's status log, newest first. */
export async function statusLogOf(campaignId: string): Promise<StatusRow[]> {
  return db.select().from(campaignStatusLog).where(eq(campaignStatusLog.campaignId, campaignId)).orderBy(desc(campaignStatusLog.createdAt)).limit(1000);
}

/** Everything the Writer page shows for a campaign. */
export async function writerStateOf(campaignId: string) {
  const [nodes, threads] = await Promise.all([nodesOf(campaignId), threadsOf(campaignId)]);
  const liveNodes = new Set(nodes.map((n) => n.id));
  const beats = (await beatsOf(threads.map((t) => t.id))).filter((b) => liveNodes.has(b.nodeId));
  return { nodes: nodes.map(toClientNode), threads: threads.map(toClientThread), beats: beats.map(toClientBeat) };
}

/** The campaign's quest, front and session ids (what writer fields may point at). */
export async function writerContextOf(campaignId: string) {
  const [q, f, s] = await Promise.all([
    db.select({ id: quests.id }).from(quests).where(and(eq(quests.campaignId, campaignId), isNull(quests.deletedAt))),
    db.select({ id: fronts.id }).from(fronts).where(and(eq(fronts.campaignId, campaignId), isNull(fronts.deletedAt))),
    db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.campaignId, campaignId), isNull(sessions.deletedAt))),
  ]);
  return { questIds: new Set(q.map((x) => x.id)), frontIds: new Set(f.map((x) => x.id)), sessionIds: new Set(s.map((x) => x.id)) };
}
