/**
 * Campaign Writer logic (pure; relative imports only): the outline tree and
 * its nesting rules, story order, beat templates, thread and clue health
 * warnings, and what a session review does to scenes and secrets.
 */
import { clueCoverage } from "../quests/logic";
import { isClosed, type Clue, type QuestStatus } from "../quests/types";
import type { OutlineMove } from "./parse";
import { templateByKey } from "./templates";
import { CHILD_KIND, type BeatRole, type HealthWarning, type NodeKind, type NodeStatus, type ReviewOutcome, type Secret, type ThreadKind, type ThreadStatus } from "./types";

type Node = { id: string; parentId: string | null; kind: NodeKind; sortOrder: number; title: string };

/** Whether a `child` can sit under `parent` (null = the campaign root, which holds arcs). */
export function canNest(parent: NodeKind | null, child: NodeKind): boolean {
  return parent === null ? child === "arc" : CHILD_KIND[parent] === child;
}

export interface OutlineTreeNode<T> {
  node: T;
  children: OutlineTreeNode<T>[];
}

const byOrder = <T extends Node>(a: T, b: T) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);

/** Arcs with their chapters and scenes, in outline order. Orphans (parent missing) are left out. */
export function outlineTree<T extends Node>(nodes: readonly T[]): OutlineTreeNode<T>[] {
  const byParent = new Map<string | null, T[]>();
  for (const n of nodes) byParent.set(n.parentId, [...(byParent.get(n.parentId) ?? []), n]);
  const build = (parent: string | null, depth: number): OutlineTreeNode<T>[] =>
    depth > 3 ? [] : (byParent.get(parent) ?? []).sort(byOrder).map((node) => ({ node, children: build(node.id, depth + 1) }));
  return build(null, 0);
}

/** Every node in reading order (arc, its chapters, each chapter's scenes, …). */
export function readingOrder<T extends Node>(nodes: readonly T[]): T[] {
  const out: T[] = [];
  const walk = (list: OutlineTreeNode<T>[]) => {
    for (const t of list) {
      out.push(t.node);
      walk(t.children);
    }
  };
  walk(outlineTree(nodes));
  return out;
}

/** Every descendant id of a node. */
export function descendantIds(nodes: readonly Pick<Node, "id" | "parentId">[], id: string): Set<string> {
  const out = new Set<string>();
  const walk = (parent: string) => {
    for (const n of nodes) {
      if (n.parentId === parent && !out.has(n.id)) {
        out.add(n.id);
        walk(n.id);
      }
    }
  };
  walk(id);
  return out;
}

/**
 * Checks a batch of moves against the campaign's outline: every moved node
 * exists, its new parent exists and can hold it (arcs at the root, chapters
 * in arcs, scenes in chapters). Returns an error message, or null when fine.
 */
export function checkMoves(nodes: readonly Pick<Node, "id" | "parentId" | "kind">[], moves: readonly OutlineMove[]): string | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const m of moves) {
    const node = byId.get(m.id);
    if (!node) return "Something you moved isn't in this campaign's outline.";
    const parent = m.parentId === null ? null : byId.get(m.parentId);
    if (parent === undefined) return "That place isn't in this campaign's outline.";
    if (!canNest(parent?.kind ?? null, node.kind)) return nestError(node.kind);
  }
  return null;
}

export const nestError = (kind: NodeKind) =>
  kind === "arc" ? "Arcs sit at the top of the outline." : kind === "chapter" ? "Chapters go inside an arc." : "Scenes go inside a chapter.";

export interface ChildDraft {
  kind: NodeKind;
  title: string;
  synopsis: string;
  beatKey: string;
}

/** The children a story template creates under a parent (null = the campaign root: arcs). */
export function templateChildren(templateKey: string, parent: NodeKind | null): ChildDraft[] | null {
  const template = templateByKey(templateKey);
  const kind = parent === null ? "arc" : CHILD_KIND[parent];
  if (!template || !kind) return null;
  return template.beats.map((b) => ({ kind, title: b.name, synopsis: b.hint, beatKey: b.key }));
}

type ThreadLike = { id: string; name: string; kind: ThreadKind; status: ThreadStatus };
type BeatLike = { threadId: string; nodeId: string; role: BeatRole };
type QuestLike = { id: string; title: string; status: QuestStatus; clues: readonly Clue[] };

/**
 * What the writer may have lost track of: threads never set up or paid off,
 * payoffs before their setup, MICE threads closing out of order, and open
 * quests with fewer than three clues (the Three Clue Rule). `order` is the
 * outline in reading order (node ids).
 */
export function healthWarnings(threads: readonly ThreadLike[], beats: readonly BeatLike[], order: readonly string[], quests: readonly QuestLike[]): HealthWarning[] {
  const position = new Map(order.map((id, i) => [id, i]));
  const out: HealthWarning[] = [];
  const spans = new Map<string, { open: number | null; close: number | null }>();
  for (const t of threads) {
    const mine = beats.filter((b) => b.threadId === t.id && position.has(b.nodeId));
    const at = (role: BeatRole) => mine.filter((b) => b.role === role).map((b) => position.get(b.nodeId)!);
    const setups = at("setup");
    const payoffs = at("payoff");
    const firstSetup = setups.length ? Math.min(...setups) : null;
    const lastPayoff = payoffs.length ? Math.max(...payoffs) : null;
    spans.set(t.id, { open: firstSetup, close: lastPayoff });
    const target = { kind: "thread" as const, id: t.id };
    if (t.status === "dropped") continue;
    if (mine.length === 0) {
      out.push({ key: `${t.id}:unplaced`, level: "info", text: `"${t.name}" isn't in any scene yet.`, target });
      continue;
    }
    if (firstSetup === null) out.push({ key: `${t.id}:nosetup`, level: "info", text: `"${t.name}" is never set up: which scene introduces it?`, target });
    if (lastPayoff === null && t.status !== "paid") {
      const what = t.kind === "chekhov" ? "is planted but never used" : t.kind === "mice" ? "opens but never closes" : "is promised but never paid off";
      out.push({ key: `${t.id}:nopayoff`, level: "warn", text: `"${t.name}" ${what}.`, target });
    }
    if (firstSetup !== null && lastPayoff !== null && lastPayoff < firstSetup) out.push({ key: `${t.id}:order`, level: "warn", text: `"${t.name}" pays off before it's set up.`, target });
  }
  // MICE: first opened, last closed. A thread that opens inside another must close before it.
  const mice = threads.filter((t) => t.kind === "mice" && t.status !== "dropped");
  for (const outer of mice) {
    const a = spans.get(outer.id)!;
    if (a.open === null || a.close === null) continue;
    for (const inner of mice) {
      const b = spans.get(inner.id)!;
      if (inner.id === outer.id || b.open === null || b.close === null) continue;
      if (a.open < b.open && b.open < a.close && a.close < b.close) {
        out.push({ key: `${outer.id}:${inner.id}:nest`, level: "warn", text: `"${outer.name}" closes before "${inner.name}", which opened inside it. Close the inner thread first.`, target: { kind: "thread", id: outer.id } });
      }
    }
  }
  for (const q of quests) {
    if (isClosed(q.status)) continue;
    const c = clueCoverage(q.clues);
    const target = { kind: "quest" as const, id: q.id };
    if (c.underThree) out.push({ key: `${q.id}:clues`, level: "warn", text: `"${q.title}" has ${c.total} clue${c.total === 1 ? "" : "s"}. Give it at least three: players miss clues.`, target });
    else if (c.total - c.revealed > 0 && c.placed === 0) out.push({ key: `${q.id}:placed`, level: "info", text: `"${q.title}" has clues, but none is placed anywhere yet.`, target });
  }
  return out;
}

export interface ScenePatch {
  status: NodeStatus;
  playedSessionId: string | null;
  plannedSessionId: string | null;
  changeNote?: string;
}

/**
 * What a session review does to one of its planned scenes: played or
 * changed scenes record the session; "not reached" ones move to the next
 * session (or back to unscheduled); cut ones are marked cut.
 */
export function reviewScene(current: { status: NodeStatus; plannedSessionId: string | null }, outcome: ReviewOutcome, changeNote: string, sessionId: string, nextSessionId: string | null): ScenePatch {
  if (outcome === "played" || outcome === "changed") return { status: outcome, playedSessionId: sessionId, plannedSessionId: sessionId, ...(outcome === "changed" ? { changeNote } : {}) };
  if (outcome === "skipped") return { status: "skipped", playedSessionId: null, plannedSessionId: current.plannedSessionId };
  const status: NodeStatus = current.status === "played" || current.status === "changed" || current.status === "skipped" ? "ready" : current.status;
  return { status, playedSessionId: null, plannedSessionId: nextSessionId };
}

/**
 * The session's secrets after its review (revealed or carried on), and the
 * ones to add to the next session: the unrevealed secrets, as unused, unless
 * it already has them.
 */
export function carrySecrets(secrets: readonly Secret[], revealed: Readonly<Record<string, boolean>>, next: readonly Secret[]): { reviewed: Secret[]; carried: Secret[] } {
  const reviewed = secrets.map((s): Secret => (revealed[s.id] || s.state === "revealed" ? { ...s, state: "revealed" } : { ...s, state: "carried" }));
  const have = new Set(next.map((s) => s.id));
  const carried = reviewed.filter((s) => s.state === "carried" && !have.has(s.id)).map((s) => ({ ...s, state: "unused" as const }));
  return { reviewed, carried };
}

/**
 * The moves that put `id` at `index` among `parentId`'s children (after
 * taking it out of its old place), renumbering both sibling lists. Null
 * when it can't go there (see canNest).
 */
export function moveNode(nodes: readonly Node[], id: string, parentId: string | null, index: number): OutlineMove[] | null {
  const node = nodes.find((n) => n.id === id);
  const parent = parentId === null ? null : nodes.find((n) => n.id === parentId);
  if (!node || parent === undefined || !canNest(parent?.kind ?? null, node.kind)) return null;
  const siblings = (p: string | null) => nodes.filter((n) => n.parentId === p && n.id !== id).sort(byOrder);
  const target = siblings(parentId);
  target.splice(Math.max(0, Math.min(index, target.length)), 0, node);
  const moves = new Map<string, OutlineMove>();
  target.forEach((n, i) => {
    if (n.sortOrder !== i || n.parentId !== parentId) moves.set(n.id, { id: n.id, parentId, sortOrder: i });
  });
  if (node.parentId !== parentId) {
    siblings(node.parentId).forEach((n, i) => {
      if (n.sortOrder !== i) moves.set(n.id, { id: n.id, parentId: n.parentId, sortOrder: i });
    });
  }
  return [...moves.values()];
}

/** Applies moves to a node list (for the optimistic outline). */
export function applyMoves<T extends Node>(nodes: readonly T[], moves: readonly OutlineMove[]): T[] {
  const byId = new Map(moves.map((m) => [m.id, m]));
  return nodes.map((n) => {
    const m = byId.get(n.id);
    return m ? { ...n, parentId: m.parentId, sortOrder: m.sortOrder } : n;
  });
}
