"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, GripVertical, Plus } from "lucide-react";
import { moveNode, outlineTree, type OutlineTreeNode } from "@/server/writer/logic";
import type { OutlineMove } from "@/server/writer/parse";
import { beatOf } from "@/server/writer/templates";
import { CHILD_KIND, NODE_KIND_LABELS, NODE_STATUS_LABELS, type NodeKind, type OutlineNode } from "@/server/writer/types";

type Where = "before" | "after" | "inside";

/** A parent's children in outline order, without `excludeId`. */
const childrenOf = (nodes: OutlineNode[], parentId: string | null, excludeId?: string) =>
  nodes.filter((n) => n.parentId === parentId && n.id !== excludeId).sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

/**
 * The story outline (a binder): arcs > chapters > scenes. Drag an item to
 * reorder it or move it into another arc or chapter; Alt+↑/↓ moves the
 * focused item among its siblings. Each row shows its status as a dot.
 */
export default function OutlineTree({
  nodes,
  selectedId,
  onSelect,
  onAdd,
  onMove,
}: {
  nodes: OutlineNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (kind: NodeKind, parentId: string | null) => void;
  onMove: (moves: OutlineMove[]) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; where: Where } | null>(null);
  const dragged = nodes.find((n) => n.id === dragId) ?? null;

  const toggle = (id: string) =>
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Where the dragged item would land over `target`, from the pointer's height in the row. */
  function whereOver(target: OutlineNode, event: React.DragEvent): Where | null {
    if (!dragged || dragged.id === target.id) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    if (CHILD_KIND[target.kind] === dragged.kind) return "inside";
    if (target.kind !== dragged.kind) return null;
    return ratio < 0.5 ? "before" : "after";
  }

  function dropOn(target: OutlineNode, where: Where) {
    if (!dragged) return;
    const moves =
      where === "inside"
        ? moveNode(nodes, dragged.id, target.id, Number.MAX_SAFE_INTEGER)
        : moveNode(nodes, dragged.id, target.parentId, childrenOf(nodes, target.parentId, dragged.id).findIndex((n) => n.id === target.id) + (where === "after" ? 1 : 0));
    if (moves) onMove(moves);
    if (where === "inside") setCollapsed((set) => new Set([...set].filter((id) => id !== target.id)));
  }

  function onKey(node: OutlineNode, event: React.KeyboardEvent) {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const index = childrenOf(nodes, node.parentId).findIndex((n) => n.id === node.id);
    const moves = moveNode(nodes, node.id, node.parentId, index + (event.key === "ArrowUp" ? -1 : 1));
    if (moves) onMove(moves);
  }

  const renderList = (list: OutlineTreeNode<OutlineNode>[], depth: number): React.ReactNode => (
    <ul className={depth === 0 ? "wr-tree" : "wr-tree-children"} role={depth === 0 ? "tree" : "group"} aria-label={depth === 0 ? "Story outline" : undefined}>
      {list.map(({ node, children }) => {
        const childKind = CHILD_KIND[node.kind];
        const open = !collapsed.has(node.id);
        const beat = node.parentId ? beatOf(nodes.find((n) => n.id === node.parentId)?.beatTemplate, node.beatKey) : null;
        const dropClass = drop?.id === node.id ? ` wr-drop-${drop.where}` : "";
        return (
          <li key={node.id} role="treeitem" aria-expanded={childKind ? open : undefined} aria-selected={node.id === selectedId}>
            <div
              className={`wr-row wr-row-${node.kind}${node.id === selectedId ? " active" : ""}${node.id === dragId ? " dragging" : ""}${dropClass}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", node.id);
                setDragId(node.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDrop(null);
              }}
              onDragOver={(e) => {
                const where = whereOver(node, e);
                if (!where) return;
                e.preventDefault();
                if (drop?.id !== node.id || drop.where !== where) setDrop({ id: node.id, where });
              }}
              onDragLeave={() => drop?.id === node.id && setDrop(null)}
              onDrop={(e) => {
                e.preventDefault();
                const where = whereOver(node, e);
                setDrop(null);
                setDragId(null);
                if (where) dropOn(node, where);
              }}
            >
              <GripVertical size={12} className="wr-grip" aria-hidden />
              {childKind ? (
                <button type="button" className="wr-toggle" aria-label={open ? `Collapse ${node.title}` : `Expand ${node.title}`} onClick={() => toggle(node.id)}>
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span className="wr-toggle" aria-hidden />
              )}
              <span className={`wr-dot wr-dot-${node.status}`} data-tooltip={NODE_STATUS_LABELS[node.status]} aria-label={NODE_STATUS_LABELS[node.status]} role="img" />
              <button type="button" className="wr-row-title" onClick={() => onSelect(node.id)} onKeyDown={(e) => onKey(node, e)} data-tooltip={beat ? `${NODE_KIND_LABELS[node.kind]} · beat: ${beat.name}` : NODE_KIND_LABELS[node.kind]}>
                {node.title}
              </button>
              {childKind && (
                <button type="button" className="btn btn-ghost btn-icon btn-sm wr-row-add" aria-label={`Add a ${NODE_KIND_LABELS[childKind].toLowerCase()} to ${node.title}`} data-tooltip={`Add ${NODE_KIND_LABELS[childKind].toLowerCase()}`} onClick={() => onAdd(childKind, node.id)}>
                  <Plus size={13} />
                </button>
              )}
            </div>
            {childKind && open && children.length > 0 && renderList(children, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  const tree = outlineTree(nodes);
  if (tree.length === 0) return <p className="cal-help">No arcs yet.</p>;
  return (
    <>
      {renderList(tree, 0)}
      <p className="cal-help wr-tree-hint">Drag to reorder · Alt+↑/↓ to move</p>
    </>
  );
}
