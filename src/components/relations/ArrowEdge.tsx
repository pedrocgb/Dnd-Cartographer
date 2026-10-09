"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getStraightPath, Position, useInternalNode, type Edge, type EdgeProps, type InternalNode } from "@xyflow/react";
import { MAX_ARROW_LABEL, type BoardArrow } from "@/server/relations/boards";
import { useT } from "@/i18n/useT";
import { CanvasUiContext } from "./canvas-ui";

export type ArrowFlowEdge = Edge<{ arrow: BoardArrow }, "arrow">;

/**
 * Where the line from `node`'s center toward `other`'s center leaves `node`'s
 * box (React Flow's floating-edges example), so arrows follow cards as they move.
 */
function borderPoint(node: InternalNode, other: InternalNode) {
  const w = (node.measured.width ?? 0) / 2;
  const h = (node.measured.height ?? 0) / 2;
  const cx = node.internals.positionAbsolute.x + w;
  const cy = node.internals.positionAbsolute.y + h;
  const ox = other.internals.positionAbsolute.x + (other.measured.width ?? 0) / 2;
  const oy = other.internals.positionAbsolute.y + (other.measured.height ?? 0) / 2;
  if (!w || !h) return { x: cx, y: cy };
  const xx1 = (ox - cx) / (2 * w) - (oy - cy) / (2 * h);
  const yy1 = (ox - cx) / (2 * w) + (oy - cy) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  return { x: w * (xx3 + yy3) + cx, y: h * (-xx3 + yy3) + cy };
}

/** How far a card's dots sit outside its edge (`.rel-connect-dot` in globals.css). */
const DOT_OFFSET = 9;

/** A dot's center moved back onto the card's edge, so the arrow touches the card. */
function onEdge(x: number, y: number, side: Position) {
  if (side === Position.Top) return { x, y: y + DOT_OFFSET };
  if (side === Position.Bottom) return { x, y: y - DOT_OFFSET };
  if (side === Position.Left) return { x: x + DOT_OFFSET, y };
  return { x: x - DOT_OFFSET, y };
}

/**
 * A user-drawn board arrow: a curve between the dots it was drawn from and
 * to (or, for an older arrow without them, a straight line between the cards' borders),
 * its label in the middle (double-click to write it) and, when selected,
 * its toolbar above.
 */
export default function ArrowEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerStart, markerEnd, style, selected, data }: EdgeProps<ArrowFlowEdge>) {
  const t = useT("relations");
  const from = useInternalNode(source);
  const to = useInternalNode(target);
  const { renderArrowToolbar, onArrowLabel, editingArrow, setEditingArrow } = useContext(CanvasUiContext);
  const arrow = data?.arrow;
  const editing = editingArrow === id && Boolean(onArrowLabel);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Editing starts from the current label.
  const [wasEditing, setWasEditing] = useState(editing);
  if (editing !== wasEditing) {
    setWasEditing(editing);
    if (editing) setDraft(arrow?.label ?? "");
  }
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!from || !to || !arrow) return null;
  const pinned = Boolean(arrow.fromSide && arrow.toSide);
  const start = pinned ? onEdge(sourceX, sourceY, sourcePosition) : borderPoint(from, to);
  const end = pinned ? onEdge(targetX, targetY, targetPosition) : borderPoint(to, from);
  const ends = { sourceX: start.x, sourceY: start.y, targetX: end.x, targetY: end.y };
  const [path, labelX, labelY] = pinned ? getBezierPath({ ...ends, sourcePosition, targetPosition }) : getStraightPath(ends);

  const stop = () => setEditingArrow?.(null);
  const commit = () => {
    if (draft.trim() !== (arrow.label ?? "")) onArrowLabel?.(arrow.id, draft.trim());
    stop();
  };
  const toolbar = selected && !editing ? renderArrowToolbar?.(arrow, () => setEditingArrow?.(id)) : null;

  return (
    <>
      <BaseEdge id={id} path={path} markerStart={markerStart} markerEnd={markerEnd} style={style} interactionWidth={18} />
      {(arrow.label || editing || toolbar) && (
        <EdgeLabelRenderer>
          <div
            className={toolbar || editing ? "rel-arrow-label-box rel-arrow-label-front nodrag nopan" : "rel-arrow-label-box nodrag nopan"}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onDoubleClick={(e) => {
              if (!onArrowLabel) return;
              e.stopPropagation();
              setEditingArrow?.(id);
            }}
          >
            {toolbar && <div className="rel-float-toolbar rel-arrow-toolbar">{toolbar}</div>}
            {editing ? (
              <input
                ref={inputRef}
                className="rel-arrow-label rel-arrow-input"
                value={draft}
                maxLength={MAX_ARROW_LABEL}
                size={Math.max(8, draft.length + 1)}
                aria-label={t("canvas.arrowLabel")}
                placeholder={t("boards.arrow.labelPlaceholder")}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") {
                    e.preventDefault();
                    stop();
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    commit();
                  }
                }}
              />
            ) : (
              arrow.label && <span className="rel-arrow-label">{arrow.label}</span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
