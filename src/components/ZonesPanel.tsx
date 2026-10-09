"use client";

import { formatInteger } from "@/server/settings/number-format";
import { useState } from "react";
import { X, Shapes, Plus, Check, ChevronRight, ChevronDown, Eye, EyeOff, Lock, LockOpen, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { DeleteFolderDialog, FolderSettings, ItemRow, type FolderPatch, type MapFolderData } from "./LayerFolders";
import { clickMods, dropMoves, type ClickMods } from "./multi-select";
import { useListDrag } from "./use-list-drag";
import type { MapLayerData } from "./layer-images";
import type { ZoneData, ZoneRegionData, ZoneTool } from "./ZoneLayer";
import { SHAPE_ICON, ZoneStyleFields, type ZoneStyle } from "./zone-fields";
import { useT } from "@/i18n/useT";

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
  const t = useT("maps");
  const tc = useT("common");
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
        <button className="zone-tree-toggle" onClick={onToggleExpand} aria-label={isExpanded ? t("layerFolders.collapse") : t("layerFolders.expand")}>
          {isExpanded ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
        </button>
        {renaming ? (
          <input
            type="text"
            className="zone-region-name-input"
            value={draftName}
            autoFocus
            aria-label={t("zones.region.name")}
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
            data-tooltip={sharedFrom ? undefined : t("zones.region.openHint")}
          >
            {region.name} <span className="field-label">({zones.length})</span>
            {sharedFrom && <span className="field-label zone-region-shared">{t("layerFolders.from", { layer: sharedFrom })}</span>}
            {!sharedFrom && region.extraLayerIds.length > 0 && (
              <span className="field-label zone-region-shared">{t("layerFolders.extraLayers", { count: region.extraLayerIds.length, n: formatInteger(region.extraLayerIds.length) })}</span>
            )}
          </button>
        )}
        {!sharedFrom && (
        <div className="zone-row-actions">
          <button className="btn btn-ghost btn-icon-xs" onClick={() => onMoveRegion("up")} disabled={!canMoveUp} aria-label={t("zones.region.moveUp")} data-tooltip={t("layerFolders.moveUpHint")}>
            <ArrowUp size={12} strokeWidth={2.25} />
          </button>
          <button className="btn btn-ghost btn-icon-xs" onClick={() => onMoveRegion("down")} disabled={!canMoveDown} aria-label={t("zones.region.moveDown")} data-tooltip={t("layerFolders.moveDownHint")}>
            <ArrowDown size={12} strokeWidth={2.25} />
          </button>
          <button
            className="btn btn-ghost btn-icon-xs"
            onClick={() => onUpdateRegion({ visible: !region.visible })}
            aria-label={region.visible ? t("zones.region.hide") : t("zones.region.show")}
            data-tooltip={region.visible ? t("zones.region.hide") : t("zones.region.show")}
          >
            {region.visible ? <Eye size={12} strokeWidth={2.25} /> : <EyeOff size={12} strokeWidth={2.25} />}
          </button>
          <button
            className="btn btn-ghost btn-icon-xs"
            onClick={() => onUpdateRegion({ locked: !region.locked })}
            aria-label={region.locked ? t("zones.region.unlock") : t("zones.region.lock")}
            data-tooltip={region.locked ? t("zones.region.unlock") : t("zones.region.lock")}
          >
            {region.locked ? <Lock size={12} strokeWidth={2.25} /> : <LockOpen size={12} strokeWidth={2.25} />}
          </button>
          <button className="btn btn-ghost btn-icon-xs" onClick={onDeleteRegion} aria-label={t("zones.region.delete")} data-tooltip={t("zones.region.delete")}>
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
                {tc("done")}
              </button>
            ) : (
              <button
                type="button"
                className="zone-add-row"
                onClick={onStartAddZone}
                disabled={addZoneDisabled}
                data-tooltip={addZoneDisabled ? t("zones.region.addBlocked") : t("zones.region.addHint")}
              >
                <Plus size={13} strokeWidth={2.25} />
                {t("zones.region.addZone")}
              </button>
            )}
          </li>
          )}
          {zones.length === 0 && <li className="field-label zone-empty-hint">{t("zones.region.empty")}</li>}
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
  activeTool,
  onSetActiveRegion,
  onSetActiveTool,
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
}: {
  /** Name of the active layer this tool edits. */
  layerName: string;
  regions: ZoneRegionData[];
  zones: ZoneData[];
  activeRegionId: string | null;
  activeTool: ZoneTool;
  onSetActiveRegion: (id: string) => void;
  onSetActiveTool: (tool: ZoneTool) => void;
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
  /** Every selected zone (the zone bar edits them). */
  selectedIds: string[];
  /** A click on a zone in the list (Ctrl/Shift pick several); `order` is the list as shown. */
  onPick: (id: string, mods: ClickMods, order: string[]) => void;
  /** One edit of several zones (locked ones are skipped unless `includeLocked`). */
  onUpdateMany: (ids: string[], patchOf: (zone: ZoneData) => Partial<ZoneData>, opts?: { includeLocked?: boolean }) => void;
}) {
  const t = useT("maps");
  const tc = useT("common");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creatingRegion, setCreatingRegion] = useState(false);
  const [newRegionName, setNewRegionName] = useState("");
  /** The region whose settings replace the list (when no zone is selected). */
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
  const layerNameOf = (id: string | null) => layers.find((l) => l.id === id)?.name ?? t("panel.anotherLayer");
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
  const regionOf = (z: ZoneData) => regions.find((r) => r.id === z.regionId);
  const zoneLocked = (z: ZoneData) => z.locked || Boolean(regionOf(z)?.locked);

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
    <div className="zones-panel">
      <div className="zones-panel-main">
      <div className="marker-side-panel-header">
        <h2>
          <Shapes size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          {t("panel.zones")}
        </h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={tc("closePanel", { title: t("panel.zones") })}>
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>
      <p className="panel-layer-label">{t("panel.layer", { name: layerName })}</p>

      {openRegion ? (
        <FolderSettings
          folder={openRegion}
          count={zonesByRegion.get(openRegion.id)?.length ?? 0}
          noun="zone"
          layers={layers}
          alwaysDrawFlag="zonesAlwaysVisible"
          captureStyle={() => ({ ...captureZoneStyle() })}
          renderStyle={(style, change) => <ZoneStyleFields v={{ ...captureZoneStyle(), ...style } as ZoneStyle} onChange={change} />}
          onUpdate={(patch) => onUpdateRegion(openRegion.id, patch)}
          onDelete={() => requestDeleteRegion(openRegion)}
          onDone={() => setOpenRegionId(null)}
        />
      ) : (
      <>
      <ul className="zone-region-list">
        {sortedRegions.map((region, i) => (
          <RegionRow
            key={region.id}
            region={region}
            zones={zonesByRegion.get(region.id) ?? []}
            isActive={region.id === activeRegionId}
            isOpen={false}
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
            placeholder={t("zones.newRegion.placeholder")}
            value={newRegionName}
            autoFocus
            onChange={(e) => setNewRegionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewRegion();
              if (e.key === "Escape") setCreatingRegion(false);
            }}
          />
          <button className="btn btn-sm btn-primary" onClick={submitNewRegion}>
            {tc("create")}
          </button>
          <button className="btn btn-sm" onClick={() => setCreatingRegion(false)}>
            {tc("cancel")}
          </button>
        </div>
      ) : (
        <button className="btn btn-sm" onClick={() => setCreatingRegion(true)}>
          <Plus size={14} strokeWidth={2.25} />
          {t("zones.newRegion.button")}
        </button>
      )}
      </>
      )}
      </div>
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

