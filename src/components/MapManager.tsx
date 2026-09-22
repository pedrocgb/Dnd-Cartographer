"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, MapPlus, Trash2 } from "lucide-react";
import Modal from "@/components/Modal";

interface MapSummary {
  id: string;
  name: string;
  parentId: string | null;
  categoryLabel: string | null;
  thumbnailKey: string | null;
  currentAssetId: string | null;
  assetState: string | null;
  childCount: number;
}

interface TreeNode extends MapSummary {
  children: TreeNode[];
}

function buildTree(maps: MapSummary[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(maps.map((m) => [m.id, { ...m, children: [] }]));
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function Thumbnail({ node }: { node: MapSummary }) {
  if (node.currentAssetId && node.thumbnailKey) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small local thumbnail, not worth next/image's remote-optimization machinery
      <img src={`/api/thumbnails/${node.currentAssetId}`} alt="" className="map-thumb" />
    );
  }
  return <div className="map-thumb map-thumb-empty" />;
}

function TreeItem({ node, onRequestDelete }: { node: TreeNode; onRequestDelete: (node: MapSummary) => void }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <li>
      <div className="map-tree-row">
        {node.children.length > 0 ? (
          <button
            className="map-tree-toggle"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown size={14} strokeWidth={2.5} /> : <ChevronRight size={14} strokeWidth={2.5} />}
          </button>
        ) : (
          <span className="map-tree-toggle-spacer" />
        )}
        <button
          type="button"
          className="btn btn-ghost btn-icon map-tree-delete"
          onClick={() => onRequestDelete(node)}
          aria-label={`Delete ${node.name}`}
          title={`Delete ${node.name}`}
        >
          <Trash2 size={14} strokeWidth={2.25} />
        </button>
        <Thumbnail node={node} />
        <Link href={`/maps/${node.id}`} className="map-tree-link">
          {node.name}
        </Link>
        {node.categoryLabel && <span className="map-pill-tag">{node.categoryLabel}</span>}
        {node.childCount > 0 && <span className="map-pill-tag">{node.childCount} child{node.childCount === 1 ? "" : "ren"}</span>}
        {node.assetState && node.assetState !== "ready" && <span className="map-pill-tag warn">{node.assetState}</span>}
      </div>
      {expanded && node.children.length > 0 && (
        <ul className="map-tree-children">
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} onRequestDelete={onRequestDelete} />
          ))}
        </ul>
      )}
    </li>
  );
}

function DeleteMapModal({
  map,
  onClose,
  onDeleted,
}: {
  map: MapSummary;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const matches = confirmText === map.name;

  async function removeMap(strategy?: "cascade" | "orphan") {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/maps/${map.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(strategy ? { strategy } : {}),
    });
    if (res.status === 409) {
      const data = await res.json();
      const choice = window.confirm(
        `"${map.name}" has ${data.childCount} child map(s). OK to move them to the root (Cancel to delete the whole subtree instead).`
      );
      await removeMap(choice ? "orphan" : "cascade");
      return;
    }
    setDeleting(false);
    if (!res.ok) {
      setError("Failed to delete map.");
      return;
    }
    onDeleted();
  }

  return (
    <Modal open onClose={onClose} title={`Delete "${map.name}"`}>
      <p className="form-error">
        This permanently removes the map and every marker on it. This cannot be undone from here — type the map&rsquo;s
        name below to confirm.
      </p>
      <label className="field-label">
        Type <strong>{map.name}</strong> to confirm
      </label>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        autoFocus
        placeholder={map.name}
      />
      {error && <p className="form-error">{error}</p>}
      <div className="marker-panel-actions">
        <button type="button" className="btn btn-sm btn-danger" disabled={!matches || deleting} onClick={() => removeMap()}>
          <Trash2 size={13} strokeWidth={2.25} />
          {deleting ? "Deleting…" : "Delete map"}
        </button>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

export default function MapManager() {
  const [maps, setMaps] = useState<MapSummary[] | null>(null);
  const [search, setSearch] = useState("");
  const [deletingMap, setDeletingMap] = useState<MapSummary | null>(null);

  function refresh() {
    fetch("/api/maps")
      .then((r) => r.json())
      .then((d) => setMaps(d.maps));
  }
  useEffect(refresh, []);

  const filtered = useMemo(() => {
    if (!maps) return [];
    if (!search.trim()) return maps;
    const q = search.toLowerCase();
    return maps.filter((m) => m.name.toLowerCase().includes(q));
  }, [maps, search]);

  const tree = useMemo(() => buildTree(filtered), [filtered]);

  if (!maps) return <div className="map-status">Loading…</div>;

  if (maps.length === 0) {
    return (
      <div className="map-status">
        <p>No maps yet — create one to start placing markers on it.</p>
        <Link href="/maps/new" className="btn btn-primary">
          <MapPlus size={15} strokeWidth={2.25} />
          Create your first map
        </Link>
      </div>
    );
  }

  return (
    <div className="map-manager">
      <h1>Maps</h1>
      <input
        type="text"
        placeholder="Search maps…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="map-search"
      />
      <ul className="map-tree-children map-tree-root">
        {tree.map((node) => (
          <TreeItem key={node.id} node={node} onRequestDelete={setDeletingMap} />
        ))}
      </ul>
      {deletingMap && (
        <DeleteMapModal
          map={deletingMap}
          onClose={() => setDeletingMap(null)}
          onDeleted={() => {
            setDeletingMap(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
