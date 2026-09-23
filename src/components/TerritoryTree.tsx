"use client";

import { ChevronRight, ChevronDown } from "lucide-react";

export interface TerritoryTreeItem {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
}

export interface TerritoryNode extends TerritoryTreeItem {
  children: TerritoryNode[];
}

export function buildTerritoryTree<T extends TerritoryTreeItem>(list: T[]): (T & { children: TerritoryNode[] })[] {
  const byId = new Map<string, T & { children: TerritoryNode[] }>(list.map((t) => [t.id, { ...t, children: [] }]));
  const roots: (T & { children: TerritoryNode[] })[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** `item`'s ancestors in `list`, root → immediate parent (excluding `item`). Stops at a missing parent or a cycle. */
export function ancestorsOf<T extends TerritoryTreeItem>(item: Pick<TerritoryTreeItem, "parentId">, list: T[]): T[] {
  const byId = new Map(list.map((t) => [t.id, t]));
  const ancestors: T[] = [];
  const seen = new Set<string>();
  let parent = item.parentId ? byId.get(item.parentId) : undefined;
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    ancestors.unshift(parent);
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return ancestors;
}

export function TerritoryTreeRow({
  node,
  depth,
  expanded,
  onToggleExpand,
  onSelect,
  selectedId,
}: {
  node: TerritoryNode;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId?: string | null;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  return (
    <>
      <li className="politics-list-row politics-tree-row" style={{ paddingLeft: depth * 18 }}>
        {hasChildren ? (
          <button
            type="button"
            className="politics-tree-toggle"
            onClick={() => onToggleExpand(node.id)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
          </button>
        ) : (
          <span className="politics-tree-spacer" />
        )}
        <button
          type="button"
          className={node.id === selectedId ? "politics-list-pick selected" : "politics-list-pick"}
          onClick={() => onSelect(node.id)}
        >
          {node.name} <span className="field-label">({node.type})</span>
        </button>
      </li>
      {hasChildren &&
        isExpanded &&
        node.children.map((child) => (
          <TerritoryTreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            onSelect={onSelect}
            selectedId={selectedId}
          />
        ))}
    </>
  );
}
