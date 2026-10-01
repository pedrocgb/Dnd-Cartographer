"use client";

import { formatDecimal } from "@/server/settings/number-format";
import { useEffect, useMemo, useRef, useState } from "react";
import { Skeleton, SkeletonRegion } from "./Skeleton";
import { AreaReadings } from "./map-hud/AreaPanel";
import { shapeAreaPx, shapePerimeterPx, zoneAreaShape } from "@/server/scale/area";
import type { ScaleConfig } from "@/server/scale/scale-config";
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
import { DeleteFolderDialog, FolderSelect, FolderSettings, ItemRow, MixedTag, MultiHeader, type FolderPatch, type MapFolderData } from "./LayerFolders";
import { clickMods, dropMoves, editLayers, mixedKeys, sharedLayers, type ClickMods } from "./multi-select";
import ToolSection from "./ToolSection";
import { useListDrag } from "./use-list-drag";
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

/** `mixed`: several zones linked to different territories (or some to none). */
function ZoneTerritoryLink({ zone, mixed = false, onUpdate }: { zone: ZoneData; mixed?: boolean; onUpdate: (patch: Partial<ZoneData>) => void }) {
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

  const chainLoading = chainLoadedFor !== zone.territoryId;
  const visibleChain = chainLoading ? null : chain;

  return (
    <div className="zone-territory-link">
      <span className="field-label">
        Political territory (optional) <MixedTag show={mixed} />
      </span>
      {mixed && !picking ? (
        <div className="zone-territory-chain">
          <span className="field-label">The selected zones link to different territories.</span>
          <div className="marker-panel-actions">
            <button className="btn btn-sm" onClick={() => setPicking(true)}>
              <Crown size={13} strokeWidth={2.25} />
              Link all to…
            </button>
            <button className="btn btn-sm" onClick={() => onUpdate({ territoryId: null })}>
              Remove all links
            </button>
          </div>
        </div>
      ) : zone.territoryId && !picking ? (
        <div className="zone-territory-chain">
          {chainLoading ? (
            <SkeletonRegion label="Loading the territory…">
              <Skeleton width="70%" />
            </SkeletonRegion>
          ) : visibleChain === null ? (
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

type ZoneStyle = Pick<ZoneData, "fillColor" | "fillOpacity" | "strokeColor" | "strokeOpacity" | "strokeWidth">;

function Group({ id, title, sectioned, children }: { id: string; title: string; sectioned: boolean; children: React.ReactNode }) {
  return sectioned ? (
    <ToolSection id={id} title={title}>
      {children}
    </ToolSection>
  ) : (
    <>{children}</>
  );
}

/** Fill and outline: for a zone, or a region's default style. */
const NO_MIXED: ReadonlySet<string> = new Set();

/** Fill and outline: for a zone (or several: `mixed` fields differ between them), or a region's default style. */
function ZoneStyleFields({ v, sectioned = true, mixed = NO_MIXED, onChange }: { v: ZoneStyle; sectioned?: boolean; mixed?: ReadonlySet<string>; onChange: (patch: Partial<ZoneStyle>) => void }) {
  const m = (key: keyof ZoneStyle) => mixed.has(key);
  const percent = (key: keyof ZoneStyle, value: number) => (m(key) ? <span className="mixed-tag">Mixed</span> : `${Math.round(value * 100)}%`);
  return (
    <>
      <Group id="zone-fill" title="Fill" sectioned={sectioned}>
        <span className="field-label">
          Fill color <MixedTag show={m("fillColor")} />
        </span>
        <ColorWheel value={v.fillColor} mixed={m("fillColor")} onChange={(fillColor) => onChange({ fillColor })} />
        <label className="grid-field">
          <div className="grid-field-header">
            <span className="field-label">Fill opacity</span>
            <span className="grid-field-value">{percent("fillOpacity", v.fillOpacity)}</span>
          </div>
          <input type="range" min={0} max={100} value={Math.round(v.fillOpacity * 100)} onChange={(e) => onChange({ fillOpacity: Number(e.target.value) / 100 })} />
        </label>
      </Group>

      <Group id="zone-outline" title="Outline" sectioned={sectioned}>
        <span className="field-label">
          Outline color <MixedTag show={m("strokeColor")} />
        </span>
        <div className="color-swatch-row">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              className={!m("strokeColor") && c === v.strokeColor ? "color-swatch active" : "color-swatch"}
              style={{ background: c }}
              onClick={() => onChange({ strokeColor: normalizeColor(c) })}
              aria-label={`Outline color ${c}`}
            />
          ))}
        </div>
        <label className="grid-field">
          <div className="grid-field-header">
            <span className="field-label">Outline opacity</span>
            <span className="grid-field-value">{percent("strokeOpacity", v.strokeOpacity)}</span>
          </div>
          <input type="range" min={0} max={100} value={Math.round(v.strokeOpacity * 100)} onChange={(e) => onChange({ strokeOpacity: Number(e.target.value) / 100 })} />
        </label>
        <label className="grid-field">
          <div className="grid-field-header">
            <span className="field-label">Outline width</span>
            <span className="grid-field-value">{m("strokeWidth") ? <span className="mixed-tag">Mixed</span> : formatDecimal(v.strokeWidth, { minimumFractionDigits: 2 })}</span>
          </div>
          <input type="range" min={0} max={2} step={0.05} value={v.strokeWidth} onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })} />
        </label>
      </Group>
    </>
  );
}

function ZoneEditor({
  zone,
  layers,
  homeLayerId,
  region,
  regionOptions,
  endOf,
  onUpdate,
  onDelete,
  onDone,
  scaleConfig,
}: {
  zone: ZoneData;
  layers: MapLayerData[];
  /** The zone's home layer: its region's. */
  homeLayerId: string | null;
  /** Its region, whose "Also show on" layers it inherits. */
  region: ZoneRegionData | undefined;
  /** Regions it can move to (its layer's). */
  regionOptions: ZoneRegionData[];
  /** The sortOrder after a region's last zone: a moved zone goes in last. */
  endOf: (regionId: string) => number;
  onUpdate: (patch: Partial<ZoneData>) => void;
  onDelete: () => void;
  onDone: () => void;
  scaleConfig: ScaleConfig | null;
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

      <ZoneStyleFields v={zone} onChange={onUpdate} />
      <ZoneArea zones={[zone]} config={scaleConfig} />

      <ToolSection id="zone-territory" title="Political territory">
        <ZoneTerritoryLink zone={zone} onUpdate={onUpdate} />
      </ToolSection>

      <ToolSection id="zone-layers" title="Folder and layers">
        <FolderSelect value={zone.regionId} folders={regionOptions} disabled={zone.locked || region?.locked} onChange={(regionId) => regionId && onUpdate({ regionId, sortOrder: endOf(regionId) })} />
        <LayerChecklist
          layers={layers}
          homeLayerId={homeLayerId}
          value={zone.extraLayerIds ?? []}
          alwaysDrawFlag="zonesAlwaysVisible"
          inherited={region ? { ids: region.extraLayerIds, from: region.name } : undefined}
          onChange={(extraLayerIds) => onUpdate({ extraLayerIds })}
        />
      </ToolSection>

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
  isOpen,
  isExpanded,
  activeTool,
  onSelectRegion,
  onToggleExpand,
  onUpdateRegion,
  onDeleteRegion,
  onMoveRegion,
  onStartAddZone,
  onStopAddZone,
  canMoveUp,
  canMoveDown,
  sharedFrom,
  renderZone,
  dropProps,
  dropInto,
}: {
  region: ZoneRegionData;
  zones: ZoneData[];
  isActive: boolean;
  /** Its settings are open in the right column. */
  isOpen: boolean;
  isExpanded: boolean;
  activeTool: ZoneTool;
  onSelectRegion: () => void;
  onToggleExpand: () => void;
  onUpdateRegion: (patch: FolderPatch) => void;
  onDeleteRegion: () => void;
  onMoveRegion: (dir: "up" | "down") => void;
  onStartAddZone: () => void;
  onStopAddZone: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Set when this region lives on another layer and only some of its zones are shown here. */
  sharedFrom?: string;
  /** A zone's row in the list. */
  renderZone: (zone: ZoneData) => React.ReactNode;
  /** Drop target: dragged zones go into the region. */
  dropProps?: React.HTMLAttributes<HTMLElement>;
  dropInto?: boolean;
}) {
  const isAddingZone = isActive && activeTool !== "select";
  const addZoneDisabled = region.locked || !region.visible;
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(region.name);

  function startRename() {
    setDraftName(region.name);
    setRenaming(true);
  }

  function commitName() {
    setRenaming(false);
    const name = draftName.trim();
    if (name && name !== region.name) onUpdateRegion({ name });
  }

  return (
    <li className="zone-region">
      <div className={["zone-region-row", isActive && "active", isOpen && "folder-open", dropInto && "drop-into"].filter(Boolean).join(" ")} {...dropProps}>
        <button className="zone-tree-toggle" onClick={onToggleExpand} aria-label={isExpanded ? "Collapse" : "Expand"}>
          {isExpanded ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
        </button>
        {renaming ? (
          <input
            type="text"
            className="zone-region-name-input"
            value={draftName}
            autoFocus
            aria-label="Region name"
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                e.stopPropagation();
                setDraftName(region.name);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <button
            className="zone-region-name"
            onClick={sharedFrom ? onToggleExpand : onSelectRegion}
            onDoubleClick={sharedFrom ? undefined : startRename}
            data-tooltip={sharedFrom ? undefined : "Click: open its settings, new zones go here. Double-click to rename."}
          >
            {region.name} <span className="field-label">({zones.length})</span>
            {sharedFrom && <span className="field-label zone-region-shared"> · from {sharedFrom}</span>}
            {!sharedFrom && region.extraLayerIds.length > 0 && (
              <span className="field-label zone-region-shared">
                {" "}
                · +{region.extraLayerIds.length} {region.extraLayerIds.length === 1 ? "layer" : "layers"}
              </span>
            )}
          </button>
        )}
        {!sharedFrom && (
        <div className="zone-row-actions">
          <button className="btn btn-ghost btn-icon-xs" onClick={() => onMoveRegion("up")} disabled={!canMoveUp} aria-label="Move Region up" data-tooltip="Move up">
            <ArrowUp size={12} strokeWidth={2.25} />
          </button>
          <button className="btn btn-ghost btn-icon-xs" onClick={() => onMoveRegion("down")} disabled={!canMoveDown} aria-label="Move Region down" data-tooltip="Move down">
            <ArrowDown size={12} strokeWidth={2.25} />
          </button>
          <button
            className="btn btn-ghost btn-icon-xs"
            onClick={() => onUpdateRegion({ visible: !region.visible })}
            aria-label={region.visible ? "Hide Region" : "Show Region"}
            data-tooltip={region.visible ? "Hide Region" : "Show Region"}
          >
            {region.visible ? <Eye size={12} strokeWidth={2.25} /> : <EyeOff size={12} strokeWidth={2.25} />}
          </button>
          <button
            className="btn btn-ghost btn-icon-xs"
            onClick={() => onUpdateRegion({ locked: !region.locked })}
            aria-label={region.locked ? "Unlock Region" : "Lock Region"}
            data-tooltip={region.locked ? "Unlock Region" : "Lock Region"}
          >
            {region.locked ? <Lock size={12} strokeWidth={2.25} /> : <LockOpen size={12} strokeWidth={2.25} />}
          </button>
          <button className="btn btn-ghost btn-icon-xs" onClick={onDeleteRegion} aria-label="Delete Region" data-tooltip="Delete Region">
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
                data-tooltip={addZoneDisabled ? "Region is hidden or locked" : "Start drawing a new zone in this Region"}
              >
                <Plus size={13} strokeWidth={2.25} />
                Add zone
              </button>
            )}
          </li>
          )}
          {zones.length === 0 && <li className="field-label zone-empty-hint">No zones yet.</li>}
          {zones.map(renderZone)}
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
  captureZoneStyle,
  selectedIds,
  onPick,
  onUpdateMany,
  onDeleteMany,
  scaleConfig,
}: {
  /** Name of the active layer this tool edits. */
  layerName: string;
  /** The map's scale (null until it loads): zones show their area through it. */
  scaleConfig: ScaleConfig | null;
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
  onUpdateRegion: (id: string, patch: FolderPatch) => void;
  onDeleteRegion: (id: string, mode?: "cascade") => void;
  onUpdateZone: (id: string, patch: Partial<ZoneData>) => void;
  onDeleteZone: (id: string) => void;
  onClose: () => void;
  layers: MapLayerData[];
  /** Regions of other layers, listed only for their zones shared onto this layer. */
  sharedRegionIds: Set<string>;
  /** The style new zones get now (the last one used): where a region's default style starts. */
  captureZoneStyle: () => ZoneStyle;
  /** Every selected zone (several: they're edited together). */
  selectedIds: string[];
  /** A click on a zone in the list (Ctrl/Shift pick several); `order` is the list as shown. */
  onPick: (id: string, mods: ClickMods, order: string[]) => void;
  /** One edit of several zones (locked ones are skipped unless `includeLocked`). */
  onUpdateMany: (ids: string[], patchOf: (zone: ZoneData) => Partial<ZoneData>, opts?: { includeLocked?: boolean }) => void;
  onDeleteMany: (ids: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creatingRegion, setCreatingRegion] = useState(false);
  const [newRegionName, setNewRegionName] = useState("");
  /** The region whose settings fill the right column (when no zone is selected). */
  const [openRegionId, setOpenRegionId] = useState<string | null>(null);
  const [deletingRegion, setDeletingRegion] = useState<{ folder: MapFolderData; count: number } | null>(null);

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

  // The list as shown, for Shift ranges.
  const order = sortedRegions.flatMap((r) => (zonesByRegion.get(r.id) ?? []).map((z) => z.id));
  const picked = new Set(selectedIds);
  const multi = selectedIds.length > 1 ? zones.filter((z) => picked.has(z.id)) : [];
  const regionOf = (z: ZoneData) => regions.find((r) => r.id === z.regionId);
  const zoneLocked = (z: ZoneData) => z.locked || Boolean(regionOf(z)?.locked);
  const endOf = (regionId: string) => Math.max(-1, ...zones.filter((z) => z.regionId === regionId).map((z) => z.sortOrder)) + 1;
  /** A region's layer's own regions (where its zones can move). */
  const regionsOnLayerOf = (region: ZoneRegionData | undefined) => sortedRegions.filter((r) => region && r.layerId === region.layerId && !sharedRegionIds.has(r.id));

  // Drag and drop: unlocked zones of the layer's own regions move into a region or next to another zone.
  const canDrag = (z: ZoneData) => !zoneLocked(z) && !sharedRegionIds.has(z.regionId);
  const drag = useListDrag((ids, spot) => {
    const anchor = spot.place === "into" ? undefined : zones.find((z) => z.id === spot.key);
    const target = spot.place === "into" ? spot.key : anchor?.regionId;
    if (!target) return;
    const moving = order.filter((id) => ids.includes(id));
    const moves = dropMoves(zonesByRegion.get(target) ?? [], moving, anchor?.id ?? null, spot.place, (id) => zones.find((z) => z.id === id)?.regionId ?? null, target);
    if (moves.size === 0) return;
    onUpdateMany([...moves.keys()], (z) => {
      const move = moves.get(z.id);
      return move ? ("folder" in move && move.folder ? { regionId: move.folder, sortOrder: move.sortOrder } : { sortOrder: move.sortOrder }) : {};
    });
  });

  const zoneRow = (zone: ZoneData, region: ZoneRegionData, shared: boolean) => (
    <ItemRow
      key={zone.id}
      Icon={SHAPE_ICON[zone.shapeType]}
      color={zone.fillColor}
      label={zone.name}
      active={picked.has(zone.id)}
      visible={zone.visible}
      locked={zone.locked}
      lockedByFolder={region.locked}
      noun="zone"
      onSelect={(e) => onPick(zone.id, clickMods(e), order)}
      onToggleVisible={() => onUpdateZone(zone.id, { visible: !zone.visible })}
      onToggleLocked={() => onUpdateZone(zone.id, { locked: !zone.locked })}
      onDelete={() => onDeleteZone(zone.id)}
      dragProps={drag.itemProps(zone.id, {
        canDrag: canDrag(zone),
        canDrop: !shared && !region.locked,
        idsOf: () => (picked.has(zone.id) ? order.filter((id) => picked.has(id) && zones.some((z) => z.id === id && canDrag(z))) : [zone.id]),
      })}
      dropPlace={drag.placeOf(zone.id)}
      dragged={drag.isDragged(zone.id)}
    />
  );

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
    if (count > 0) return setDeletingRegion({ folder: region, count });
    if (openRegionId === region.id) setOpenRegionId(null);
    onDeleteRegion(region.id);
  }

  const openRegion = selectedIds.length === 0 ? (regions.find((r) => r.id === openRegionId && !sharedRegionIds.has(r.id)) ?? null) : null;

  return (
    <div className={selectedZone || openRegion || multi.length > 1 ? "zones-panel zones-panel-editing" : "zones-panel"}>
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
        <button className={activeTool === "select" ? "active" : ""} aria-label="Select / edit" data-tooltip="Select / edit" onClick={() => onSetActiveTool("select")}>
          <MousePointer2 size={15} strokeWidth={2.25} />
        </button>
        <button
          className={activeTool === "rectangle" ? "active" : ""} aria-label="Rectangle"
          data-tooltip="Rectangle / Square — hold Shift for an equal-sided square"
          disabled={drawingDisabled}
          onClick={() => onSetActiveTool("rectangle")}
        >
          <Square size={15} strokeWidth={2.25} />
        </button>
        <button
          className={activeTool === "circle" ? "active" : ""} aria-label="Circle"
          data-tooltip="Circle — press at the center and drag out the radius"
          disabled={drawingDisabled}
          onClick={() => onSetActiveTool("circle")}
        >
          <Circle size={15} strokeWidth={2.25} />
        </button>
        <button
          className={activeTool === "polygon" ? "active" : ""} aria-label="Polygon"
          data-tooltip="Polygon — click each vertex, click the first point (or press Enter) to close"
          disabled={drawingDisabled}
          onClick={() => onSetActiveTool("polygon")}
        >
          <Hexagon size={15} strokeWidth={2.25} />
        </button>
        <button
          className={activeTool === "brush" ? "active" : ""} aria-label="Brush"
          data-tooltip="Brush — paint a new zone, or paint onto the selected zone to grow it. [ and ] or Shift + mouse wheel change the size."
          disabled={drawingDisabled && !selectedZonePaintable}
          onClick={() => onSetActiveTool("brush")}
        >
          <Brush size={15} strokeWidth={2.25} />
        </button>
        <button
          className={activeTool === "eraser" ? "active" : ""} aria-label="Eraser"
          data-tooltip="Eraser — erase part of the selected zone. [ and ] or Shift + mouse wheel change the size."
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
            <button type="button" className="btn btn-sm" onClick={() => onSelectZone(null)} data-tooltip="Deselect so the next stroke starts a new zone (Esc)">
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
            isOpen={region.id === openRegion?.id}
            isExpanded={expanded.has(region.id)}
            activeTool={activeTool}
            onSelectRegion={() => {
              onSetActiveRegion(region.id);
              setOpenRegionId(region.id);
              onSelectZone(null);
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
            renderZone={(zone) => zoneRow(zone, region, sharedRegionIds.has(region.id))}
            dropProps={sharedRegionIds.has(region.id) ? undefined : drag.folderProps(region.id, !region.locked)}
            dropInto={drag.placeOf(region.id) === "into"}
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

      {multi.length > 1 && (
        <div className="zones-panel-editor">
          <MultiZoneEditor
            zones={multi}
            layers={layers}
            regionsOf={regionsOnLayerOf}
            endOf={endOf}
            regionOf={regionOf}
            isLocked={zoneLocked}
            onUpdateMany={(patchOf, opts) => onUpdateMany(selectedIds, patchOf, opts)}
            onDelete={() => onDeleteMany(selectedIds)}
            onDone={() => onSelectZone(null)}
            scaleConfig={scaleConfig}
          />
        </div>
      )}
      {selectedZone && (
        <div className="zones-panel-editor">
          <ZoneEditor
            zone={selectedZone}
            layers={layers}
            homeLayerId={selectedZoneRegion?.layerId ?? null}
            region={selectedZoneRegion}
            regionOptions={regionsOnLayerOf(selectedZoneRegion)}
            endOf={endOf}
            onUpdate={(patch) => onUpdateZone(selectedZone.id, patch)}
            onDelete={() => onDeleteZone(selectedZone.id)}
            onDone={() => onSelectZone(null)}
            scaleConfig={scaleConfig}
          />
        </div>
      )}
      {openRegion && (
        <div className="zones-panel-editor">
          <FolderSettings
            folder={openRegion}
            count={zonesByRegion.get(openRegion.id)?.length ?? 0}
            noun="zone"
            layers={layers}
            alwaysDrawFlag="zonesAlwaysVisible"
            captureStyle={() => ({ ...captureZoneStyle() })}
            renderStyle={(style, change) => <ZoneStyleFields v={{ ...captureZoneStyle(), ...style } as ZoneStyle} sectioned={false} onChange={change} />}
            onUpdate={(patch) => onUpdateRegion(openRegion.id, patch)}
            onDelete={() => requestDeleteRegion(openRegion)}
            onDone={() => setOpenRegionId(null)}
          />
        </div>
      )}
      <DeleteFolderDialog
        target={deletingRegion}
        noun="zone"
        canKeep={false}
        onConfirm={() => {
          if (deletingRegion) {
            onDeleteRegion(deletingRegion.folder.id, "cascade");
            if (openRegionId === deletingRegion.folder.id) setOpenRegionId(null);
          }
          setDeletingRegion(null);
        }}
        onCancel={() => setDeletingRegion(null)}
      />
    </div>
  );
}

/**
 * A zone's area (several zones: their total), live from its borders and the
 * map's scale, so it's never out of date after a reshape or recalibration.
 */
function ZoneArea({ zones, config }: { zones: ZoneData[]; config: ScaleConfig | null }) {
  const shapes = zones.flatMap((z) => zoneAreaShape(z.shapeType, z.geometry) ?? []);
  const areaPx = shapes.reduce((sum, s) => sum + shapeAreaPx(s), 0);
  return (
    <ToolSection id="zone-area" title={zones.length > 1 ? "Total area" : "Area"}>
      {!config ? (
        <Skeleton width="60%" />
      ) : config.framePxPerUnit === null ? (
        <p className="field-label">Calibrate the map&rsquo;s scale (Scale &amp; measure) to see {zones.length > 1 ? "their" : "this zone&rsquo;s"} area.</p>
      ) : (
        <AreaReadings areaPx={areaPx} perimeterPx={shapes.length === 1 ? shapePerimeterPx(shapes[0]) : undefined} config={config} />
      )}
    </ToolSection>
  );
}

/** Several zones' settings at once: a field shows its value when they agree, "Mixed" when not. */
function MultiZoneEditor({
  zones,
  layers,
  regionsOf,
  endOf,
  regionOf,
  isLocked,
  onUpdateMany,
  onDelete,
  onDone,
  scaleConfig,
}: {
  zones: ZoneData[];
  layers: MapLayerData[];
  regionsOf: (region: ZoneRegionData | undefined) => ZoneRegionData[];
  endOf: (regionId: string) => number;
  regionOf: (zone: ZoneData) => ZoneRegionData | undefined;
  isLocked: (zone: ZoneData) => boolean;
  onUpdateMany: (patchOf: (zone: ZoneData) => Partial<ZoneData>, opts?: { includeLocked?: boolean }) => void;
  onDelete: () => void;
  onDone: () => void;
  scaleConfig: ScaleConfig | null;
}) {
  const [first] = zones;
  const mixed = mixedKeys(zones);
  const layersOf = sharedLayers(zones.map((z) => z.extraLayerIds));
  const homeLayers = new Set(zones.map((z) => regionOf(z)?.layerId ?? null));
  const oneLayer = homeLayers.size === 1;
  const regionOptions = oneLayer ? regionsOf(regionOf(first)) : [];
  const allVisible = zones.every((z) => z.visible);
  const allLocked = zones.every((z) => z.locked);
  const setAll = (patch: Partial<ZoneData>) => onUpdateMany(() => patch);
  return (
    <div className="zone-editor">
      <MultiHeader
        Icon={Shapes}
        count={zones.length}
        noun="zone"
        lockedCount={zones.filter(isLocked).length}
        allVisible={allVisible}
        allLocked={allLocked}
        onToggleVisible={() => onUpdateMany(() => ({ visible: !allVisible }), { includeLocked: true })}
        onToggleLocked={() => onUpdateMany(() => ({ locked: !allLocked }), { includeLocked: true })}
        onDelete={onDelete}
        onDone={onDone}
      />
      <ZoneStyleFields v={first} mixed={mixed} onChange={setAll} />
      <ZoneArea zones={zones} config={scaleConfig} />
      <ToolSection id="zone-territory" title="Political territory">
        <ZoneTerritoryLink zone={first} mixed={mixed.has("territoryId")} onUpdate={setAll} />
      </ToolSection>
      <ToolSection id="zone-layers" title="Folder and layers">
        <FolderSelect
          value={first.regionId}
          mixed={mixed.has("regionId")}
          folders={regionOptions}
          disabled={!oneLayer}
          hint={oneLayer ? undefined : "Their regions are on different layers."}
          onChange={(regionId) => {
            if (!regionId) return;
            const start = endOf(regionId);
            // Moved zones go in last, keeping their order.
            onUpdateMany((z) => (z.regionId === regionId ? {} : { regionId, sortOrder: start + zones.indexOf(z) }));
          }}
        />
        <LayerChecklist
          layers={layers}
          homeLayerId={oneLayer ? (regionOf(first)?.layerId ?? null) : null}
          value={layersOf.all}
          mixedIds={layersOf.some}
          alwaysDrawFlag="zonesAlwaysVisible"
          onChange={() => undefined}
          onEdit={(add, remove) => onUpdateMany((z) => ({ extraLayerIds: editLayers(z.extraLayerIds, add, remove).filter((id) => id !== regionOf(z)?.layerId) }))}
        />
      </ToolSection>
    </div>
  );
}
