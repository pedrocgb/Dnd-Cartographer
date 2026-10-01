"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, FolderOpen, Lock, Plus, Route, Spline, Trash2, X } from "lucide-react";
import ColorWheel from "@/components/ColorWheel";
import LayerChecklist from "@/components/LayerChecklist";
import MarkerCard from "@/components/marker-panel/MarkerCard";
import SegmentedControl from "@/components/marker-panel/SegmentedControl";
import Toggle from "@/components/Toggle";
import ToolSection from "@/components/ToolSection";
import { SliderField } from "@/components/GridPanel";
import {
  DeleteFolderDialog,
  FolderRow,
  FolderSelect,
  FolderSettings,
  ItemRow,
  LayerSelect,
  MixedTag,
  MultiHeader,
  NameInput,
  SHARED,
  UNGROUPED,
  folderDropPatches,
  folderTree,
  swapOrder,
  type MapFolderData,
} from "@/components/LayerFolders";
import { clickMods, editLayers, mixedKeys, sharedLayers } from "@/components/multi-select";
import { useListDrag } from "@/components/use-list-drag";
import type { MapLayerData } from "@/components/layer-images";
import { COLOR_PRESETS } from "@/server/markers/icon-registry";
import { formatNumber, unitSuffix, type ScaleConfig } from "@/server/scale/scale-config";
import { DEFAULT_ROUTE_STYLE, ROUTE_STYLES, ROUTE_WIDTH, type MapRouteData, type RouteStyle, type RouteStyleKind } from "@/server/travel/route-config";
import { DEFAULT_TRAVEL, formatDuration, milesToUnit, modeOf, PACES, TRAVEL_MODES, type Pace, type TravelGroup, type TravelPlan, type TravelSettings } from "@/server/travel/travel";
import type { RouteControls, RoutePatch } from "./use-map-routes";
import { useSettings } from "@/components/settings/SettingsProvider";
import { distanceUnit, fromFeet, fromKg, fromLitres, fromMiles, roundForInput, shortLengthUnit, speedUnit, toFeet, toMiles, volumeUnit, weightUnit } from "@/server/settings/units";

const PACE_LABELS: Record<Pace, string> = { slow: "Slow", normal: "Normal", fast: "Fast" };
const STYLE_LABELS: Record<RouteStyleKind, string> = { solid: "Solid", dashed: "Dashed", dotted: "Dotted" };
const GROUPS: TravelGroup[] = ["Land", "Water", "Air"];
const DRAFT_KEY = "travel-draft";

export interface TravelDraft {
  style: RouteStyle;
  settings: TravelSettings;
}

/** The next route's look and travel settings, remembered in this browser. */
export function useTravelDraft() {
  const [draft, setDraft] = useState<TravelDraft>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return { style: { ...DEFAULT_ROUTE_STYLE, ...parsed?.style }, settings: { ...DEFAULT_TRAVEL, ...parsed?.settings } };
    } catch {
      return { style: DEFAULT_ROUTE_STYLE, settings: DEFAULT_TRAVEL };
    }
  });
  const update = (patch: { style?: Partial<RouteStyle>; settings?: Partial<TravelSettings> }) =>
    setDraft((prev) => {
      const next = { style: { ...prev.style, ...patch.style }, settings: { ...prev.settings, ...patch.settings } };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      } catch {
        // Private mode or blocked storage: the draft just isn't remembered.
      }
      return next;
    });
  return [draft, update] as const;
}

/** A number field that keeps what's typed until it's a valid number in range. */
function NumberField({ id, label, value, min, max, suffix, onChange }: { id: string; label: string; value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    if (Number(text.replace(",", ".")) !== value) setText(String(value));
  }
  return (
    <div className="travel-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <span className="travel-number">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value.replace(",", "."));
            if (e.target.value.trim() !== "" && v >= min && v <= max) onChange(v);
          }}
          onBlur={() => setText(String(value))}
        />
        {suffix && <span className="field-label">{suffix}</span>}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="travel-stat">
      <span className="field-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/** How the route is travelled: way of travel, pace, speed, hours a day, terrain, travellers. */
function TravelSettingsFields({ settings, config, idPrefix, onChange }: { settings: TravelSettings; config: ScaleConfig; idPrefix: string; onChange: (patch: Partial<TravelSettings>) => void }) {
  const mode = modeOf(settings.mode);
  const paced = mode.fixedMph === null && mode.key !== "custom";
  const canUseCreatureSpeed = paced && mode.key !== "flying-mount" && mode.speedFt !== null && mode.key !== "foot";
  const length = useSettings().settings.lengthSystem;
  const speed = (mph: number) => `${formatNumber(fromMiles(mph, length))} ${speedUnit(length)}`;
  /** Inputs show the user's units; settings keep mph, feet and miles. */
  const milesInput = (mph: number) => roundForInput(fromMiles(mph, length));
  return (
    <>
      <ToolSection id="travel-by" title="Travelling by">
        <select aria-label="Way of travel" value={settings.mode} onChange={(e) => onChange({ mode: e.target.value, hoursPerDay: modeOf(e.target.value).defaultHours, gallop: false })}>
          {GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {TRAVEL_MODES.filter((m) => m.group === group).map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                  {m.fixedMph !== null ? ` (${speed(m.fixedMph)})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {paced && (
          <div className="travel-field">
            <span className="field-label">Pace</span>
            <SegmentedControl ariaLabel="Pace" value={settings.pace} segments={PACES.map((key) => ({ key, label: PACE_LABELS[key] }))} onChange={(pace) => onChange({ pace })} />
          </div>
        )}
        {canUseCreatureSpeed && (
          <>
            <Toggle checked={settings.useCreatureSpeed} onChange={(useCreatureSpeed) => onChange({ useCreatureSpeed })} label={`Faster with its own speed (${formatNumber(fromFeet(mode.speedFt ?? 0, length))} ${shortLengthUnit(length)})`} />
            <p className="field-label">Off: animals and wagons keep the walkers&rsquo; pace. On: speed ÷ 10 = mph at a normal pace.</p>
          </>
        )}
        {mode.key === "flying-mount" && (
          <NumberField
            id={`${idPrefix}-fly`}
            label="Fly speed"
            value={roundForInput(fromFeet(settings.speedFt, length))}
            min={roundForInput(fromFeet(5, length))}
            max={roundForInput(fromFeet(300, length))}
            suffix={shortLengthUnit(length)}
            onChange={(v) => onChange({ speedFt: toFeet(v, length) })}
          />
        )}
        {mode.key === "custom" && (
          <NumberField
            id={`${idPrefix}-mph`}
            label="Speed"
            value={milesInput(settings.customMph)}
            min={milesInput(0.1)}
            max={milesInput(500)}
            suffix={speedUnit(length)}
            onChange={(v) => onChange({ customMph: toMiles(v, length) })}
          />
        )}
        {mode.group === "Water" && (
          <NumberField
            id={`${idPrefix}-current`}
            label="Current or wind (+ with, − against)"
            value={milesInput(settings.currentMph)}
            min={milesInput(-20)}
            max={milesInput(20)}
            suffix={speedUnit(length)}
            onChange={(v) => onChange({ currentMph: toMiles(v, length) })}
          />
        )}
      </ToolSection>
      <ToolSection id="travel-day" title="Each day">
        <SliderField label="Hours of travel" value={settings.hoursPerDay} min={1} max={24} suffix="h" defaultValue={mode.defaultHours} onChange={(hoursPerDay) => onChange({ hoursPerDay })} />
        {mode.mount && mode.group !== "Air" && !settings.useCreatureSpeed && (
          <Toggle checked={settings.gallop} onChange={(gallop) => onChange({ gallop })} label={`Gallop for an hour a day (${speed(8)})`} />
        )}
        {!mode.ignoresTerrain && (
          <>
            <SliderField label="Rough terrain" value={Math.round(settings.difficultShare * 100)} min={0} max={100} suffix="%" defaultValue={0} onChange={(v) => onChange({ difficultShare: v / 100 })} />
            <p className="field-label">Share of the route through rough ground (forest, swamp, mountains): half speed there.</p>
          </>
        )}
      </ToolSection>
      <ToolSection id="travel-supplies" title="Travellers">
        <NumberField id={`${idPrefix}-party`} label="Travellers" value={settings.partySize} min={0} max={1000} onChange={(partySize) => onChange({ partySize: Math.round(partySize) })} />
        <Toggle checked={settings.hotWeather} onChange={(hotWeather) => onChange({ hotWeather })} label="Hot weather (double water)" />
        {config.unit === "custom" && (
          <NumberField
            id={`${idPrefix}-unit`}
            label={`1 ${unitSuffix(config)} is`}
            value={roundForInput(fromMiles(settings.customUnitMiles, length))}
            min={0.01}
            max={roundForInput(fromMiles(100000, length))}
            suffix={distanceUnit(length)}
            onChange={(v) => onChange({ customUnitMiles: toMiles(v, length) })}
          />
        )}
      </ToolSection>
    </>
  );
}

const NO_MIXED: ReadonlySet<string> = new Set();

/** A route's line: color, width and dash style. `mixed`: fields that differ between several routes. */
function RouteStyleFields({ v, mixed = NO_MIXED, onChange }: { v: RouteStyle; mixed?: ReadonlySet<string>; onChange: (patch: Partial<RouteStyle>) => void }) {
  const colorMixed = mixed.has("color");
  return (
    <>
      <div className="travel-field">
        <span className="field-label">
          Color <MixedTag show={colorMixed} />
        </span>
        <div className="legend-colors-row" role="radiogroup" aria-label="Route color">
          {COLOR_PRESETS.map((hex) => (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={!colorMixed && hex.toUpperCase() === v.color.toUpperCase()}
              aria-label={hex}
              data-tooltip={hex}
              className={!colorMixed && hex.toUpperCase() === v.color.toUpperCase() ? "legend-color active" : "legend-color"}
              style={{ background: hex }}
              onClick={() => onChange({ color: hex })}
            />
          ))}
        </div>
        <ColorWheel value={v.color} mixed={colorMixed} onChange={(color) => onChange({ color })} />
      </div>
      <SliderField label="Width" value={v.width} mixed={mixed.has("width")} min={ROUTE_WIDTH[0]} max={ROUTE_WIDTH[1]} step={0.5} suffix="px" defaultValue={DEFAULT_ROUTE_STYLE.width} onChange={(width) => onChange({ width })} />
      <div className="travel-field">
        <span className="field-label">
          Line <MixedTag show={mixed.has("style")} />
        </span>
        <SegmentedControl ariaLabel="Line style" value={v.style} segments={ROUTE_STYLES.map((key) => ({ key, label: STYLE_LABELS[key] }))} onChange={(style) => onChange({ style })} />
      </div>
    </>
  );
}

/** The trip: time, speed, distance per day and supplies. */
export function Journey({ plan, settings, config }: { plan: TravelPlan | null; settings: TravelSettings; config: ScaleConfig }) {
  const { lengthSystem: length, weightSystem: weight } = useSettings().settings;
  const unit = unitSuffix(config);
  const distance = (miles: number) => `${formatNumber(fromMiles(miles, length))} ${distanceUnit(length)}`;
  // The map's own unit first, then the user's units when they differ.
  const inUnit = (miles: number) => (config.unit === distanceUnit(length) ? distance(miles) : `${formatNumber(milesToUnit(miles, config, settings))} ${unit} (${distance(miles)})`);
  if (!plan) return <p className="field-label">This way of travel doesn&rsquo;t move (check its speed).</p>;
  return (
    <div className="travel-journey">
      <div className="travel-hero">
        <span className="field-label">Travel time</span>
        <strong>{formatDuration(plan.fullDays, plan.extraHours)}</strong>
        <span className="field-label">
          {modeOf(settings.mode).label} · {formatNumber(fromMiles(plan.mph, length))} {speedUnit(length)} · {settings.hoursPerDay} h a day
        </span>
      </div>
      <div className="travel-stats">
        <Stat label="Distance" value={inUnit(plan.miles)} />
        <Stat label="Per day" value={inUnit(plan.milesPerDay)} />
        <Stat label="Days on the road" value={String(plan.daysOnRoad)} />
        <Stat label="Hours travelling" value={formatNumber(plan.totalHours)} />
      </div>
      {plan.gallopMiles > 0 && <p className="travel-note">Includes a one-hour gallop each day ({distance(plan.gallopMiles)}).</p>}
      {settings.partySize > 0 && (
        <div className="travel-stats">
          <Stat label="Food" value={`${formatNumber(fromKg(plan.foodKg, weight))} ${weightUnit(weight)}`} />
          <Stat label={settings.hotWeather ? "Water (hot)" : "Water"} value={`${formatNumber(fromLitres(plan.waterL, weight))} ${volumeUnit(weight)}`} />
        </div>
      )}
    </div>
  );
}

export const routeLabel = (route: Pick<MapRouteData, "name">, index: number) => route.name || `Route ${index + 1}`;

/**
 * The Travel tool. Left: "Start route", the active layer's route folders
 * (drag routes between them, ↑/↓ reorder folders, eye/lock/delete) and the
 * routes shared from other layers. Right: the selected route (name, look,
 * travel settings, trip, folder and layers), a folder's settings, or the
 * next route's settings.
 */
export default function TravelPanel({
  config,
  layers,
  activeLayerId,
  layerName,
  routes: controls,
  drawing,
  onToggleDrawing,
  redrawingId,
  onRedraw,
  draft,
  onDraftChange,
  planOf,
  livePlan,
  onOpenScale,
  onClose,
}: {
  config: ScaleConfig;
  layers: MapLayerData[];
  activeLayerId: string;
  layerName: string;
  routes: RouteControls;
  drawing: boolean;
  onToggleDrawing: () => void;
  redrawingId: string | null;
  onRedraw: (id: string | null) => void;
  draft: TravelDraft;
  onDraftChange: (patch: { style?: Partial<RouteStyle>; settings?: Partial<TravelSettings> }) => void;
  planOf: (route: MapRouteData) => TravelPlan | null;
  /** The trip of the route being drawn (null until it has two points). */
  livePlan: TravelPlan | null;
  onOpenScale: () => void;
  onClose: () => void;
}) {
  const { routes, groups, sel, update, remove, updateMany, deleteMany, createGroup, updateGroup, deleteGroup, isLocked } = controls;
  const activeGroupId = controls.activeGroupId;
  const onSetActiveGroup = controls.setActiveGroupId;
  const selectedId = sel.single;
  const onSelect = sel.select;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([UNGROUPED]));
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ folder: MapFolderData; count: number } | null>(null);
  const calibrated = config.framePxPerUnit !== null;

  const tree = folderTree(routes, groups, activeLayerId);
  const { ownGroups, itemsOf, ungrouped, shared, order } = tree;
  const selected = routes.find((r) => r.id === selectedId) ?? null;
  const picked = new Set(sel.ids);
  const multi = sel.ids.length > 1 ? routes.filter((r) => picked.has(r.id)) : [];
  const groupOf = (r: MapRouteData) => (r.groupId ? groups.find((g) => g.id === r.groupId) : undefined);
  const openFolder = ownGroups.find((g) => g.id === openFolderId) ?? null;
  const target = ownGroups.find((g) => g.id === activeGroupId) ?? null;
  const drawBlocked = Boolean(target && (target.locked || !target.visible));
  const layerNameOf = (id: string | null) => layers.find((l) => l.id === id)?.name ?? "another layer";
  const indexIn = (r: MapRouteData) => {
    const list = r.layerId !== activeLayerId ? shared : itemsOf(tree.folderOf(r));
    return Math.max(0, list.findIndex((x) => x.id === r.id));
  };

  // Selecting a route (on the map or in the list) opens its folder in the tree.
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  if ((selected?.id ?? null) !== lastSelectedId) {
    setLastSelectedId(selected?.id ?? null);
    setRenaming(false);
    const key = selected ? (selected.layerId !== activeLayerId ? SHARED : (tree.folderOf(selected) ?? UNGROUPED)) : null;
    if (key && !expanded.has(key)) setExpanded((prev) => new Set(prev).add(key));
  }

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const requestDelete = (group: MapFolderData) => {
    const count = itemsOf(group.id).length;
    if (count === 0) {
      if (openFolderId === group.id) setOpenFolderId(null);
      return void deleteGroup(group.id, false);
    }
    setDeleting({ folder: group, count });
  };

  const canDrag = (r: MapRouteData) => r.layerId === activeLayerId && !isLocked(r);
  const drag = useListDrag((ids, spot) => {
    const patches = folderDropPatches(tree, ids, spot);
    if (patches.size) updateMany([...patches.keys()], (r) => (patches.get(r.id) ?? {}) as RoutePatch, { includeLocked: true });
  });

  const routeRow = (route: MapRouteData, label: string, lockedByFolder: boolean) => (
    <ItemRow
      key={route.id}
      Icon={Spline}
      color={route.color}
      label={label}
      muted={!route.name}
      active={picked.has(route.id)}
      visible={route.visible}
      locked={route.locked}
      lockedByFolder={lockedByFolder}
      noun="route"
      onSelect={(e) => {
        setOpenFolderId(null);
        sel.click(route.id, clickMods(e), order);
      }}
      onToggleVisible={() => update(route.id, { visible: !route.visible })}
      onToggleLocked={() => update(route.id, { locked: !route.locked })}
      onDelete={() => remove(route.id)}
      dragProps={drag.itemProps(route.id, {
        canDrag: canDrag(route),
        canDrop: route.layerId === activeLayerId && !lockedByFolder,
        idsOf: () => (picked.has(route.id) ? order.filter((id) => picked.has(id) && routes.some((r) => r.id === id && canDrag(r))) : [route.id]),
      })}
      dropPlace={drag.placeOf(route.id)}
      dragged={drag.isDragged(route.id)}
    />
  );

  const header = (
    <div className="marker-side-panel-header">
      <h2>
        <Route size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
        Travel
      </h2>
      <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close travel panel">
        <X size={16} strokeWidth={2.25} />
      </button>
    </div>
  );

  if (!calibrated) {
    return (
      <div className="zones-panel travel-panel">
        <div className="zones-panel-main">
          {header}
          <div className="legend-items-empty">
            <Route size={28} strokeWidth={1.5} aria-hidden />
            <p>Calibrate the map first</p>
            <p className="field-label">Travel times need real distances: set the map&rsquo;s scale by measuring two points a known distance apart.</p>
            <button type="button" className="btn btn-sm btn-primary" onClick={onOpenScale}>
              Open Scale
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedFolderOptions = selected ? groups.filter((g) => g.layerId === selected.layerId).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const selectedGroup = selected ? groupOf(selected) : undefined;
  const selectedLocked = selected ? isLocked(selected) : false;

  return (
    <div className="zones-panel zones-panel-editing travel-panel">
      <div className="zones-panel-main">
        {header}
        <p className="panel-layer-label">Layer: {layerName}</p>

        <button
          type="button"
          className={drawing ? "btn btn-primary" : "btn"}
          disabled={drawBlocked && !drawing}
          data-tooltip={drawBlocked ? "The folder is hidden or locked" : undefined}
          onClick={() => {
            if (!drawing) {
              setOpenFolderId(null);
              onSelect(null);
            }
            onToggleDrawing();
          }}
        >
          <Route size={15} strokeWidth={2.25} />
          {drawing ? (redrawingId ? "Redrawing… (click to stop)" : "Drawing… (click to stop)") : "Start route"}
        </button>
        <p className="field-label zone-tool-hint">
          {drawing
            ? "Click point by point on the map. Right-click (or Enter) finishes and saves the route; Backspace removes the last point, Esc cancels."
            : "Click a route on the map or in the list to see and edit it, a folder for its settings. Ctrl/Shift+click picks several, Ctrl+A a whole folder."}
        </p>
        <p className="field-label line-panel-target">
          <FolderOpen size={13} strokeWidth={2.25} aria-hidden />
          New routes go into: <strong>{target ? target.name : "Ungrouped"}</strong>
          {target?.locked && " (locked)"}
          {target && !target.visible && " (hidden)"}
        </p>

        <ul className="zone-region-list">
          {ownGroups.map((group, i) => {
            const items = itemsOf(group.id);
            return (
              <FolderRow
                key={group.id}
                folder={group}
                count={items.length}
                noun="route"
                isTarget={group.id === activeGroupId}
                isOpen={group.id === openFolderId && sel.ids.length === 0}
                isExpanded={expanded.has(group.id)}
                canMoveUp={i > 0}
                canMoveDown={i < ownGroups.length - 1}
                onToggleExpand={() => toggle(group.id)}
                onOpen={() => {
                  onSetActiveGroup(group.id);
                  setOpenFolderId(group.id);
                  onSelect(null);
                  setExpanded((prev) => new Set(prev).add(group.id));
                }}
                onUpdate={(patch) => updateGroup(group.id, patch)}
                onMove={(dir) => swapOrder(ownGroups, group, dir).forEach(([id, sortOrder]) => updateGroup(id, { sortOrder }))}
                onDelete={() => requestDelete(group)}
                dropProps={drag.folderProps(group.id, !group.locked)}
                dropPlace={drag.placeOf(group.id)}
              >
                {items.length === 0 && <li className="field-label zone-empty-hint">No routes yet.</li>}
                {items.map((r, idx) => routeRow(r, routeLabel(r, idx), group.locked))}
              </FolderRow>
            );
          })}
          <li className="zone-region">
            <div className={["zone-region-row", activeGroupId === null && "active", drag.placeOf(UNGROUPED) && "drop-into"].filter(Boolean).join(" ")} {...drag.folderProps(UNGROUPED, true)}>
              <button className="zone-tree-toggle" onClick={() => toggle(UNGROUPED)} aria-label={expanded.has(UNGROUPED) ? "Collapse" : "Expand"}>
                {expanded.has(UNGROUPED) ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
              </button>
              <button
                className="zone-region-name line-panel-ungrouped"
                onClick={() => {
                  onSetActiveGroup(null);
                  setOpenFolderId(null);
                }}
                data-tooltip="Routes outside any folder. Click: new routes go here."
              >
                Ungrouped <span className="field-label">({ungrouped.length})</span>
              </button>
            </div>
            {expanded.has(UNGROUPED) && (
              <ul className="zone-list">
                {ungrouped.length === 0 && <li className="field-label zone-empty-hint">No routes outside folders.</li>}
                {ungrouped.map((r, i) => routeRow(r, routeLabel(r, i), false))}
              </ul>
            )}
          </li>
          {shared.length > 0 && (
            <li className="zone-region">
              <div className="zone-region-row">
                <button className="zone-tree-toggle" onClick={() => toggle(SHARED)} aria-label={expanded.has(SHARED) ? "Collapse" : "Expand"}>
                  {expanded.has(SHARED) ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
                </button>
                <button className="zone-region-name" onClick={() => toggle(SHARED)}>
                  From other layers <span className="field-label">({shared.length})</span>
                </button>
              </div>
              {expanded.has(SHARED) && <ul className="zone-list">{shared.map((r, i) => routeRow(r, `${routeLabel(r, i)} · ${layerNameOf(r.layerId)}`, Boolean(groupOf(r)?.locked)))}</ul>}
            </li>
          )}
        </ul>

        {creating ? (
          <div className="zone-new-region">
            <NameInput
              value=""
              placeholder="Folder name (e.g. Trade roads, Campaign trips)"
              label="New folder name"
              onSave={(name) => {
                setCreating(false);
                if (name) void createGroup(name);
              }}
              onCancel={() => setCreating(false)}
            />
          </div>
        ) : (
          <button className="btn btn-sm" onClick={() => setCreating(true)}>
            <Plus size={14} strokeWidth={2.25} />
            New folder
          </button>
        )}
        {controls.error && <p className="form-error">{controls.error}</p>}
      </div>

      <div className="zones-panel-editor">
        {multi.length > 1 ? (
          <MultiRouteEditor
            routes={multi}
            layers={layers}
            groups={groups}
            config={config}
            planOf={planOf}
            folderOf={(r) => (r.groupId && groups.some((g) => g.id === r.groupId) ? r.groupId : null)}
            isLocked={isLocked}
            onUpdateMany={(patchOf, opts) => updateMany(sel.ids, patchOf, opts)}
            onDelete={() => deleteMany(sel.ids)}
            onDone={() => onSelect(null)}
          />
        ) : selected ? (
          <>
            <div className="zone-editor-header">
              <Spline size={14} strokeWidth={2.25} style={{ color: selected.color }} />
              {renaming ? (
                <NameInput
                  value={selected.name}
                  placeholder={routeLabel({ name: "" }, indexIn(selected))}
                  label="Route name"
                  onSave={(name) => {
                    setRenaming(false);
                    if (name !== selected.name) update(selected.id, { name });
                  }}
                  onCancel={() => setRenaming(false)}
                />
              ) : (
                <button type="button" className="zone-region-name line-panel-name" onClick={() => setRenaming(true)} data-tooltip="Rename">
                  {routeLabel(selected, indexIn(selected))}
                </button>
              )}
              <button type="button" className="btn btn-sm btn-primary zone-editor-done" onClick={() => onSelect(null)}>
                <Check size={13} strokeWidth={2.25} />
                Done
              </button>
            </div>
            {selectedLocked && (
              <p className="field-label line-panel-locked">
                <Lock size={12} strokeWidth={2.25} aria-hidden /> Locked{selectedGroup?.locked ? " by its folder" : ""}. Unlock it to edit it.
              </p>
            )}
            <Journey plan={planOf(selected)} settings={selected.settings} config={config} />
            {!selectedLocked && redrawingId !== selected.id && (
              <p className="field-label zone-tool-hint">On the map: drag a point to move it, drag a + to add one, right-click (or double-click) a point to remove it.</p>
            )}
            <fieldset className="line-panel-fieldset" disabled={selectedLocked}>
              <MarkerCard title="How it's travelled" defaultOpen>
                <TravelSettingsFields settings={selected.settings} config={config} idPrefix={`route-${selected.id}`} onChange={(settings) => update(selected.id, { settings })} />
              </MarkerCard>
              <MarkerCard title="Look">
                <RouteStyleFields v={selected} onChange={(patch) => update(selected.id, patch)} />
              </MarkerCard>
              <MarkerCard title="Folder and layers">
                <FolderSelect
                  value={selectedGroup && selectedFolderOptions.includes(selectedGroup) ? selectedGroup.id : null}
                  folders={selectedFolderOptions}
                  noneLabel="Ungrouped"
                  onChange={(groupId) => update(selected.id, { groupId })}
                />
                <LayerSelect value={selected.layerId} layers={layers} onChange={(layerId) => update(selected.id, { layerId, extraLayerIds: selected.extraLayerIds.filter((id) => id !== layerId) })} />
                <LayerChecklist
                  layers={layers}
                  homeLayerId={selected.layerId}
                  value={selected.extraLayerIds}
                  alwaysDrawFlag="routesAlwaysVisible"
                  inherited={selectedGroup ? { ids: selectedGroup.extraLayerIds, from: selectedGroup.name } : undefined}
                  onChange={(extraLayerIds) => update(selected.id, { extraLayerIds })}
                />
              </MarkerCard>
              <div className="travel-actions">
                <button type="button" className={redrawingId === selected.id ? "btn btn-sm btn-primary" : "btn btn-sm"} onClick={() => onRedraw(redrawingId === selected.id ? null : selected.id)}>
                  <Route size={14} strokeWidth={2.25} />
                  {redrawingId === selected.id ? "Cancel redraw" : "Redraw route"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => remove(selected.id)}
                >
                  <Trash2 size={14} strokeWidth={2.25} />
                  Delete route
                </button>
              </div>
            </fieldset>
          </>
        ) : openFolder ? (
          <FolderSettings
            folder={openFolder}
            count={itemsOf(openFolder.id).length}
            noun="route"
            layers={layers}
            alwaysDrawFlag="routesAlwaysVisible"
            captureStyle={() => ({ ...draft.style, settings: draft.settings })}
            renderStyle={(style, change) => <RouteStyleFields v={{ ...draft.style, ...style } as RouteStyle} onChange={change} />}
            onUpdate={(patch) => updateGroup(openFolder.id, patch)}
            onDelete={() => requestDelete(openFolder)}
            onDone={() => setOpenFolderId(null)}
          />
        ) : (
          <>
            <div className="zone-editor-header">
              <Spline size={14} strokeWidth={2.25} style={{ color: draft.style.color }} />
              <span className="line-panel-name">{drawing ? "Route being drawn" : "Next route"}</span>
            </div>
            {drawing && livePlan && <Journey plan={livePlan} settings={draft.settings} config={config} />}
            {!drawing && <p className="field-label zone-tool-hint">How the next route is travelled and how it looks. Press &ldquo;Start route&rdquo; to draw it.</p>}
            <MarkerCard title="How it's travelled" defaultOpen>
              <TravelSettingsFields settings={draft.settings} config={config} idPrefix="draft" onChange={(settings) => onDraftChange({ settings })} />
            </MarkerCard>
            <MarkerCard title="Look">
              {target?.defaultStyle ? (
                <>
                  <p className="field-label zone-tool-hint">New routes in &ldquo;{target.name}&rdquo; use the folder&rsquo;s default look.</p>
                  <button type="button" className="btn btn-sm" onClick={() => setOpenFolderId(target.id)}>
                    <FolderOpen size={13} strokeWidth={2.25} />
                    Edit the folder&rsquo;s look
                  </button>
                </>
              ) : (
                <RouteStyleFields v={draft.style} onChange={(style) => onDraftChange({ style })} />
              )}
            </MarkerCard>
          </>
        )}
      </div>

      <DeleteFolderDialog
        target={deleting}
        noun="route"
        canKeep
        onConfirm={(cascade) => {
          if (deleting) {
            void deleteGroup(deleting.folder.id, cascade);
            if (openFolderId === deleting.folder.id) setOpenFolderId(null);
          }
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

/** Several routes at once: a field shows its value when they agree, "Mixed" when not. */
function MultiRouteEditor({
  routes,
  layers,
  groups,
  config,
  planOf,
  folderOf,
  isLocked,
  onUpdateMany,
  onDelete,
  onDone,
}: {
  routes: MapRouteData[];
  layers: MapLayerData[];
  groups: MapFolderData[];
  config: ScaleConfig;
  planOf: (route: MapRouteData) => TravelPlan | null;
  folderOf: (route: MapRouteData) => string | null;
  isLocked: (route: MapRouteData) => boolean;
  onUpdateMany: (patchOf: (route: MapRouteData) => RoutePatch, opts?: { includeLocked?: boolean }) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const [first] = routes;
  const mixed = mixedKeys(routes);
  const layersOf = sharedLayers(routes.map((r) => r.extraLayerIds));
  const folders = new Set(routes.map(folderOf));
  const oneLayer = !mixed.has("layerId");
  const folderOptions = oneLayer ? groups.filter((g) => g.layerId === first.layerId).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const allVisible = routes.every((r) => r.visible);
  const allLocked = routes.every((r) => r.locked);
  const setAll = (patch: RoutePatch) => onUpdateMany(() => patch);
  // Back to back: every trip's days on the road and hours travelling added up.
  const plans = routes.map(planOf);
  const complete = plans.every((plan): plan is TravelPlan => plan !== null);
  const totalHours = complete ? plans.reduce((sum, plan) => sum + (plan?.totalHours ?? 0), 0) : null;
  const totalDays = complete ? plans.reduce((sum, plan) => sum + (plan?.daysOnRoad ?? 0), 0) : 0;
  return (
    <>
      <MultiHeader
        Icon={Spline}
        count={routes.length}
        noun="route"
        lockedCount={routes.filter(isLocked).length}
        allVisible={allVisible}
        allLocked={allLocked}
        onToggleVisible={() => onUpdateMany(() => ({ visible: !allVisible }), { includeLocked: true })}
        onToggleLocked={() => onUpdateMany(() => ({ locked: !allLocked }), { includeLocked: true })}
        onDelete={onDelete}
        onDone={onDone}
      />
      {totalHours !== null && (
        <div className="travel-hero">
          <span className="field-label">One after another</span>
          <strong>
            {totalDays} {totalDays === 1 ? "day" : "days"} on the road
          </strong>
          <span className="field-label">{formatNumber(totalHours)} hours travelling in all</span>
        </div>
      )}
      <MarkerCard title="How they're travelled" defaultOpen>
        {mixed.has("settings") && <p className="field-label zone-tool-hint">They&rsquo;re travelled differently: shown is the first one&rsquo;s. A change applies to all.</p>}
        <TravelSettingsFields settings={first.settings} config={config} idPrefix="routes" onChange={(settings) => onUpdateMany((r) => ({ settings: { ...r.settings, ...settings } }))} />
      </MarkerCard>
      <MarkerCard title="Look">
        <RouteStyleFields v={first} mixed={mixed} onChange={setAll} />
      </MarkerCard>
      <MarkerCard title="Folder and layers">
        <FolderSelect
          value={folderOf(first)}
          mixed={folders.size > 1}
          folders={folderOptions}
          noneLabel="Ungrouped"
          disabled={!oneLayer}
          hint={oneLayer ? undefined : "They're on different layers: move them to one layer first."}
          onChange={(groupId) => setAll({ groupId })}
        />
        <LayerSelect value={first.layerId} mixed={!oneLayer} layers={layers} onChange={(layerId) => setAll({ layerId })} />
        <LayerChecklist
          layers={layers}
          homeLayerId={oneLayer ? first.layerId : null}
          value={layersOf.all}
          mixedIds={layersOf.some}
          alwaysDrawFlag="routesAlwaysVisible"
          onChange={() => undefined}
          onEdit={(add, removed) => onUpdateMany((r) => ({ extraLayerIds: editLayers(r.extraLayerIds, add, removed).filter((id) => id !== r.layerId) }))}
        />
      </MarkerCard>
    </>
  );
}
