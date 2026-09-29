"use client";

import "@xyflow/react/dist/style.css";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  NodeToolbar,
  Position,
  ReactFlow,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { HelpCircle } from "lucide-react";
import { templateOf } from "@/components/articles/templates";
import type { CatalogEntry, GraphEdge } from "@/server/relations/graph";
import type { Point } from "@/server/relations/layout";
import { DERIVED_KINDS, relationType } from "@/server/relations/types";
import { attitudeColor, portraitSrc, templateTint } from "./edge-style";

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

/** Per-canvas hooks the card components read (toolbars, note editing). */
interface CanvasUi {
  renderToolbar?: (card: CanvasCard) => React.ReactNode;
  onNoteText?: (id: string, text: string) => void;
}
const CanvasUiContext = createContext<CanvasUi>({});

export const NOTE_DEFAULT = "#facc15";
/** With more lines than this, labels only show on the lines around the hovered or selected card. */
const ALWAYS_LABEL_MAX = 24;

function Toolbar({ card, position = Position.Top }: { card: CanvasCard; position?: Position }) {
  const { renderToolbar } = useContext(CanvasUiContext);
  const content = renderToolbar?.(card);
  if (!content) return null;
  return (
    <NodeToolbar position={position} offset={10} className="rel-float-toolbar">
      {content}
    </NodeToolbar>
  );
}

function Avatar({ entry }: { entry: CatalogEntry }) {
  const { Icon } = templateOf(entry.template);
  const [broken, setBroken] = useState(false);
  if (entry.portraitKey && !broken) {
    // eslint-disable-next-line @next/next/no-img-element -- small cropped portraits served by the app
    return <img className="rel-avatar" src={portraitSrc(entry.portraitKey)} alt="" draggable={false} onError={() => setBroken(true)} />;
  }
  return (
    <span className="rel-avatar rel-avatar-icon" aria-hidden>
      <Icon size={15} strokeWidth={2.25} />
    </span>
  );
}

function RecordCard({ data }: NodeProps<FlowNode>) {
  const card = data.card as Extract<CanvasCard, { kind: "record" }>;
  const { label } = templateOf(card.entry.template);
  const accent = card.entry.color ?? templateTint(card.entry.template);
  return (
    <div className={["rel-node", card.faint && "rel-node-faint", card.focus && "rel-node-focus"].filter(Boolean).join(" ")} style={{ ["--rel-accent" as string]: accent }}>
      <Toolbar card={card} />
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <Avatar entry={card.entry} />
      <span className="rel-node-text">
        <span className="rel-node-label">{card.entry.name}</span>
        <span className="rel-node-kind">{label}</span>
      </span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

function NoteCard({ data }: NodeProps<FlowNode>) {
  const card = data.card as Extract<CanvasCard, { kind: "note" }>;
  const { onNoteText } = useContext(CanvasUiContext);
  const [draft, setDraft] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const editing = draft !== null;
  useEffect(() => {
    const area = areaRef.current;
    if (!editing || !area) return;
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }, [editing]);
  const commit = () => {
    if (draft !== null && draft !== card.text) onNoteText?.(card.id, draft);
    setDraft(null);
  };
  return (
    <div
      className={editing ? "rel-note editing" : "rel-note"}
      style={{ ["--rel-note" as string]: card.color ?? NOTE_DEFAULT }}
      onDoubleClick={(e) => {
        if (!onNoteText || editing) return;
        e.stopPropagation();
        setDraft(card.text);
      }}
    >
      {!editing && <Toolbar card={card} position={Position.Bottom} />}
      {editing ? (
        <textarea
          ref={areaRef}
          className="nodrag nowheel nopan rel-note-input"
          value={draft}
          maxLength={1000}
          aria-label="Note text"
          placeholder="Write the note…"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              e.preventDefault();
              setDraft(null);
            } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              commit();
            }
          }}
        />
      ) : (
        <span className={card.text ? "rel-note-text" : "rel-note-text rel-note-empty"}>{card.text || (onNoteText ? "Double-click to write…" : "Empty note")}</span>
      )}
    </div>
  );
}

function UnknownCard() {
  return (
    <div className="rel-node rel-node-unknown" data-tooltip="Unknown parent">
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <span className="rel-avatar rel-avatar-icon" aria-hidden>
        <HelpCircle size={15} />
      </span>
      <span className="rel-node-text">
        <span className="rel-node-label">Unknown</span>
        <span className="rel-node-kind">Parent</span>
      </span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

function UnionDot({ data }: NodeProps<FlowNode>) {
  const card = data.card as Extract<CanvasCard, { kind: "union" }>;
  return (
    <div className={card.inferred ? "rel-union rel-union-inferred" : "rel-union"} data-tooltip={card.inferred ? "Parents with a child, not married here" : "Partners"}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { record: RecordCard, note: NoteCard, unknown: UnknownCard, union: UnionDot };

const DASH = { solid: undefined, dotted: "2 4", double: undefined } as const;

type LineState = "normal" | "lit" | "dim";

function lineEnds(line: CanvasLine): [string, string] {
  return line.kind === "family" ? [line.source, line.target] : [line.edge.fromId, line.edge.toId];
}

function toFlowEdge(line: CanvasLine, attitudeMode: boolean, state: LineState, showLabel: boolean): Edge {
  const dim = state === "dim";
  if (line.kind === "family") {
    const color = line.style === "spouse" ? "#E879A6" : line.style === "inferred" ? "#6B7280" : "#D4A24C";
    return {
      id: line.id,
      source: line.source,
      target: line.target,
      type: "smoothstep",
      selectable: false,
      style: { stroke: color, strokeWidth: state === "lit" ? 2.5 : 1.75, strokeDasharray: line.style === "adoptive" || line.style === "inferred" ? "3 4" : undefined, opacity: dim ? 0.15 : 1 },
    };
  }
  const e = line.edge;
  const type = relationType(e.type);
  const derived = DERIVED_KINDS.find((d) => d.key === e.type);
  const color = attitudeMode && !e.derived ? attitudeColor(e.attitude) : (type?.color ?? derived?.color ?? "#6B7280");
  const lineStyle = type?.line ?? derived?.line ?? "solid";
  const width = lineStyle === "double" ? 3 : 1.75;
  return {
    id: e.id,
    source: e.fromId,
    target: e.toId,
    label: showLabel ? (e.secret ? `Secret · ${e.label}` : e.label) : undefined,
    selectable: false,
    zIndex: state === "lit" ? 1 : 0,
    className: ["rel-edge", e.secret && "rel-edge-secret", e.derived && "rel-edge-derived"].filter(Boolean).join(" "),
    labelBgPadding: [7, 3],
    labelBgBorderRadius: 999,
    style: {
      stroke: color,
      strokeWidth: state === "lit" ? width + 1 : width,
      // Dashed means secret; dotted is a type's own style.
      strokeDasharray: e.secret ? "8 5" : DASH[lineStyle],
      opacity: dim ? 0.12 : e.derived ? 0.65 : 1,
    },
    markerEnd: e.directed ? { type: MarkerType.ArrowClosed, color, width: 16, height: 16 } : undefined,
  };
}

const toNode = (card: CanvasCard, draggable: boolean): FlowNode => ({
  id: card.id,
  type: card.kind,
  position: card.position,
  data: { card },
  draggable,
  selectable: card.kind !== "union",
});

function miniColor(node: FlowNode): string {
  const card = node.data.card;
  if (card.kind === "record") return card.entry.color ?? templateTint(card.entry.template);
  if (card.kind === "note") return card.color ?? NOTE_DEFAULT;
  if (card.kind === "union") return "#d4a24c";
  return "#4d525a";
}

/**
 * A relationship canvas (React Flow): cards at their given positions, lines
 * styled from the relation registry (secret = dashed, a type's own
 * dotted/double style, arrows for directed ties). Hovering a card (or
 * passing `highlightId`) lights its lines and neighbors and fades the rest.
 *
 * With `onSelect`, a click selects a card and a double-click opens its
 * article; without it, a click opens. Shift-click re-centers (`onFocus`).
 * With `onMoved`, cards can be dragged; `onDelete` removes the selected ones
 * with Delete/Backspace; `renderToolbar` floats actions by the selected card
 * (below it for notes). Cards coming and going keep the view where it is;
 * remount (key) to re-fit.
 */
export default function RelationsCanvas({
  cards,
  lines,
  attitudeMode = false,
  highlightId = null,
  onOpen,
  onFocus,
  onMoved,
  onSelect,
  onDelete,
  onNoteText,
  renderToolbar,
  compact = false,
  children,
}: {
  cards: CanvasCard[];
  lines: CanvasLine[];
  attitudeMode?: boolean;
  highlightId?: string | null;
  onOpen?: (entry: CatalogEntry) => void;
  onFocus?: (id: string) => void;
  onMoved?: (moves: Record<string, Point>) => void;
  onSelect?: (id: string | null) => void;
  onDelete?: (ids: string[]) => void;
  onNoteText?: (id: string, text: string) => void;
  renderToolbar?: (card: CanvasCard) => React.ReactNode;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const draggable = Boolean(onMoved);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(cards.map((c) => toNode(c, draggable)));
  const [hovered, setHovered] = useState<string | null>(null);

  // New cards: keep each existing card's React Flow state (selection), take the new contents and positions.
  const [prevCards, setPrevCards] = useState(cards);
  if (cards !== prevCards) {
    setPrevCards(cards);
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      return cards.map((c) => {
        const old = byId.get(c.id);
        return old ? { ...old, position: c.position, data: { card: c } } : toNode(c, draggable);
      });
    });
  }

  const lit = hovered ?? highlightId;
  const neighbors = useMemo(() => {
    if (!lit) return null;
    const set = new Set([lit]);
    for (const l of lines) {
      const [a, b] = lineEnds(l);
      if (a === lit) set.add(b);
      if (b === lit) set.add(a);
    }
    return set;
  }, [lit, lines]);

  const edges = useMemo(
    () =>
      lines.map((l) => {
        const [a, b] = lineEnds(l);
        const touches = Boolean(lit) && (a === lit || b === lit);
        const state: LineState = !lit ? "normal" : touches ? "lit" : "dim";
        return toFlowEdge(l, attitudeMode, state, lines.length <= ALWAYS_LABEL_MAX ? state !== "dim" : touches);
      }),
    [lines, attitudeMode, lit]
  );
  const shownNodes = useMemo(() => (neighbors ? nodes.map((n) => ({ ...n, className: neighbors.has(n.id) ? "rel-lit" : "rel-dim" })) : nodes), [nodes, neighbors]);
  const ui = useMemo<CanvasUi>(() => ({ renderToolbar, onNoteText }), [renderToolbar, onNoteText]);

  return (
    <CanvasUiContext.Provider value={ui}>
      <ReactFlow
        nodes={shownNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onMoved ? (_e, _n, dragged) => onMoved(Object.fromEntries(dragged.map((n) => [n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) }]))) : undefined}
        onNodeClick={(event, node) => {
          const card = node.data.card;
          if (card.kind === "record" && event.shiftKey && onFocus) return onFocus(card.id);
          if (onSelect) return onSelect(card.kind === "union" ? null : node.id);
          if (card.kind === "record") onOpen?.(card.entry);
        }}
        onNodeDoubleClick={(_e, node) => node.data.card.kind === "record" && onOpen?.(node.data.card.entry)}
        onNodeMouseEnter={(_e, node) => node.data.card.kind !== "union" && setHovered(node.id)}
        onNodeMouseLeave={() => setHovered(null)}
        onPaneClick={() => onSelect?.(null)}
        onNodesDelete={onDelete ? (deleted) => onDelete(deleted.map((n) => n.id)) : undefined}
        deleteKeyCode={onDelete ? ["Delete", "Backspace"] : null}
        nodesConnectable={false}
        zoomOnDoubleClick={false}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
        minZoom={0.1}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#34383e" />
        {!compact && <Controls showInteractive={false} position="top-left" />}
        {!compact && <MiniMap pannable zoomable nodeColor={miniColor} nodeStrokeWidth={0} nodeBorderRadius={6} maskColor="rgba(13, 14, 16, 0.6)" />}
        {children}
      </ReactFlow>
    </CanvasUiContext.Provider>
  );
}
