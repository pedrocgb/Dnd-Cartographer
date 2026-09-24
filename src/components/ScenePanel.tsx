"use client";

import { useState } from "react";
import { X, ListTree, ChevronRight, ChevronDown, MapPin, Shapes, Type, PenTool, Eye, EyeOff } from "lucide-react";
import type { Marker } from "./MarkerLayer";
import type { ZoneData, ZoneRegionData } from "./ZoneLayer";
import type { MapTextData } from "./TextLayer";
import type { MapLineData } from "./LineLayer";

export type SceneKind = "marker" | "zone" | "text" | "line";

const LINE_STYLE_LABEL = { solid: "Solid", dot: "Dotted", dashed: "Dashed" } as const;

const SCENE_KINDS: SceneKind[] = ["marker", "zone", "text", "line"];
/** Which sections are expanded, remembered per browser across visits to the panel. */
const OPEN_STORAGE_KEY = "scene-panel-open";

function loadOpenSections(): Set<SceneKind> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(OPEN_STORAGE_KEY) ?? "null");
    if (Array.isArray(parsed)) return new Set(SCENE_KINDS.filter((k) => parsed.includes(k)));
  } catch {
    // unavailable or corrupt: fall back to all open
  }
  return new Set(SCENE_KINDS);
}

function saveOpenSections(open: Set<SceneKind>) {
  try {
    window.localStorage.setItem(OPEN_STORAGE_KEY, JSON.stringify([...open]));
  } catch {
    // storage unavailable: the choice just isn't remembered
  }
}

function Section({
  title,
  icon,
  count,
  open,
  onToggle,
  anyVisible,
  onToggleVisible,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  open: boolean;
  onToggle: () => void;
  /** At least one item is shown: the eye hides them all, otherwise it shows them all. */
  anyVisible: boolean;
  onToggleVisible: () => void;
  children: React.ReactNode;
}) {
  const eyeLabel = `${anyVisible ? "Hide" : "Show"} all ${title.toLowerCase()}`;
  return (
    <section className="scene-section">
      <div className="scene-section-bar">
        <button type="button" className="scene-section-header" aria-expanded={open} onClick={onToggle}>
          {open ? <ChevronDown size={14} strokeWidth={2.25} /> : <ChevronRight size={14} strokeWidth={2.25} />}
          {icon}
          <span className="scene-section-title">{title}</span>
          <span className="scene-count">{count}</span>
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon-xs"
          onClick={onToggleVisible}
          disabled={count === 0}
          aria-label={eyeLabel}
          title={eyeLabel}
        >
          {anyVisible ? <Eye size={12} strokeWidth={2.25} /> : <EyeOff size={12} strokeWidth={2.25} />}
        </button>
      </div>
      {open && (count > 0 ? <ul className="scene-list">{children}</ul> : <p className="field-label scene-empty">Nothing here yet.</p>)}
    </section>
  );
}

function Item({ label, muted, onClick }: { label: string; muted?: boolean; onClick: () => void }) {
  return (
    <li>
      <button type="button" className={muted ? "scene-item muted" : "scene-item"} onClick={onClick} title="Show on the map and edit">
        {label}
      </button>
    </li>
  );
}

/**
 * Everything on the active layer, grouped by type. Picking an item zooms the
 * map to it, selects it and switches to its tool (handled by `onPick`).
 */
export default function ScenePanel({
  layerName,
  markers,
  regions,
  zones,
  texts,
  lines,
  onPick,
  onSetVisible,
  onClose,
}: {
  layerName: string;
  markers: Marker[];
  regions: ZoneRegionData[];
  zones: ZoneData[];
  texts: MapTextData[];
  lines: MapLineData[];
  onPick: (kind: SceneKind, id: string) => void;
  /** Sets each listed item's own visibility (the folder eye). */
  onSetVisible: (kind: SceneKind, ids: string[], visible: boolean) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<Set<SceneKind>>(loadOpenSections);
  const toggle = (k: SceneKind) => {
    const next = new Set(open);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setOpen(next);
    saveOpenSections(next);
  };

  /** Props for a folder's eye: hide all while any item is shown, else show all. */
  const eye = (kind: SceneKind, items: { id: string; visible: boolean }[]) => {
    const anyVisible = items.some((i) => i.visible);
    return { anyVisible, onToggleVisible: () => onSetVisible(kind, items.map((i) => i.id), !anyVisible) };
  };

  const sortedRegions = [...regions].sort((a, b) => a.sortOrder - b.sortOrder);
  const byName = <T,>(items: T[], name: (t: T) => string) => [...items].sort((a, b) => name(a).localeCompare(name(b)));

  return (
    <div className="layers-panel scene-panel">
      <div className="marker-side-panel-header">
        <h2>
          <ListTree size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          Scene
        </h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close scene panel">
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>
      <p className="panel-layer-label">Layer: {layerName}</p>

      <Section title="Markers" icon={<MapPin size={14} strokeWidth={2.25} />} count={markers.length} open={open.has("marker")} onToggle={() => toggle("marker")} {...eye("marker", markers)}>
        {byName(markers, (m) => m.name).map((m) => (
          <Item key={m.id} label={m.name} muted={!m.visible} onClick={() => onPick("marker", m.id)} />
        ))}
      </Section>

      <Section title="Zones" icon={<Shapes size={14} strokeWidth={2.25} />} count={zones.length} open={open.has("zone")} onToggle={() => toggle("zone")} {...eye("zone", zones)}>
        {sortedRegions.map((r) => {
          const regionZones = zones.filter((z) => z.regionId === r.id).sort((a, b) => a.sortOrder - b.sortOrder);
          if (regionZones.length === 0) return null;
          return (
            <li key={r.id} className="scene-group">
              <span className="field-label scene-group-title">{r.name}</span>
              <ul className="scene-list">
                {regionZones.map((z) => (
                  <Item key={z.id} label={z.name} muted={!z.visible || !r.visible} onClick={() => onPick("zone", z.id)} />
                ))}
              </ul>
            </li>
          );
        })}
      </Section>

      <Section title="Texts" icon={<Type size={14} strokeWidth={2.25} />} count={texts.length} open={open.has("text")} onToggle={() => toggle("text")} {...eye("text", texts)}>
        {byName(texts, (t) => t.text).map((t) => (
          <Item key={t.id} label={t.text.split("\n")[0] || "(empty)"} muted={!t.visible} onClick={() => onPick("text", t.id)} />
        ))}
      </Section>

      <Section title="Lines" icon={<PenTool size={14} strokeWidth={2.25} />} count={lines.length} open={open.has("line")} onToggle={() => toggle("line")} {...eye("line", lines)}>
        {lines.map((l, i) => (
          <Item key={l.id} label={`Line ${i + 1} · ${LINE_STYLE_LABEL[l.style]}`} muted={!l.visible} onClick={() => onPick("line", l.id)} />
        ))}
      </Section>
    </div>
  );
}
