"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Shapes,
  Square,
  Circle,
  Hexagon,
  Brush,
  Eraser,
  MousePointer2,
  Plus,
  Check,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  ArrowUp,
  ArrowDown,
  Trash2,
  Crown,
} from "lucide-react";
import ColorWheel from "./ColorWheel";
import LayerChecklist from "./LayerChecklist";
import type { MapLayerData } from "./layer-images";
import { buildTerritoryTree, TerritoryTreeRow } from "./TerritoryTree";
import { articleHref } from "@/server/articles/templates";
import { COLOR_PRESETS, normalizeColor } from "@/server/markers/icon-registry";
import { BRUSH_SIZE_MAX, BRUSH_SIZE_MIN, isPaintTool, type ZoneData, type ZoneRegionData, type ZoneTool } from "./ZoneLayer";

async function json<T>(res: Response): Promise<T> {
  return res.json();
}

const SHAPE_ICON = { rectangle: Square, circle: Circle, polygon: Hexagon, area: Brush } as const;
const SHAPE_LABEL = { rectangle: "Rectangle", circle: "Circle", polygon: "Polygon", area: "Painted area" } as const;

interface Territory {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
}

function TerritoryLinkPicker({ onPick, onCancel }: { onPick: (id: string) => void; onCancel: () => void }) {
  const [q, setQ] = useState("");
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/politics/territories")
      .then((r) => json<{ territories: Territory[] }>(r))
      .then((d) => setTerritories(d.territories));
  }, []);

  const tree = useMemo(() => buildTerritoryTree(territories), [territories]);
  const searching = q.trim().length > 0;
  const searchResults = useMemo(() => {
    if (!searching) return [];
    const needle = q.trim().toLowerCase();
    return territories.filter((t) => t.name.toLowerCase().includes(needle));
  }, [searching, q, territories]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="politics-picker">
      <input type="text" placeholder="Search territories…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="politics-list politics-tree">
        {searching
          ? searchResults.map((t) => (
              <li key={t.id} className="politics-list-row">
                <button type="button" className="politics-list-pick" onClick={() => onPick(t.id)}>
                  {t.name} <span className="field-label">({t.type})</span>
                </button>
              </li>
            ))
          : tree.map((root) => (
              <TerritoryTreeRow key={root.id} node={root} depth={0} expanded={expanded} onToggleExpand={toggleExpand} onSelect={onPick} />
            ))}
      </ul>
      <button className="btn btn-sm" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function ZoneTerritoryLink({ zone, onUpdate }: { zone: ZoneData; onUpdate: (patch: Partial<ZoneData>) => void }) {
  const [picking, setPicking] = useState(false);
  const [chain, setChain] = useState<Territory[] | null>(null);
  // Tracks which territoryId `chain` was actually loaded for, so a stale
  // response (or the id simply changing/clearing) can't show outdated data —
  // computed at render time below instead of an eager reset inside the effect.
  const [chainLoadedFor, setChainLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!zone.territoryId) return;
    let cancelled = false;
    fetch(`/api/politics/territories/${zone.territoryId}?withChain=true`)
      .then((r) => json<{ chain?: Territory[] }>(r))
      .then((d) => {
        if (cancelled) return;
        setChain(d.chain ?? null);
        setChainLoadedFor(zone.territoryId);
      })
      .catch(() => {
        if (cancelled) return;
        setChain(null);
        setChainLoadedFor(zone.territoryId);
      });
    return () => {
      cancelled = true;
    };
  }, [zone.territoryId]);

  const visibleChain = chainLoadedFor === zone.territoryId ? chain : null;

  return (
    <div className="zone-territory-link">
      <span className="field-label">Political territory (optional)</span>
      {zone.territoryId ? (
        <div className="zone-territory-chain">
          {visibleChain === null ? (
            <span className="field-label">Linked territory is unavailable.</span>
          ) : (
            <span>
              {visibleChain.map((t, i) => (
                <span key={t.id}>
                  {i > 0 && " › "}
                  {t.name} <span className="field-label">({t.type})</span>
                </span>
              ))}
            </span>
          )}
          <div className="marker-panel-actions">
            <a href={articleHref("territory", zone.territoryId)} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
              Open profile
            </a>
            <button className="btn btn-sm" onClick={() => onUpdate({ territoryId: null })}>
              Remove link
            </button>
          </div>
        </div>
      ) : picking ? (
        <TerritoryLinkPicker
          onPick={(id) => {
            onUpdate({ territoryId: id });
            setPicking(false);
          }}
          onCancel={() => setPicking(false)}
        />
      ) : (
        <button className="btn btn-sm" onClick={() => setPicking(true)}>
          <Crown size={13} strokeWidth={2.25} />
          Link to territory…
        </button>
      )}
    </div>
  );
}

function ZoneEditor({
  zone,
  layers,
  homeLayerId,
  onUpdate,
  onDelete,
  onDone,
}: {
  zone: ZoneData;
  layers: MapLayerData[];
  /** The zone's home layer: its region's. */
  homeLayerId: string | null;
  onUpdate: (patch: Partial<ZoneData>) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(zone.name);
  const focusedRef = useRef(false);
  // Ref-guarded, same as GridPanel's SliderField — resyncs the field from
  // the saved name only while the user isn't actively editing it, so an
  // external update never stomps an in-progress rename.
  useEffect(() => {
    if (!focusedRef.current) setName(zone.name);
  }, [zone.id, zone.name]);
  const ShapeIcon = SHAPE_ICON[zone.shapeType];

  return (
    <div className="zone-editor">
      <div className="zone-editor-header">
        <ShapeIcon size={14} strokeWidth={2.25} />
        <input
          type="text"
          value={name}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            focusedRef.current = false;
            if (name.trim() && name !== zone.name) onUpdate({ name: name.trim() });
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <button type="button" className="btn btn-sm btn-primary zone-editor-done" onClick={onDone}>
          <Check size={13} strokeWidth={2.25} />
          Done
        </button>
      </div>
      <span className="field-label">{SHAPE_LABEL[zone.shapeType]}</span>

      <span className="field-label">Fill color</span>
      <ColorWheel value={zone.fillColor} onChange={(fillColor) => onUpdate({ fillColor })} />
      <label className="grid-field">
        <div className="grid-field-header">
          <span className="field-label">Fill opacity</span>
          <span className="grid-field-value">{Math.round(zone.fillOpacity * 100)}%</span>
        </div>
        <input type="range" min={0} max={100} value={Math.round(zone.fillOpacity * 100)} onChange={(e) => onUpdate({ fillOpacity: Number(e.target.value) / 100 })} />
      </label>

      <span className="field-label">Outline color</span>
      <div className="color-swatch-row">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            className={c === zone.strokeColor ? "color-swatch active" : "color-swatch"}
            style={{ background: c }}
            onClick={() => onUpdate({ strokeColor: normalizeColor(c) })}
            aria-label={`Outline color ${c}`}
          />
        ))}
      </div>
      <label className="grid-field">
        <div className="grid-field-header">
          <span className="field-label">Outline opacity</span>
          <span className="grid-field-value">{Math.round(zone.strokeOpacity * 100)}%</span>
        </div>
        <input type="range" min={0} max={100} value={Math.round(zone.strokeOpacity * 100)} onChange={(e) => onUpdate({ strokeOpacity: Number(e.target.value) / 100 })} />
      </label>
      <label className="grid-field">
        <div className="grid-field-header">
          <span className="field-label">Outline width</span>
          <span className="grid-field-value">{zone.strokeWidth.toFixed(2)}</span>
        </div>
        <input type="range" min={0} max={2} step={0.05} value={zone.strokeWidth} onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })} />
      </label>

      <ZoneTerritoryLink zone={zone} onUpdate={onUpdate} />

      <LayerChecklist
        layers={layers}
        homeLayerId={homeLayerId}
        value={zone.extraLayerIds ?? []}
        alwaysDrawFlag="zonesAlwaysVisible"
        onChange={(extraLayerIds) => onUpdate({ extraLayerIds })}
      />

      <button className="btn btn-danger" onClick={onDelete} disabled={zone.locked}>
        <Trash2 size={14} strokeWidth={2.25} />
        Delete zone
      </button>
    </div>
  );
}

function RegionRow({
  region,
  zones,
  isActive,
  isExpanded,
  selectedZoneId,
  activeTool,
  onSelectRegion,
  onToggleExpand,
  onUpdateRegion,
  onDeleteRegion,
  onSelectZone,
  onUpdateZone,
  onDeleteZone,
  onMoveRegion,
  onStartAddZone,
  onStopAddZone,
  canMoveUp,
  canMoveDown,
  sharedFrom,
}: {
  region: ZoneRegionData;
  zones: ZoneData[];
  isActive: boolean;
  isExpanded: boolean;
  selectedZoneId: string | null;
  activeTool: ZoneTool;
  onSelectRegion: () => void;
  onToggleExpand: () => void;
  onUpdateRegion: (patch: Partial<ZoneRegionData>) => void;
  onDeleteRegion: () => void;
  onSelectZone: (id: string) => void;
  onUpdateZone: (id: string, patch: Partial<ZoneData>) => void;
  onDeleteZone: (id: string) => void;
  onMoveRegion: (dir: "up" | "down") => void;
  onStartAddZone: () => void;
  onStopAddZone: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Set when this region lives on another layer and only some of its zones are shown here. */
  sharedFrom?: string;
}) {
  const isAddingZone = isActive && activeTool !== "select";
  const addZoneDisabled = region.locked || !region.visible;
  return (
    <li className="zone-region">
      <div className={isActive ? "zone-region-row active" : "zone-region-row"}>
        <button className="zone-tree-toggle" onClick={onToggleExpand} aria-label={isExpanded ? "Collapse" : "Expand"}>
          {isExpanded ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
        </button>
        <button className="zone-region-name" onClick={sharedFrom ? onToggleExpand : onSelectRegion}>
          {region.name} <span className="field-label">({zones.length})</span>
          {sharedFrom && <span className="field-label zone-region-shared"> · from {sharedFrom}</span>}
        </button>
        {!sharedFrom && (
        <div className="zone-row-actions">
          <button className="btn btn-ghost btn-icon-xs" onClick={() => onMoveRegion("up")} disabled={!canMoveUp} aria-label="Move Region up" title="Move up">
            <ArrowUp size={12} strokeWidth={2.25} />
          </button>
          <button className="btn btn-ghost btn-icon-xs" onClick={() => onMoveRegion("down")} disabled={!canMoveDown} aria-label="Move Region down" title="Move down">
            <ArrowDown size={12} strokeWidth={2.25} />
          </button>
          <button
            className="btn btn-ghost btn-icon-xs"
            onClick={() => onUpdateRegion({ visible: !region.visible })}
            aria-label={region.visible ? "Hide Region" : "Show Region"}
            title={region.visible ? "Hide Region" : "Show Region"}
          >
            {region.visible ? <Eye size={12} strokeWidth={2.25} /> : <EyeOff size={12} strokeWidth={2.25} />}
          </button>
          <button
            className="btn btn-ghost btn-icon-xs"
            onClick={() => onUpdateRegion({ locked: !region.locked })}
            aria-label={region.locked ? "Unlock Region" : "Lock Region"}
            title={region.locked ? "Unlock Region" : "Lock Region"}
          >
            {region.locked ? <Lock size={12} strokeWidth={2.25} /> : <LockOpen size={12} strokeWidth={2.25} />}
          </button>
          <button className="btn btn-ghost btn-icon-xs" onClick={onDeleteRegion} aria-label="Delete Region" title="Delete Region">
            <Trash2 size={12} strokeWidth={2.25} />
          </button>
        </div>
        )}
      </div>

      {isExpanded && (
        <ul className="zone-list">
          {!sharedFrom && (
          <li>
            {isAddingZone ? (
              <button type="button" className="zone-add-row zone-add-row-done" onClick={onStopAddZone}>
                <Check size={13} strokeWidth={2.25} />
                Done
              </button>
            ) : (
              <button
                type="button"
                className="zone-add-row"
                onClick={onStartAddZone}
                disabled={addZoneDisabled}
                title={addZoneDisabled ? "Region is hidden or locked" : "Start drawing a new zone in this Region"}
              >
                <Plus size={13} strokeWidth={2.25} />
                Add zone
              </button>
            )}
          </li>
          )}
          {zones.length === 0 && <li className="field-label zone-empty-hint">No zones yet.</li>}
          {zones.map((zone) => {
            const ShapeIcon = SHAPE_ICON[zone.shapeType];
            return (
              <li key={zone.id} className={zone.id === selectedZoneId ? "zone-row active" : "zone-row"}>
                <button className="zone-row-name" onClick={() => onSelectZone(zone.id)}>
                  <ShapeIcon size={13} strokeWidth={2.25} />
                  <span className="zone-color-dot" style={{ background: zone.fillColor }} />
                  {zone.name}
                </button>
                <div className="zone-row-actions">
                  <button
                    className="btn btn-ghost btn-icon-xs"
                    onClick={() => onUpdateZone(zone.id, { visible: !zone.visible })}
                    aria-label={zone.visible ? "Hide zone" : "Show zone"}
                    title={zone.visible ? "Hide zone" : "Show zone"}
                  >
                    {zone.visible ? <Eye size={12} strokeWidth={2.25} /> : <EyeOff size={12} strokeWidth={2.25} />}
                  </button>
                  <button
                    className="btn btn-ghost btn-icon-xs"
                    onClick={() => onUpdateZone(zone.id, { locked: !zone.locked })}
                    aria-label={zone.locked ? "Unlock zone" : "Lock zone"}
                    title={zone.locked ? "Unlock zone" : "Lock zone"}
                  >
                    {zone.locked ? <Lock size={12} strokeWidth={2.25} /> : <LockOpen size={12} strokeWidth={2.25} />}
                  </button>
                  <button
                    className="btn btn-ghost btn-icon-xs"
                    onClick={() => onDeleteZone(zone.id)}
                    disabled={zone.locked}
                    aria-label="Delete zone"
                    title="Delete zone"
                  >
                    <Trash2 size={12} strokeWidth={2.25} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export default function ZonesPanel({
  layerName,
  regions,
  zones,
  activeRegionId,
  selectedZoneId,
  activeTool,
  onSetActiveRegion,
  onSetActiveTool,
  brushSize,
  onBrushSizeChange,
  onSelectZone,
  onCreateRegion,
  onUpdateRegion,
  onDeleteRegion,
  onUpdateZone,
  onDeleteZone,
  onClose,
  layers,
  sharedRegionIds,
}: {
  /** Name of the active layer this tool edits. */
  layerName: string;
  regions: ZoneRegionData[];
  zones: ZoneData[];
  activeRegionId: string | null;
  selectedZoneId: string | null;
  activeTool: ZoneTool;
  onSetActiveRegion: (id: string) => void;
  onSetActiveTool: (tool: ZoneTool) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  onSelectZone: (id: string | null) => void;
  onCreateRegion: (name: string) => void;
  onUpdateRegion: (id: string, patch: Partial<ZoneRegionData>) => void;
  onDeleteRegion: (id: string, mode?: "cascade") => void;
  onUpdateZone: (id: string, patch: Partial<ZoneData>) => void;
  onDeleteZone: (id: string) => void;
  onClose: () => void;
  layers: MapLayerData[];
  /** Regions of other layers, listed only for their zones shared onto this layer. */
  sharedRegionIds: Set<string>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creatingRegion, setCreatingRegion] = useState(false);
  const [newRegionName, setNewRegionName] = useState("");

  // Auto-expand the active Region as a render-time adjustment (rather than
  // an effect) — only fires when activeRegionId actually changes to a new
  // value, not on every re-render.
  const [lastAutoExpandedId, setLastAutoExpandedId] = useState<string | null>(null);
  if (activeRegionId && activeRegionId !== lastAutoExpandedId) {
    setLastAutoExpandedId(activeRegionId);
    setExpanded((prev) => new Set(prev).add(activeRegionId));
  }

  // The layer's own regions (reorderable) first, then groups shared from other layers.
  const sortedRegions = [...regions].sort(
    (a, b) => Number(sharedRegionIds.has(a.id)) - Number(sharedRegionIds.has(b.id)) || a.sortOrder - b.sortOrder
  );
  const ownRegionCount = sortedRegions.filter((r) => !sharedRegionIds.has(r.id)).length;
  const layerNameOf = (id: string | null) => layers.find((l) => l.id === id)?.name ?? "another layer";
  const zonesByRegion = new Map<string, ZoneData[]>();
  for (const region of sortedRegions) {
    zonesByRegion.set(
      region.id,
      zones.filter((z) => z.regionId === region.id).sort((a, b) => a.sortOrder - b.sortOrder)
    );
  }

  const activeRegion = regions.find((r) => r.id === activeRegionId) ?? null;
  const drawingDisabled = !activeRegion || activeRegion.locked || !activeRegion.visible;
  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;
  const selectedZoneRegion = selectedZone ? regions.find((r) => r.id === selectedZone.regionId) : undefined;
  const selectedZonePaintable = Boolean(selectedZone && !selectedZone.locked && selectedZoneRegion && !selectedZoneRegion.locked);

  function submitNewRegion() {
    if (!newRegionName.trim()) return;
    onCreateRegion(newRegionName.trim());
    setNewRegionName("");
    setCreatingRegion(false);
  }

  function moveRegion(region: ZoneRegionData, dir: "up" | "down") {
    const idx = sortedRegions.findIndex((r) => r.id === region.id);
    const otherIdx = dir === "up" ? idx - 1 : idx + 1;
    if (otherIdx < 0 || otherIdx >= sortedRegions.length) return;
    const other = sortedRegions[otherIdx];
    onUpdateRegion(region.id, { sortOrder: other.sortOrder });
    onUpdateRegion(other.id, { sortOrder: region.sortOrder });
  }

  function requestDeleteRegion(region: ZoneRegionData) {
    const count = zonesByRegion.get(region.id)?.length ?? 0;
    if (count > 0) {
      const ok = window.confirm(`"${region.name}" still contains ${count} zone(s). Delete the Region and all its zones?`);
      if (!ok) return;
      onDeleteRegion(region.id, "cascade");
      return;
    }
    onDeleteRegion(region.id);
  }

  return (
    <div className={selectedZone ? "zones-panel zones-panel-editing" : "zones-panel"}>
      <div className="zones-panel-main">
      <div className="marker-side-panel-header">
        <h2>
          <Shapes size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          Zones
        </h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close zones panel">
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>
      <p className="panel-layer-label">Layer: {layerName}</p>

      <div className="zone-tool-row">
        <button className={activeTool === "select" ? "active" : ""} title="Select / edit" onClick={() => onSetActiveTool("select")}>
          <MousePointer2 size={15} strokeWidth={2.25} />
        </button>
        <button
          className={activeTool === "rectangle" ? "active" : ""}
          title="Rectangle / Square — hold Shift for an equal-sided square"
          disabled={drawingDisabled}
          onClick={() => onSetActiveTool("rectangle")}
        >
          <Square size={15} strokeWidth={2.25} />
        </button>
        <button
          className={activeTool === "circle" ? "active" : ""}
          title="Circle — press at the center and drag out the radius"
          disabled={drawingDisabled}
          onClick={() => onSetActiveTool("circle")}
        >
          <Circle size={15} strokeWidth={2.25} />
        </button>
        <button
          className={activeTool === "polygon" ? "active" : ""}
          title="Polygon — click each vertex, click the first point (or press Enter) to close"
          disabled={drawingDisabled}
          onClick={() => onSetActiveTool("polygon")}
        >
          <Hexagon size={15} strokeWidth={2.25} />
        </button>
        <button
          className={activeTool === "brush" ? "active" : ""}
          title="Brush — paint a new zone, or paint onto the selected zone to grow it. [ and ] or Shift + mouse wheel change the size."
          disabled={drawingDisabled && !selectedZonePaintable}
          onClick={() => onSetActiveTool("brush")}
        >
          <Brush size={15} strokeWidth={2.25} />
        </button>
        <button
          className={activeTool === "eraser" ? "active" : ""}
          title="Eraser — erase part of the selected zone. [ and ] or Shift + mouse wheel change the size."
          disabled={!selectedZonePaintable}
          onClick={() => onSetActiveTool("eraser")}
        >
          <Eraser size={15} strokeWidth={2.25} />
        </button>
      </div>
      {isPaintTool(activeTool) ? (
        <div className="zone-brush-settings">
          <label className="grid-field">
            <span className="field-label">Brush size: {brushSize}px</span>
            <input
              type="range"
              min={BRUSH_SIZE_MIN}
              max={BRUSH_SIZE_MAX}
              value={brushSize}
              onChange={(e) => onBrushSizeChange(Number(e.target.value))}
            />
          </label>
          <p className="field-label zone-tool-hint">
            {activeTool === "eraser"
              ? selectedZone
                ? `Erasing from: ${selectedZone.name}${selectedZonePaintable ? "" : " (locked)"}`
                : "Select a zone to erase from."
              : selectedZone
                ? `Painting into: ${selectedZone.name}${selectedZonePaintable ? "" : " (locked)"}`
                : activeRegion && !drawingDisabled
                  ? `Painting a new zone in: ${activeRegion.name}`
                  : "Create or select an unlocked, visible Region to paint."}
          </p>
          {activeTool === "brush" && selectedZone && (
            <button type="button" className="btn btn-sm" onClick={() => onSelectZone(null)} title="Deselect so the next stroke starts a new zone (Esc)">
              <Plus size={13} strokeWidth={2.25} />
              Paint a new zone
            </button>
          )}
        </div>
      ) : (
        <p className="field-label zone-tool-hint">
          {activeRegion ? `Drawing in: ${activeRegion.name}` : "Create or select a Region to draw."}
          {activeRegion?.locked && " (locked — unlock to draw)"}
          {activeRegion && !activeRegion.visible && " (hidden — show to draw)"}
        </p>
      )}

      <ul className="zone-region-list">
        {sortedRegions.map((region, i) => (
          <RegionRow
            key={region.id}
            region={region}
            zones={zonesByRegion.get(region.id) ?? []}
            isActive={region.id === activeRegionId}
            isExpanded={expanded.has(region.id)}
            selectedZoneId={selectedZoneId}
            activeTool={activeTool}
            onSelectRegion={() => {
              onSetActiveRegion(region.id);
              setExpanded((prev) => new Set(prev).add(region.id));
            }}
            onToggleExpand={() =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(region.id)) next.delete(region.id);
                else next.add(region.id);
                return next;
              })
            }
            onUpdateRegion={(patch) => onUpdateRegion(region.id, patch)}
            onDeleteRegion={() => requestDeleteRegion(region)}
            onSelectZone={onSelectZone}
            onUpdateZone={onUpdateZone}
            onDeleteZone={onDeleteZone}
            onMoveRegion={(dir) => moveRegion(region, dir)}
            onStartAddZone={() => {
              onSetActiveRegion(region.id);
              setExpanded((prev) => new Set(prev).add(region.id));
              onSetActiveTool("rectangle");
            }}
            onStopAddZone={() => onSetActiveTool("select")}
            canMoveUp={i > 0}
            canMoveDown={i < ownRegionCount - 1}
            sharedFrom={sharedRegionIds.has(region.id) ? layerNameOf(region.layerId) : undefined}
          />
        ))}
      </ul>

      {creatingRegion ? (
        <div className="zone-new-region">
          <input
            type="text"
            placeholder="Region name (e.g. Duchies, Forests)"
            value={newRegionName}
            autoFocus
            onChange={(e) => setNewRegionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewRegion();
              if (e.key === "Escape") setCreatingRegion(false);
            }}
          />
          <button className="btn btn-sm btn-primary" onClick={submitNewRegion}>
            Create
          </button>
          <button className="btn btn-sm" onClick={() => setCreatingRegion(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-sm" onClick={() => setCreatingRegion(true)}>
          <Plus size={14} strokeWidth={2.25} />
          New Zone Region
        </button>
      )}

      </div>

      {selectedZone && (
        <div className="zones-panel-editor">
          <ZoneEditor
            zone={selectedZone}
            layers={layers}
            homeLayerId={selectedZoneRegion?.layerId ?? null}
            onUpdate={(patch) => onUpdateZone(selectedZone.id, patch)}
            onDelete={() => onDeleteZone(selectedZone.id)}
            onDone={() => onSelectZone(null)}
          />
        </div>
      )}
    </div>
  );
}
