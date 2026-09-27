"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight, Compass, Folder, FolderOpen, FolderPlus, Plus, Settings } from "lucide-react";
import type { TreeEntry } from "./map-tree";
import type { FolderSummary, MapSummary } from "./types";

type Entry = TreeEntry<MapSummary, FolderSummary>;
/** What's being dragged: a map or a folder. */
export type DragItem = { kind: "map" | "folder"; id: string };
/** Where a drop lands: the root, into a folder, or onto a map (making the dragged map its child). */
export type DropTarget = { kind: "root" } | { kind: "folder"; id: string } | { kind: "map"; id: string };
const targetKey = (t: DropTarget) => (t.kind === "root" ? "root" : `${t.kind}:${t.id}`);

const DRAG_TYPE = "application/x-world-wiki-map-item";

export interface MapsSidebarActions {
  onNewMap: () => void;
  onNewFolder: () => void;
  onFolderSettings: (entry: Entry) => void;
  onMapSettings: (map: MapSummary) => void;
  /** Drop `item` on `target`. The caller confirms hierarchy changes and refuses invalid moves. */
  onMove: (item: DragItem, target: DropTarget) => void;
  /** Pointer entered (id) or left (null) a map row — drives the preview. */
  onHoverMap: (id: string | null) => void;
  onToggleFolder: (id: string) => void;
  onToggleMap: (id: string) => void;
}

function readDrag(e: React.DragEvent): DragItem | null {
  try {
    const parsed = JSON.parse(e.dataTransfer.getData(DRAG_TYPE));
    return parsed && (parsed.kind === "map" || parsed.kind === "folder") && typeof parsed.id === "string" ? parsed : null;
  } catch {
    return null;
  }
}

const isOurDrag = (e: React.DragEvent) => e.dataTransfer.types.includes(DRAG_TYPE);

function RowAction({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={danger ? "maps-row-action danger" : "maps-row-action"}
      aria-label={label}
      data-tooltip={label}
      onClick={(e) => {
        e.preventDefault(); // inside a map row's link area
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

/**
 * The Maps left bar: search, the folder + map tree (drag maps and folders
 * into folders, a map onto another map to nest it, or onto empty space for
 * the root), and New Map / Create folder at the bottom. Hovering a row
 * shows its Settings button.
 */
export default function MapsSidebar({
  tree,
  searching,
  query,
  onQueryChange,
  openFolders,
  collapsedMaps,
  settingsFor,
  actions,
}: {
  tree: Entry[];
  searching: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  openFolders: Set<string>;
  collapsedMaps: Set<string>;
  /** The folder or map whose settings panel is open (highlighted). */
  settingsFor: string | null;
  actions: MapsSidebarActions;
}) {
  const [dragging, setDragging] = useState<DragItem | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);

  function dragProps(item: DragItem) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(item));
        setDragging(item);
        actions.onHoverMap(null);
      },
      onDragEnd: () => {
        setDragging(null);
        setDropKey(null);
      },
    };
  }

  /**
   * Makes an element a drop zone for `target`. `accepts` narrows what it takes
   * (a map row only takes other maps); anything else bubbles to the folder or root around it.
   */
  function dropProps(target: DropTarget, accepts: (item: DragItem) => boolean = () => true) {
    const key = targetKey(target);
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!isOurDrag(e) || !dragging || !accepts(dragging)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        if (dropKey !== key) setDropKey(key);
      },
      onDrop: (e: React.DragEvent) => {
        const item = readDrag(e);
        if (!item || !accepts(item)) return;
        e.preventDefault();
        e.stopPropagation();
        setDragging(null);
        setDropKey(null);
        actions.onMove(item, target);
      },
    };
  }

  function renderEntry(entry: Entry): React.ReactNode {
    if (entry.kind === "folder") {
      const folder = entry.item;
      const open = searching || openFolders.has(folder.id);
      const rowClass = [
        "maps-row",
        "maps-folder-row",
        dropKey === `folder:${folder.id}` && "drop-target",
        dragging?.id === folder.id && "dragging",
        settingsFor === folder.id && "active",
      ]
        .filter(Boolean)
        .join(" ");
      const tint = folder.color ? { color: folder.color } : undefined;
      return (
        // The whole folder (row + contents) takes drops, so dropping between its items files into it.
        <li key={folder.id} {...dropProps({ kind: "folder", id: folder.id })}>
          <div className={rowClass} {...dragProps({ kind: "folder", id: folder.id })}>
            {/* Same slot a map's expand toggle takes, so folder and map icons line up at each depth. */}
            <span className="maps-row-toggle" aria-hidden />
            <button type="button" className="maps-row-main" aria-expanded={open} onClick={() => actions.onToggleFolder(folder.id)}>
              {open ? <FolderOpen size={15} strokeWidth={2.25} aria-hidden style={tint} /> : <Folder size={15} strokeWidth={2.25} aria-hidden style={tint} />}
              <span className="maps-row-name">
                {folder.name} ({entry.children.length})
              </span>
            </button>
            <span className="maps-row-actions">
              <RowAction label={`${folder.name} settings`} onClick={() => actions.onFolderSettings(entry)}>
                <Settings size={13} strokeWidth={2.25} />
              </RowAction>
            </span>
          </div>
          {open && (
            <ul className="maps-tree-children">
              {entry.children.map(renderEntry)}
              {entry.children.length === 0 && <li className="field-label maps-tree-empty">Empty — drag maps here.</li>}
            </ul>
          )}
        </li>
      );
    }

    const map = entry.item;
    const hasChildren = entry.children.length > 0;
    const expanded = searching || !collapsedMaps.has(map.id);
    return (
      <li key={map.id}>
        <div
          className={[
            "maps-row",
            "maps-map-row",
            dragging?.id === map.id && "dragging",
            dropKey === `map:${map.id}` && "drop-target",
            settingsFor === map.id && "active",
          ]
            .filter(Boolean)
            .join(" ")}
          {...dragProps({ kind: "map", id: map.id })}
          {...dropProps({ kind: "map", id: map.id }, (item) => item.kind === "map" && item.id !== map.id)}
          onMouseEnter={() => actions.onHoverMap(map.id)}
          onMouseLeave={() => actions.onHoverMap(null)}
        >
          {hasChildren ? (
            <button
              type="button"
              className="maps-row-toggle"
              aria-label={expanded ? `Collapse ${map.name}` : `Expand ${map.name}`}
              aria-expanded={expanded}
              onClick={() => actions.onToggleMap(map.id)}
            >
              {expanded ? <ChevronDown size={13} strokeWidth={2.5} /> : <ChevronRight size={13} strokeWidth={2.5} />}
            </button>
          ) : (
            <span className="maps-row-toggle" aria-hidden />
          )}
          <Link href={`/maps/${map.id}`} className="maps-row-main" draggable={false}>
            <Compass size={15} strokeWidth={2.25} aria-hidden />
            <span className="maps-row-name">{map.name}</span>
            {map.assetState && map.assetState !== "ready" && <span className="map-pill-tag warn">{map.assetState}</span>}
          </Link>
          <span className="maps-row-actions">
            <RowAction label={`${map.name} settings`} onClick={() => actions.onMapSettings(map)}>
              <Settings size={13} strokeWidth={2.25} />
            </RowAction>
          </span>
        </div>
        {hasChildren && expanded && <ul className="maps-tree-children">{entry.children.map(renderEntry)}</ul>}
      </li>
    );
  }

  return (
    <aside className="articles-sidebar maps-sidebar" aria-label="Maps">
      <input type="search" placeholder="Search maps and folders…" aria-label="Search maps and folders" value={query} onChange={(e) => onQueryChange(e.target.value)} />

      {/* Empty space here is the root drop zone. */}
      <nav
        className={dropKey === "root" ? "maps-tree drop-target" : "maps-tree"}
        {...dropProps({ kind: "root" })}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropKey(null)}
      >
        <ul className="maps-tree-root">{tree.map(renderEntry)}</ul>
        {tree.length === 0 && <p className="field-label">{searching ? <>Nothing matches &ldquo;{query.trim()}&rdquo;.</> : "No maps yet."}</p>}
        {dragging && (
          <p className="field-label maps-tree-drop-hint">
            Drop on a folder to file it there{dragging.kind === "map" ? ", on a map to nest it," : ""} or here for the root.
          </p>
        )}
      </nav>

      <div className="maps-sidebar-footer">
        <button type="button" className="articles-folder articles-create" onClick={actions.onNewMap}>
          <Plus size={16} strokeWidth={2.25} aria-hidden />
          <span className="articles-folder-name">New Map</span>
        </button>
        <button type="button" className="articles-folder maps-create-folder" onClick={actions.onNewFolder}>
          <FolderPlus size={16} strokeWidth={2.25} aria-hidden />
          <span className="articles-folder-name">Create folder</span>
        </button>
      </div>
    </aside>
  );
}
