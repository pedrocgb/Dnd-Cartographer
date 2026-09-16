"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, MapPlus } from "lucide-react";

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

function TreeItem({ node }: { node: TreeNode }) {
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
            <TreeItem key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function MapManager() {
  const [maps, setMaps] = useState<MapSummary[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/maps")
      .then((r) => r.json())
      .then((d) => setMaps(d.maps));
  }, []);

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
          <TreeItem key={node.id} node={node} />
        ))}
      </ul>
    </div>
  );
}
