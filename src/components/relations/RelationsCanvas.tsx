"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  NodeResizer,
  NodeToolbar,
  Position,
  ReactFlow,
  SelectionMode,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import { Group, HelpCircle, Pencil, Trash2, Ungroup, Unlink } from "lucide-react";
import { templateOf } from "@/components/articles/templates";
import type { CatalogEntry, GraphEdge } from "@/server/relations/graph";
import { NOTE_DEFAULT_H, NOTE_DEFAULT_W, NOTE_MAX_H, NOTE_MAX_W, NOTE_MIN_H, NOTE_MIN_W, ARROW_DEFAULT, isArrowSide, type ArrowSide, type BoardArrow, type BoardGroup } from "@/server/relations/boards";
import type { Point } from "@/server/relations/layout";
import { DERIVED_KINDS, relationType } from "@/server/relations/types";
import { attitudeColor, portraitSrc, templateTint } from "./edge-style";
import ArrowEdge from "./ArrowEdge";
import BoardContextMenu, { type MenuAction } from "./BoardContextMenu";
import { groupFrame, groupIdOf, groupNodeId, isGroupNodeId } from "./board-groups";
import { CanvasUiContext, type CanvasUi } from "./canvas-ui";
import GroupFrame, { type GroupFlowNode } from "./GroupFrame";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";

/** What a canvas card shows. */
export type CanvasCard =
  | { kind: "record"; id: string; position: Point; entry: CatalogEntry; faint?: boolean; focus?: boolean }
  | { kind: "note"; id: string; position: Point; text: string; color?: string; w?: number; h?: number }
  | { kind: "unknown"; id: string; position: Point }
  | { kind: "union"; id: string; position: Point; inferred?: boolean };

/** A line between two cards: a relation/derived edge, or a family-tree connector. */
export type CanvasLine =
  | { kind: "graph"; edge: GraphEdge }
  | { kind: "family"; id: string; source: string; target: string; style: "blood" | "adoptive" | "spouse" | "inferred" }
  | { kind: "arrow"; arrow: BoardArrow };

type FlowNode = Node<{ card: CanvasCard }>;
type AnyNode = FlowNode | GroupFlowNode;

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

const CONNECT_SIDES = [
  { id: "t", position: Position.Top },
  { id: "r", position: Position.Right },
  { id: "b", position: Position.Bottom },
  { id: "l", position: Position.Left },
] as const;

/** Dots on a card's sides to drag an arrow from (Boards); after the relation handles, which lines use by default. */
function ConnectDots() {
  const { connectable } = useContext(CanvasUiContext);
  if (!connectable) return null;
  return CONNECT_SIDES.map(({ id, position }) => <Handle key={id} id={id} type="source" position={position} className="rel-connect-dot" />);
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
      <ConnectDots />
    </div>
  );
}

/** Vertical padding of `.rel-note` (globals.css), added to its text's height. */
const NOTE_PAD_Y = 26;

function NoteCard({ data, selected }: NodeProps<FlowNode>) {
  const t = useT("relations");
  const card = data.card as Extract<CanvasCard, { kind: "note" }>;
  const { onNoteText, onNoteResize } = useContext(CanvasUiContext);
  const [draft, setDraft] = useState<string | null>(null);
  // While the resize handles are dragged, the note fills the size React Flow gives its node.
  const [resizing, setResizing] = useState(false);
  // The text's height when a resize starts: the note can't get shorter than its lines.
  const [textHeight, setTextHeight] = useState(0);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const editing = draft !== null;
  useEffect(() => {
    const area = areaRef.current;
    if (!editing || !area) return;
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }, [editing]);
  // The note grows with its text instead of scrolling inside.
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight}px`;
  }, [draft]);
  const commit = () => {
    if (draft !== null && draft !== card.text) onNoteText?.(card.id, draft);
    setDraft(null);
  };
  const width = card.w ?? NOTE_DEFAULT_W;
  const minHeight = card.h ?? NOTE_DEFAULT_H;
  return (
    <div
      className={editing ? "rel-note editing" : "rel-note"}
      style={{
        ["--rel-note" as string]: card.color ?? NOTE_DEFAULT,
        width: resizing ? "100%" : width,
        height: resizing ? "100%" : undefined,
        minHeight: resizing ? undefined : minHeight,
      }}
      onDoubleClick={(e) => {
        if (!onNoteText || editing) return;
        e.stopPropagation();
        setDraft(card.text);
      }}
      // A click on the note's padding keeps the text being edited instead of blurring it.
      onMouseDown={(e) => {
        if (editing && e.target !== areaRef.current) e.preventDefault();
      }}
    >
      {onNoteResize && !editing && (
        <NodeResizer
          isVisible={selected}
          minWidth={NOTE_MIN_W}
          maxWidth={NOTE_MAX_W}
          minHeight={Math.max(NOTE_MIN_H, Math.min(NOTE_MAX_H, textHeight))}
          maxHeight={NOTE_MAX_H}
          handleClassName="rel-note-handle"
          lineClassName="rel-note-line"
          onResizeStart={() => setTextHeight((textRef.current?.scrollHeight ?? 0) + NOTE_PAD_Y)}
          // Only once React Flow has given the node a size (100% of an unsized node would be the pane).
          onResize={() => setResizing(true)}
          onResizeEnd={(_e, { width: w, height: h }) => {
            setResizing(false);
            onNoteResize(card.id, { w: Math.round(w), h: Math.round(h) });
          }}
        />
      )}
      {!editing && <Toolbar card={card} position={Position.Bottom} />}
      {!editing && <ConnectDots />}
      {editing ? (
        <textarea
          ref={areaRef}
          className="nodrag nowheel nopan rel-note-input"
          rows={1}
          value={draft}
          maxLength={1000}
          aria-label={t("canvas.noteText")}
          placeholder={t("canvas.notePlaceholder")}
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
        <span ref={textRef} className={card.text ? "rel-note-text" : "rel-note-text rel-note-empty"}>{card.text || (onNoteText ? t("canvas.noteEmptyEdit") : t("canvas.noteEmpty"))}</span>
      )}
    </div>
  );
}

function UnknownCard() {
  const t = useT("relations");
  return (
    <div className="rel-node rel-node-unknown" data-tooltip={t("canvas.unknownParent")}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <span className="rel-avatar rel-avatar-icon" aria-hidden>
        <HelpCircle size={15} />
      </span>
      <span className="rel-node-text">
        <span className="rel-node-label">{t("canvas.unknown")}</span>
        <span className="rel-node-kind">{t("canvas.parent")}</span>
      </span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

function UnionDot({ data }: NodeProps<FlowNode>) {
  const t = useT("relations");
  const card = data.card as Extract<CanvasCard, { kind: "union" }>;
  return (
    <div className={card.inferred ? "rel-union rel-union-inferred" : "rel-union"} data-tooltip={card.inferred ? t("canvas.unmarried") : t("canvas.partners")}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { record: RecordCard, note: NoteCard, unknown: UnknownCard, union: UnionDot, boardGroup: GroupFrame };
const edgeTypes = { arrow: ArrowEdge };

const DASH = { solid: undefined, dotted: "2 4", double: undefined } as const;

type LineState = "normal" | "lit" | "dim";

function lineEnds(line: CanvasLine): [string, string] {
  if (line.kind === "family") return [line.source, line.target];
  if (line.kind === "arrow") return [line.arrow.from, line.arrow.to];
  return [line.edge.fromId, line.edge.toId];
}

function toFlowEdge(line: CanvasLine, attitudeMode: boolean, state: LineState, showLabel: boolean): Edge {
  const dim = state === "dim";
  if (line.kind === "arrow") {
    const a = line.arrow;
    const color = a.color ?? ARROW_DEFAULT;
    const head = { type: MarkerType.ArrowClosed, color, width: 16, height: 16 };
    const dir = a.dir ?? "one";
    return {
      id: a.id,
      source: a.from,
      target: a.to,
      sourceHandle: a.fromSide,
      targetHandle: a.toSide,
      type: "arrow",
      data: { arrow: a },
      reconnectable: true,
      // Clicks select arrows (onEdgeClick); a selection box takes cards only.
      selectable: false,
      zIndex: state === "lit" ? 1 : 0,
      className: "rel-arrow",
      style: { stroke: color, strokeWidth: state === "lit" ? 2.75 : 2, strokeDasharray: a.dashed ? "7 5" : undefined, opacity: dim ? 0.15 : 1 },
      markerEnd: dir === "none" ? undefined : head,
      markerStart: dir === "both" ? head : undefined,
    };
  }
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
    label: showLabel ? (e.secret ? activeT("relations")("edge.secret", { label: e.label }) : e.label) : undefined,
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

function miniColor(node: AnyNode): string {
  if (node.type === "boardGroup") return "transparent";
  const card = (node as FlowNode).data.card;
  if (card.kind === "record") return card.entry.color ?? templateTint(card.entry.template);
  if (card.kind === "note") return card.color ?? NOTE_DEFAULT;
  if (card.kind === "union") return "#d4a24c";
  return "#4d525a";
}

/** A board's groups and what its selection menus do (Boards only). */
export interface BoardActions {
  groups: BoardGroup[];
  onGroup: (cardIds: string[]) => void;
  onGroupRename: (id: string, title: string) => void;
  onUngroup: (id: string) => void;
  onUnlink: (cardIds: string[]) => void;
  /** Deletes cards, groups (with their cards) and arrows at once. */
  onDeleteItems: (cardIds: string[], groupIds: string[], arrowIds: string[]) => void;
}

type ContextMenu = { x: number; y: number } & ({ kind: "cards"; ids: string[] } | { kind: "group"; id: string });

const NO_GROUPS: BoardGroup[] = [];

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
 *
 * With `board`: the middle button pans and the left one draws a selection
 * box; right-click opens the selection's or a group's menu; groups frame
 * their cards and move them as one until opened (double-click).
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
  onNoteResize,
  renderToolbar,
  onArrowAdd,
  onArrowChange,
  onArrowsDelete,
  renderArrowToolbar,
  board,
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
  onNoteResize?: (id: string, size: { w: number; h: number }) => void;
  renderToolbar?: (card: CanvasCard) => React.ReactNode;
  /** With these, cards show dots to drag arrows between them (Boards). */
  onArrowAdd?: (from: string, to: string, sides: { fromSide?: ArrowSide; toSide?: ArrowSide }) => void;
  onArrowChange?: (id: string, patch: Partial<BoardArrow>) => void;
  onArrowsDelete?: (ids: string[]) => void;
  renderArrowToolbar?: (arrow: BoardArrow, editLabel: () => void) => React.ReactNode;
  board?: BoardActions;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const t = useT("relations");
  const draggable = Boolean(onMoved);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(cards.map((c) => toNode(c, draggable)));
  const [hovered, setHovered] = useState<string | null>(null);
  const [selectedArrow, setSelectedArrow] = useState<string | null>(null);
  const [editingArrow, setEditingArrow] = useState<string | null>(null);
  const groups = board?.groups ?? NO_GROUPS;
  /** The group whose cards can be edited one by one (double-clicked). */
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<ReadonlySet<string>>(new Set());
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [menu, setMenu] = useState<ContextMenu | null>(null);
  /** While a selection box is drawn: it takes the cards inside it, never whole frames. */
  const [boxing, setBoxing] = useState(false);
  /** A closed group's cards the selection box touches: they stand for their group, which is what gets selected. */
  const [boxedMembers, setBoxedMembers] = useState<ReadonlySet<string>>(new Set());
  /** While an arrow is drawn: every card shows its dots, inside groups or not. */
  const [connecting, setConnecting] = useState(false);
  /** While frames are dragged: where each started and where its cards were. */
  const groupDrag = useRef<Map<string, { start: Point; members: Map<string, Point> }>>(new Map());

  // New cards: keep each existing card's React Flow state (selection), take the new contents and positions.
  const [prevCards, setPrevCards] = useState(cards);
  if (cards !== prevCards) {
    setPrevCards(cards);
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      return cards.map((c) => {
        const old = byId.get(c.id);
        if (!old) return toNode(c, draggable);
        // A resized note gives its size back to the card (width, min height), so it can grow with its text again.
        const next = { ...old, position: c.position, data: { card: c } };
        return c.kind === "note" ? { ...next, width: undefined, height: undefined } : next;
      });
    });
  }

  // Esc closes the open group.
  useEffect(() => {
    if (!openGroup) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenGroup(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openGroup]);

  const lit = hovered ?? highlightId;
  const litGroup = lit && isGroupNodeId(lit) ? groups.find((g) => g.id === groupIdOf(lit)) : undefined;
  /** What the hovered item lights: a card, or a group's cards. */
  const focus = useMemo(() => (litGroup ? new Set(litGroup.members) : lit ? new Set([lit]) : null), [lit, litGroup]);
  const neighbors = useMemo(() => {
    if (!lit || !focus) return null;
    const set = new Set(focus);
    if (litGroup) return set.add(lit);
    for (const l of lines) {
      const [a, b] = lineEnds(l);
      if (a === lit) set.add(b);
      if (b === lit) set.add(a);
    }
    return set;
  }, [lit, litGroup, focus, lines]);

  const edges = useMemo(
    () =>
      lines.map((l) => {
        const [a, b] = lineEnds(l);
        const touches = Boolean(focus) && (focus!.has(a) || focus!.has(b));
        const state: LineState = !lit ? "normal" : touches ? "lit" : "dim";
        const edge = toFlowEdge(l, attitudeMode, state, lines.length <= ALWAYS_LABEL_MAX ? state !== "dim" : touches);
        return l.kind === "arrow" ? { ...edge, selected: edge.id === selectedArrow } : edge;
      }),
    [lines, attitudeMode, lit, focus, selectedArrow]
  );
  // One arrow per pair of cards (either way), never from a card to itself.
  const arrowPairs = useMemo(() => new Set(lines.flatMap((l) => (l.kind === "arrow" ? [[l.arrow.from, l.arrow.to].sort().join("|")] : []))), [lines]);
  // The arrow being re-pinned may keep its own pair of cards.
  const reconnecting = useRef<string | null>(null);
  const canConnect = (c: Connection | Edge) => {
    if (c.source === c.target) return false;
    const pair = [c.source, c.target].sort().join("|");
    const own = lines.find((l) => l.kind === "arrow" && l.arrow.id === reconnecting.current);
    return !arrowPairs.has(pair) || (own?.kind === "arrow" && [own.arrow.from, own.arrow.to].sort().join("|") === pair);
  };
  const sidesOf = (c: Connection) => ({
    fromSide: isArrowSide(c.sourceHandle) ? c.sourceHandle : undefined,
    toSide: isArrowSide(c.targetHandle) ? c.targetHandle : undefined,
  });

  // ---- Groups: frames around their cards; a closed group's cards are reached through the frame ----
  const groupOf = useMemo(() => new Map(groups.flatMap((g) => g.members.map((m) => [m, g.id] as const))), [groups]);
  const locked = (id: string) => {
    const g = groupOf.get(id);
    return g !== undefined && g !== openGroup;
  };
  const groupNodes = useMemo<GroupFlowNode[]>(() => {
    const byId = new Map<string, Node>(nodes.map((n) => [n.id, n]));
    return groups.flatMap((group): GroupFlowNode[] => {
      const frame = groupFrame(group, byId);
      if (!frame) return [];
      const id = groupNodeId(group.id);
      const className = litGroup ? (litGroup.id === group.id ? "rel-lit" : "rel-dim") : undefined;
      return [{ id, type: "boardGroup", ...frame, className, data: { group, open: openGroup === group.id }, zIndex: -1, selected: selectedGroups.has(group.id) || group.members.some((m) => boxedMembers.has(m)), selectable: !boxing }];
    });
  }, [groups, nodes, openGroup, selectedGroups, litGroup, boxing, boxedMembers]);

  const shownNodes = useMemo<AnyNode[]>(() => {
    const cardNodes = nodes.map((n): FlowNode => {
      const inClosedGroup = locked(n.id);
      const className =
        [neighbors && (neighbors.has(n.id) ? "rel-lit" : "rel-dim"), inClosedGroup && "rel-in-group", litGroup?.members.includes(n.id) && "rel-group-hover"].filter(Boolean).join(" ") || undefined;
      // React Flow sets pointer-events inline, so only `style` can turn them off: clicks and drags reach the frame.
      if (inClosedGroup) return { ...n, className, draggable: false, selected: boxedMembers.has(n.id), style: { ...n.style, pointerEvents: "none" } };
      return className ? { ...n, className } : n;
    });
    return [...groupNodes, ...cardNodes];
    // locked() reads groupOf and openGroup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, neighbors, groupNodes, groupOf, openGroup, litGroup, boxedMembers]);

  /** Group frames' selection is kept here (they aren't in the card nodes); the rest goes to React Flow. */
  const handleNodesChange = (changes: NodeChange<AnyNode>[]) => {
    const framed = changes.filter((c) => "id" in c && isGroupNodeId(c.id));
    if (framed.length) {
      setSelectedGroups((prev) => {
        const next = new Set(prev);
        for (const c of framed) {
          if (c.type !== "select") continue;
          if (c.selected) next.add(groupIdOf(c.id));
          else next.delete(groupIdOf(c.id));
        }
        return next;
      });
    }
    // A closed group's cards are never selected themselves: the box marks them, and their group is selected instead.
    const boxed = changes.filter((c) => c.type === "select" && locked(c.id));
    if (boxed.length && boxing) {
      setBoxedMembers((prev) => {
        const next = new Set(prev);
        for (const c of boxed) {
          if (c.type !== "select") continue;
          if (c.selected) next.add(c.id);
          else next.delete(c.id);
        }
        return next;
      });
    }
    onNodesChange(changes.filter((c) => !("id" in c && (isGroupNodeId(c.id) || (c.type === "select" && locked(c.id))))) as NodeChange<FlowNode>[]);
  };

  /** The cards a menu acts on: those selected, plus the cards of selected groups. */
  const selectionCards = (picked: AnyNode[]) =>
    [...new Set(picked.flatMap((n) => (isGroupNodeId(n.id) ? (groups.find((g) => g.id === groupIdOf(n.id))?.members ?? []) : [n.id])))];
  const touchesArrow = (ids: string[]) => lines.some((l) => l.kind === "arrow" && (ids.includes(l.arrow.from) || ids.includes(l.arrow.to)));

  const menuActions = (m: ContextMenu): MenuAction[] => {
    if (!board) return [];
    if (m.kind === "group") {
      return [
        { key: "rename", label: t("boards.group.rename"), Icon: Pencil, onSelect: () => setEditingGroup(m.id) },
        { key: "ungroup", label: t("boards.group.ungroup"), Icon: Ungroup, onSelect: () => board.onUngroup(m.id) },
        { key: "delete", label: t("boards.group.delete"), Icon: Trash2, danger: true, onSelect: () => board.onDeleteItems([], [m.id], []) },
      ];
    }
    return [
      { key: "group", label: t("boards.selection.group"), Icon: Group, onSelect: () => board.onGroup(m.ids) },
      { key: "unlink", label: t("boards.selection.unlink"), Icon: Unlink, disabled: !touchesArrow(m.ids), onSelect: () => board.onUnlink(m.ids) },
      { key: "delete", label: t("boards.selection.delete"), Icon: Trash2, danger: true, onSelect: () => board.onDeleteItems(m.ids, [], []) },
    ];
  };

  const arrows = Boolean(onArrowAdd);
  const ui = useMemo<CanvasUi>(
    () => ({
      renderToolbar,
      onNoteText,
      onNoteResize,
      connectable: arrows,
      renderArrowToolbar,
      onArrowLabel: onArrowChange ? (id, label) => onArrowChange(id, { label: label || undefined }) : undefined,
      editingArrow,
      setEditingArrow,
      editingGroup,
      setEditingGroup,
      onGroupRename: board?.onGroupRename,
    }),
    [renderToolbar, onNoteText, onNoteResize, arrows, renderArrowToolbar, onArrowChange, editingArrow, editingGroup, board?.onGroupRename]
  );

  const closeMenu = useCallback(() => setMenu(null), []);
  const closeOpenGroupUnless = (groupId: string | undefined) => openGroup && openGroup !== groupId && setOpenGroup(null);

  return (
    <CanvasUiContext.Provider value={ui}>
      <ReactFlow<AnyNode, Edge>
        nodes={shownNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onNodeDragStart={(_e, _n, dragged) => {
          groupDrag.current = new Map();
          for (const n of dragged) {
            const group = isGroupNodeId(n.id) ? groups.find((g) => g.id === groupIdOf(n.id)) : undefined;
            if (!group) continue;
            const members = new Map(nodes.filter((c) => group.members.includes(c.id)).map((c) => [c.id, c.position]));
            groupDrag.current.set(n.id, { start: n.position, members });
          }
        }}
        onNodeDrag={(_e, _n, dragged) => {
          if (!groupDrag.current.size) return;
          const moved = new Map<string, Point>();
          for (const n of dragged) {
            const d = groupDrag.current.get(n.id);
            if (!d) continue;
            const dx = n.position.x - d.start.x;
            const dy = n.position.y - d.start.y;
            for (const [id, p] of d.members) moved.set(id, { x: p.x + dx, y: p.y + dy });
          }
          setNodes((prev) => prev.map((c) => (moved.has(c.id) ? { ...c, position: moved.get(c.id)! } : c)));
        }}
        onNodeDragStop={
          onMoved
            ? (_e, _n, dragged) => {
                const moves: Record<string, Point> = {};
                for (const n of dragged) {
                  const d = groupDrag.current.get(n.id);
                  if (!d) {
                    if (!isGroupNodeId(n.id)) moves[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
                    continue;
                  }
                  const dx = n.position.x - d.start.x;
                  const dy = n.position.y - d.start.y;
                  for (const [id, p] of d.members) moves[id] = { x: Math.round(p.x + dx), y: Math.round(p.y + dy) };
                }
                groupDrag.current = new Map();
                onMoved(moves);
              }
            : undefined
        }
        onNodeClick={(event, node) => {
          setSelectedArrow(null);
          setMenu(null);
          if (isGroupNodeId(node.id)) {
            closeOpenGroupUnless(groupIdOf(node.id));
            return onSelect?.(null);
          }
          closeOpenGroupUnless(groupOf.get(node.id));
          const card = (node as FlowNode).data.card;
          if (card.kind === "record" && event.shiftKey && onFocus) return onFocus(card.id);
          if (onSelect) return onSelect(card.kind === "union" ? null : node.id);
          if (card.kind === "record") onOpen?.(card.entry);
        }}
        onNodeDoubleClick={(_e, node) => {
          if (isGroupNodeId(node.id)) {
            setOpenGroup(groupIdOf(node.id));
            setSelectedGroups(new Set());
            return;
          }
          const card = (node as FlowNode).data.card;
          if (card.kind === "record") onOpen?.(card.entry);
        }}
        onNodeMouseEnter={(_e, node) => (isGroupNodeId(node.id) || (node as FlowNode).data.card.kind !== "union") && setHovered(node.id)}
        onNodeMouseLeave={() => setHovered(null)}
        onPaneClick={() => {
          setSelectedArrow(null);
          setOpenGroup(null);
          setMenu(null);
          onSelect?.(null);
        }}
        onNodeContextMenu={
          board
            ? (e, node) => {
                e.preventDefault();
                if (isGroupNodeId(node.id)) return setMenu({ kind: "group", id: groupIdOf(node.id), x: e.clientX, y: e.clientY });
                const picked = [...shownNodes.filter((n) => n.selected)];
                let ids = selectionCards(picked);
                if (!ids.includes(node.id)) {
                  // Right-clicking an unselected card acts on it alone.
                  ids = [node.id];
                  setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === node.id })));
                  setSelectedGroups(new Set());
                }
                setMenu({ kind: "cards", ids, x: e.clientX, y: e.clientY });
              }
            : undefined
        }
        onSelectionStart={() => setBoxing(true)}
        onSelectionEnd={() => {
          setBoxing(false);
          // The groups the box touched stay selected (as frames); their cards don't.
          setSelectedGroups((prev) => new Set([...prev, ...groups.filter((g) => g.members.some((m) => boxedMembers.has(m))).map((g) => g.id)]));
          setBoxedMembers(new Set());
        }}
        onSelectionContextMenu={
          board
            ? (e, picked) => {
                e.preventDefault();
                const ids = selectionCards(picked);
                if (ids.length) setMenu({ kind: "cards", ids, x: e.clientX, y: e.clientY });
              }
            : undefined
        }
        onPaneContextMenu={
          board
            ? (e) => {
                e.preventDefault();
                setMenu(null);
              }
            : undefined
        }
        onEdgeClick={(_e, edge) => {
          if (edge.type !== "arrow") return;
          setSelectedArrow(edge.id);
          onSelect?.(null);
        }}
        onEdgeDoubleClick={(_e, edge) => edge.type === "arrow" && onArrowChange && setEditingArrow(edge.id)}
        className={connecting ? "rel-connecting" : undefined}
        onConnectStart={() => setConnecting(true)}
        onConnectEnd={() => setConnecting(false)}
        onConnect={onArrowAdd ? (c) => canConnect(c) && onArrowAdd(c.source, c.target, sidesOf(c)) : undefined}
        isValidConnection={canConnect}
        onReconnectStart={(_e, edge) => (reconnecting.current = edge.id)}
        onReconnectEnd={() => (reconnecting.current = null)}
        onReconnect={onArrowChange ? (old, c) => canConnect(c) && onArrowChange(old.id, { from: c.source, to: c.target, ...sidesOf(c) }) : undefined}
        // A board deletes everything selected in one go (cards, frames with their cards, arrows).
        onDelete={
          board
            ? ({ nodes: gone, edges: cut }) =>
                board.onDeleteItems(
                  gone.filter((n) => !isGroupNodeId(n.id)).map((n) => n.id),
                  gone.filter((n) => isGroupNodeId(n.id)).map((n) => groupIdOf(n.id)),
                  cut.filter((e) => e.type === "arrow").map((e) => e.id)
                )
            : undefined
        }
        onEdgesDelete={!board && onArrowsDelete ? (deleted) => onArrowsDelete(deleted.filter((e) => e.type === "arrow").map((e) => e.id)) : undefined}
        onNodesDelete={!board && onDelete ? (deleted) => onDelete(deleted.map((n) => n.id)) : undefined}
        deleteKeyCode={onDelete || board ? ["Delete", "Backspace"] : null}
        nodesConnectable={arrows}
        edgesReconnectable={Boolean(onArrowChange)}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={40}
        connectionLineStyle={{ stroke: "var(--teal-400)", strokeWidth: 2, strokeDasharray: "6 4" }}
        // Boards: the middle button pans, the left one draws a selection box.
        panOnDrag={board ? [1] : true}
        selectionOnDrag={Boolean(board)}
        selectionMode={SelectionMode.Partial}
        elevateNodesOnSelect={!board}
        // Middle-click would start the browser's autoscroll.
        onMouseDown={board ? (e) => e.button === 1 && e.preventDefault() : undefined}
        zoomOnDoubleClick={false}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
        minZoom={0.1}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#34383e" />
        {!compact && <Controls showInteractive={false} position="top-left" />}
        {!compact && <MiniMap<AnyNode> pannable zoomable nodeColor={miniColor} nodeStrokeWidth={0} nodeBorderRadius={6} maskColor="rgba(13, 14, 16, 0.6)" />}
        {children}
      </ReactFlow>
      {menu && (
        <BoardContextMenu
          x={menu.x}
          y={menu.y}
          label={menu.kind === "group" ? t("boards.group.menu") : t("boards.selection.menu")}
          actions={menuActions(menu)}
          onClose={closeMenu}
        />
      )}
    </CanvasUiContext.Provider>
  );
}
