"use client";

import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, useNodesState, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { HelpCircle } from "lucide-react";
import { templateOf } from "@/components/articles/templates";
import type { CatalogEntry, GraphEdge } from "@/server/relations/graph";
import type { Point } from "@/server/relations/layout";
import { DERIVED_KINDS, relationType } from "@/server/relations/types";
import { attitudeColor } from "./edge-style";

/** What a canvas card shows. */
export type CanvasCard =
  | { kind: "record"; id: string; position: Point; entry: CatalogEntry; faint?: boolean; focus?: boolean }
  | { kind: "note"; id: string; position: Point; text: string; color?: string }
  | { kind: "unknown"; id: string; position: Point }
  | { kind: "union"; id: string; position: Point; inferred?: boolean };

/** A line between two cards: a relation/derived edge, or a family-tree connector. */
export type CanvasLine =
  | { kind: "graph"; edge: GraphEdge }
  | { kind: "family"; id: string; source: string; target: string; style: "blood" | "adoptive" | "spouse" | "inferred" };

type FlowNode = Node<{ card: CanvasCard }>;

function RecordCard({ data }: NodeProps<FlowNode>) {
  const card = data.card as Extract<CanvasCard, { kind: "record" }>;
  const { Icon, label } = templateOf(card.entry.template);
  return (
    <div
      className={["rel-node", card.faint && "rel-node-faint", card.focus && "rel-node-focus"].filter(Boolean).join(" ")}
      style={card.entry.color ? { ["--rel-house" as string]: card.entry.color } : undefined}
      data-tooltip={card.entry.color ? `${label} · house color` : label}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <Icon size={14} aria-hidden className="rel-node-icon" />
      <span className="rel-node-label">{card.entry.name}</span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

function NoteCard({ data }: NodeProps<FlowNode>) {
  const card = data.card as Extract<CanvasCard, { kind: "note" }>;
  return (
    <div className="rel-note" style={card.color ? { ["--rel-note" as string]: card.color } : undefined}>
      {card.text || "Empty note"}
    </div>
  );
}

function UnknownCard() {
  return (
    <div className="rel-node rel-node-unknown" data-tooltip="Unknown parent">
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <HelpCircle size={14} aria-hidden className="rel-node-icon" />
      <span className="rel-node-label">Unknown</span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

function UnionDot({ data }: NodeProps<FlowNode>) {
  const card = data.card as Extract<CanvasCard, { kind: "union" }>;
  return (
    <div className={card.inferred ? "rel-union rel-union-inferred" : "rel-union"} data-tooltip={card.inferred ? "Parents with a child, not married here" : undefined}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { record: RecordCard, note: NoteCard, unknown: UnknownCard, union: UnionDot };

const DASH = { solid: undefined, dotted: "2 4", double: undefined } as const;

function toFlowEdge(line: CanvasLine, attitudeMode: boolean): Edge {
  if (line.kind === "family") {
    const color = line.style === "spouse" ? "#E879A6" : line.style === "inferred" ? "#6B7280" : "#D4A24C";
    return {
      id: line.id,
      source: line.source,
      target: line.target,
      type: "smoothstep",
      selectable: false,
      style: { stroke: color, strokeWidth: 1.5, strokeDasharray: line.style === "adoptive" || line.style === "inferred" ? "3 4" : undefined },
    };
  }
  const e = line.edge;
  const type = relationType(e.type);
  const derived = DERIVED_KINDS.find((d) => d.key === e.type);
  const color = attitudeMode && !e.derived ? attitudeColor(e.attitude) : (type?.color ?? derived?.color ?? "#6B7280");
  const lineStyle = type?.line ?? derived?.line ?? "solid";
  return {
    id: e.id,
    source: e.fromId,
    target: e.toId,
    label: e.secret ? `Secret · ${e.label}` : e.label,
    selectable: false,
    className: ["rel-edge", e.secret && "rel-edge-secret", e.derived && "rel-edge-derived"].filter(Boolean).join(" "),
    style: {
      stroke: color,
      strokeWidth: lineStyle === "double" ? 3 : 1.5,
      // Dashed means secret; dotted is a type's own style.
      strokeDasharray: e.secret ? "8 5" : DASH[lineStyle],
      opacity: e.derived ? 0.7 : 1,
    },
    markerEnd: e.directed ? { type: MarkerType.ArrowClosed, color, width: 16, height: 16 } : undefined,
  };
}

/**
 * A relationship canvas (React Flow): cards placed at their given
 * positions, lines styled from the relation registry (secret = dashed with
 * a lock, a type's own dotted/double style, arrows for directed ties).
 * Click a record card to open it; Shift-click (or `onFocus`) re-centers.
 * With `onMoved`, cards can be dragged and their new spots reported.
 */
export default function RelationsCanvas({
  cards,
  lines,
  attitudeMode = false,
  onOpen,
  onFocus,
  onMoved,
  onSelect,
  compact = false,
}: {
  cards: CanvasCard[];
  lines: CanvasLine[];
  attitudeMode?: boolean;
  onOpen?: (entry: CatalogEntry) => void;
  onFocus?: (id: string) => void;
  onMoved?: (moves: Record<string, Point>) => void;
  onSelect?: (id: string | null) => void;
  compact?: boolean;
}) {
  const [nodes, , onNodesChange] = useNodesState<FlowNode>(
    cards.map((card) => ({ id: card.id, type: card.kind, position: card.position, data: { card }, draggable: Boolean(onMoved), selectable: card.kind !== "union" }))
  );
  const edges = useMemo(() => lines.map((l) => toFlowEdge(l, attitudeMode)), [lines, attitudeMode]);
  // Card contents (a note's text) follow the props; positions stay React Flow's own.
  const shownNodes = useMemo(() => {
    const byId = new Map(cards.map((c) => [c.id, c]));
    return nodes.map((n) => (byId.get(n.id) && byId.get(n.id) !== n.data.card ? { ...n, data: { card: byId.get(n.id)! } } : n));
  }, [nodes, cards]);
  return (
    <ReactFlow
      nodes={shownNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeDragStop={onMoved ? (_e, _n, dragged) => onMoved(Object.fromEntries(dragged.map((n) => [n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) }]))) : undefined}
      onNodeClick={(event, node) => {
        const card = node.data.card;
        onSelect?.(node.id);
        if (card.kind !== "record") return;
        if (event.shiftKey && onFocus) onFocus(card.id);
        else if (!onMoved) onOpen?.(card.entry);
      }}
      onNodeDoubleClick={(_e, node) => node.data.card.kind === "record" && onOpen?.(node.data.card.entry)}
      onPaneClick={() => onSelect?.(null)}
      nodesConnectable={false}
      colorMode="dark"
      fitView
      minZoom={0.1}
    >
      <Background gap={24} />
      {!compact && <Controls showInteractive={false} />}
      {!compact && <MiniMap pannable zoomable />}
    </ReactFlow>
  );
}

