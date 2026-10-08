/**
 * The quest relationship map as a graph (pure; relative imports only):
 * fronts, quests, clues and the articles they touch, with an automatic
 * layered layout that saved positions override.
 */
import { questTree, type TreeNode } from "./logic";
import { activeT } from "../../i18n/active";
import { LINK_ROLE_LABELS, type ArticleRef, type FrontData, type MapPoint, type QuestData, type QuestStatus } from "./types";

export type MapNodeKind = "front" | "quest" | "clue" | "article";

export interface MapNode {
  /** Stable across saves: "f:", "q:", "c:<quest>:", "a:" + the record's id. */
  id: string;
  kind: MapNodeKind;
  label: string;
  /** Column in the automatic layout. */
  rank: number;
  /** The quest (quest and clue nodes), front, or article it stands for. */
  refId: string;
  status?: QuestStatus;
  revealed?: boolean;
  template?: string;
  color?: string | null;
}

export type MapEdgeKind = "front" | "sub" | "clue" | "place" | "link";

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  kind: MapEdgeKind;
  label?: string;
}

export const nodeId = {
  front: (id: string) => `f:${id}`,
  quest: (id: string) => `q:${id}`,
  clue: (questId: string, clueId: string) => `c:${questId}:${clueId}`,
  article: (id: string) => `a:${id}`,
};

/**
 * Builds the graph. `articleName` names a linked article (null when it's
 * gone: the node and its edges are left out). Clues are shown only when
 * `showClues`.
 */
export function questMapGraph(
  quests: readonly QuestData[],
  fronts: readonly FrontData[],
  articleName: (ref: ArticleRef) => string | null,
  { showClues = true }: { showClues?: boolean } = {}
): { nodes: MapNode[]; edges: MapEdge[] } {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const articles = new Map<string, MapNode>();
  const shownFronts = fronts.filter((f) => quests.some((q) => q.frontId === f.id));
  for (const f of shownFronts) nodes.push({ id: nodeId.front(f.id), kind: "front", label: f.name, rank: 0, refId: f.id, color: f.color });

  // Quests in tree order, a column per depth.
  const ordered: { quest: QuestData; depth: number }[] = [];
  const walk = (list: TreeNode<QuestData>[], depth: number) =>
    list.forEach((n) => {
      ordered.push({ quest: n.quest, depth });
      walk(n.children, depth + 1);
    });
  // Each front's quests together (in front order), then the ones without a front.
  const frontRank = (q: QuestData) => {
    const i = shownFronts.findIndex((f) => f.id === q.frontId);
    return i === -1 ? shownFronts.length : i;
  };
  walk(
    questTree(quests)
      .map((n, i) => ({ n, i }))
      .sort((a, b) => frontRank(a.n.quest) - frontRank(b.n.quest) || a.i - b.i)
      .map((x) => x.n),
    0
  );
  const deepest = ordered.reduce((max, o) => Math.max(max, o.depth), 0);
  const clueRank = deepest + 2;
  const articleRank = clueRank + (showClues ? 1 : 0);

  const article = (ref: ArticleRef): string | null => {
    const id = nodeId.article(ref.articleId);
    if (articles.has(id)) return id;
    const label = articleName(ref);
    if (label === null) return null;
    const node: MapNode = { id, kind: "article", label, rank: articleRank, refId: ref.articleId, template: ref.template };
    articles.set(id, node);
    return id;
  };
  const edge = (source: string, target: string, kind: MapEdgeKind, label?: string) => {
    const id = `${kind}:${source}->${target}`;
    if (!edges.some((e) => e.id === id)) edges.push({ id, source, target, kind, ...(label ? { label } : {}) });
  };

  const inMap = new Set(quests.map((q) => q.id));
  for (const { quest: q, depth } of ordered) {
    const qid = nodeId.quest(q.id);
    nodes.push({ id: qid, kind: "quest", label: q.title, rank: depth + 1, refId: q.id, status: q.status });
    if (q.frontId && shownFronts.some((f) => f.id === q.frontId) && !(q.parentId && inMap.has(q.parentId) && quests.find((p) => p.id === q.parentId)?.frontId === q.frontId)) {
      edge(nodeId.front(q.frontId), qid, "front");
    }
    if (q.parentId && inMap.has(q.parentId)) edge(nodeId.quest(q.parentId), qid, "sub");
    if (q.giver) {
      const a = article(q.giver);
      if (a) edge(qid, a, "link", activeT("campaign")("mapEdge.giver"));
    }
    for (const l of q.articleLinks) {
      const a = article(l);
      if (a) edge(qid, a, "link", LINK_ROLE_LABELS[l.role]);
    }
    if (!showClues) continue;
    for (const c of q.clues) {
      const cid = nodeId.clue(q.id, c.id);
      nodes.push({ id: cid, kind: "clue", label: c.text, rank: clueRank, refId: q.id, revealed: c.revealed });
      edge(qid, cid, "clue");
      for (const p of c.placedIn) {
        const a = article(p);
        if (a) edge(cid, a, "place");
      }
    }
  }
  nodes.push(...articles.values());
  return { nodes, edges };
}

export const MAP_COLUMN = 300;
export const MAP_ROW = 84;

/** Where each node goes: its saved spot, else its column (rank) and its turn in that column. */
export function layoutMap(nodes: readonly MapNode[], saved: Readonly<Record<string, MapPoint>>): Record<string, MapPoint> {
  const rows = new Map<number, number>();
  const out: Record<string, MapPoint> = {};
  for (const n of nodes) {
    const row = rows.get(n.rank) ?? 0;
    rows.set(n.rank, row + 1);
    out[n.id] = saved[n.id] ?? { x: n.rank * MAP_COLUMN, y: row * MAP_ROW };
  }
  return out;
}
