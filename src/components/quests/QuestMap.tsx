"use client";

import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, useNodesState, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { Flame, KeyRound, Link2, RotateCcw, ScrollText } from "lucide-react";
import type { Candidate } from "@/components/articles/candidates";
import { SkeletonRegion, Skeleton } from "@/components/Skeleton";
import { api } from "@/components/calendars/api";
import { articleHref, isArticleTemplate } from "@/server/articles/templates";
import { layoutMap, questMapGraph, type MapEdge, type MapNode } from "@/server/quests/map";
import { isClosed, QUEST_STATUS_LABELS, type FrontData, type MapPoint, type QuestData } from "@/server/quests/types";
import { useT } from "@/i18n/useT";

type FlowNode = Node<{ node: MapNode }, "entity">;

const ICONS = { front: Flame, quest: ScrollText, clue: KeyRound, article: Link2 };

/** One map node: an icon, its name, and a line on what it is. */
function EntityNode({ data }: NodeProps<FlowNode>) {
  const t = useT("campaign");
  const n = data.node;
  const Icon = ICONS[n.kind];
  const sub = n.kind === "quest" && n.status ? QUEST_STATUS_LABELS[n.status] : n.kind === "clue" ? (n.revealed ? t("questMap.revealedClue") : t("questMap.hiddenClue")) : n.kind === "front" ? t("quest.front") : null;
  return (
    <div className={["qm-node", `qm-${n.kind}`, n.status && `qm-status-${n.status}`, n.revealed && "qm-revealed"].filter(Boolean).join(" ")} style={n.color ? { ["--qs-front" as string]: n.color } : undefined}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <Icon size={14} aria-hidden className="qm-node-icon" />
      <span className="qm-node-text">
        <span className="qm-node-label">{n.label}</span>
        {sub && <span className="qm-node-sub">{sub}</span>}
      </span>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

const toEdge = (e: MapEdge): Edge => ({
  id: e.id,
  source: e.source,
  target: e.target,
  label: e.label,
  className: `qm-edge qm-edge-${e.kind}`,
  animated: e.kind === "front",
  selectable: false,
});

/**
 * The campaign's quests as a relationship map (React Flow): fronts, quests
 * and sub-quests, their clues and the articles involved. Drag nodes to
 * arrange it (saved for the campaign); click one to open it.
 */
export default function QuestMap({
  campaignId,
  quests,
  fronts,
  candidates,
  onOpenQuest,
  onOpenFront,
}: {
  campaignId: string;
  quests: QuestData[];
  fronts: FrontData[];
  candidates: Candidate[] | null;
  onOpenQuest: (id: string) => void;
  onOpenFront: (id: string) => void;
}) {
  const t = useT("campaign");
  const [saved, setSaved] = useState<Record<string, MapPoint> | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [hideClosed, setHideClosed] = useState(true);
  const [showClues, setShowClues] = useState(true);
  const [frontFilter, setFrontFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ positions: Record<string, MapPoint> }>("GET", `/api/campaigns/${encodeURIComponent(campaignId)}/quest-map`).then((res) => {
      if (cancelled) return;
      setSaved(res.ok ? res.data.positions : {});
      if (!res.ok) setError(res.data.error ?? t("questMap.couldNotLoad"));
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId, t]);

  const shown = useMemo(() => quests.filter((q) => (!hideClosed || !isClosed(q.status)) && (!frontFilter || q.frontId === frontFilter)), [quests, hideClosed, frontFilter]);
  const graph = useMemo(() => {
    const names = new Map((candidates ?? []).map((c) => [c.id, c.name]));
    return questMapGraph(shown, fronts, (ref) => names.get(ref.articleId) ?? null, { showClues });
  }, [shown, fronts, candidates, showClues]);

  if (!saved || !candidates) {
    return (
      <SkeletonRegion label={t("questMap.loading")} className="qm-wrap">
        <Skeleton height="100%" radius="var(--radius-md)" />
      </SkeletonRegion>
    );
  }

  // The canvas keeps its own node state; it starts over when what's on the map changes.
  const key = [layoutVersion, ...graph.nodes.map((n) => `${n.id}|${n.label}|${n.status ?? ""}|${n.revealed ?? ""}|${n.color ?? ""}`)].join("\n");

  async function savePositions(changes: Record<string, MapPoint | null>) {
    const res = await api<{ positions: Record<string, MapPoint> }>("PATCH", `/api/campaigns/${encodeURIComponent(campaignId)}/quest-map`, { positions: changes });
    if (res.ok) setSaved(res.data.positions);
    else setError(res.data.error ?? t("questMap.couldNotSave"));
  }

  async function resetLayout() {
    const res = await api<{ positions: Record<string, MapPoint> }>("PATCH", `/api/campaigns/${encodeURIComponent(campaignId)}/quest-map`, { reset: true });
    if (!res.ok) return setError(res.data.error ?? t("questMap.couldNotReset"));
    setSaved(res.data.positions);
    setLayoutVersion((v) => v + 1);
  }

  return (
    <div className="qm-wrap">
      <div className="qs-filters">
        <label className="cal-check">
          <input type="checkbox" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)} /> {t("questMap.hideFinished")}
        </label>
        <label className="cal-check">
          <input type="checkbox" checked={showClues} onChange={(e) => setShowClues(e.target.checked)} /> {t("questMap.showClues")}
        </label>
        {fronts.length > 0 && (
          <select aria-label={t("quest.front")} value={frontFilter} onChange={(e) => setFrontFilter(e.target.value)}>
            <option value="">{t("quest.allFronts")}</option>
            {fronts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => void resetLayout()} data-tooltip={t("questMap.resetHint")}>
          <RotateCcw size={14} /> {t("questMap.reset")}
        </button>
        <span className="cal-help qs-board-hint">{t("questMap.hint")}</span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {graph.nodes.length === 0 ? (
        <div className="ss-empty">
          <p className="cal-help">{quests.length ? t("questMap.noMatch") : t("questMap.empty")}</p>
        </div>
      ) : (
        <MapCanvas
          key={key}
          nodes={graph.nodes}
          edges={graph.edges}
          saved={saved}
          onMoved={(changes) => void savePositions(changes)}
          onOpen={(n) => (n.kind === "front" ? onOpenFront(n.refId) : onOpenQuest(n.refId))}
        />
      )}
    </div>
  );
}

function MapCanvas({ nodes: mapNodes, edges, saved, onMoved, onOpen }: { nodes: MapNode[]; edges: MapEdge[]; saved: Record<string, MapPoint>; onMoved: (changes: Record<string, MapPoint>) => void; onOpen: (n: MapNode) => void }) {
  const router = useRouter();
  const [nodes, , onNodesChange] = useNodesState<FlowNode>(
    (() => {
      const at = layoutMap(mapNodes, saved);
      return mapNodes.map((n) => ({ id: n.id, type: "entity" as const, position: at[n.id], data: { node: n } }));
    })()
  );
  const flowEdges = useMemo(() => edges.map(toEdge), [edges]);
  return (
    <div className="qm-canvas">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_e, _node, dragged) => onMoved(Object.fromEntries(dragged.map((n) => [n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) }])))}
        onNodeClick={(_e, node) => {
          const n = node.data.node;
          if (n.kind !== "article") onOpen(n);
          else if (n.template && isArticleTemplate(n.template)) router.push(articleHref(n.template, n.refId));
        }}
        nodesConnectable={false}
        colorMode="dark"
        fitView
        minZoom={0.2}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeClassName={(n) => `qm-mini-${(n.data as { node: MapNode }).node.kind}`} />
      </ReactFlow>
    </div>
  );
}
