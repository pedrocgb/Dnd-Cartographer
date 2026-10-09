"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Route, Spline, X } from "lucide-react";
import {
  DeleteFolderDialog,
  FolderRow,
  FolderSettings,
  ItemRow,
  NameInput,
  SHARED,
  UNGROUPED,
  folderDropPatches,
  folderTree,
  swapOrder,
  type MapFolderData,
} from "@/components/LayerFolders";
import { clickMods } from "@/components/multi-select";
import { useListDrag } from "@/components/use-list-drag";
import type { MapLayerData } from "@/components/layer-images";
import type { ScaleConfig } from "@/server/scale/scale-config";
import type { MapRouteData, RouteStyle } from "@/server/travel/route-config";
import type { RouteControls, RoutePatch } from "./use-map-routes";
import { useT } from "@/i18n/useT";
import { RouteStyleFields, routeLabel, type TravelDraft } from "./travel-fields";

/**
 * The Travel tool's list: the active layer's folders of routes (drag routes
 * between them, ↑/↓ reorder folders, eye/lock/delete) and the routes shared
 * from other layers; the travel bar draws and edits them. A clicked folder's
 * settings replace the list.
 */
export default function TravelPanel({
  config,
  layers,
  activeLayerId,
  layerName,
  routes: controls,
  draft,
  onOpenScale,
  onClose,
}: {
  config: ScaleConfig;
  layers: MapLayerData[];
  activeLayerId: string;
  layerName: string;
  routes: RouteControls;
  /** The next route's look and travel: where a folder's default starts. */
  draft: TravelDraft;
  onOpenScale: () => void;
  onClose: () => void;
}) {
  const t = useT("maps");
  const tc = useT("common");
  const { routes, groups, sel, update, remove, updateMany, createGroup, updateGroup, deleteGroup, isLocked } = controls;
  const activeGroupId = controls.activeGroupId;
  const onSetActiveGroup = controls.setActiveGroupId;
  const selectedId = sel.single;
  const onSelect = sel.select;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([UNGROUPED]));
  const [creating, setCreating] = useState(false);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ folder: MapFolderData; count: number } | null>(null);
  const calibrated = config.framePxPerUnit !== null;

  const tree = folderTree(routes, groups, activeLayerId);
  const { ownGroups, itemsOf, ungrouped, shared, order } = tree;
  const selected = routes.find((r) => r.id === selectedId) ?? null;
  const picked = new Set(sel.ids);
  const groupOf = (r: MapRouteData) => (r.groupId ? groups.find((g) => g.id === r.groupId) : undefined);
  const openFolder = sel.ids.length === 0 ? (ownGroups.find((g) => g.id === openFolderId) ?? null) : null;
  const layerNameOf = (id: string | null) => layers.find((l) => l.id === id)?.name ?? t("panel.anotherLayer");

  // Selecting a route (on the map or in the list) opens its folder in the tree.
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  if ((selected?.id ?? null) !== lastSelectedId) {
    setLastSelectedId(selected?.id ?? null);
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
        {t("panel.travel")}
      </h2>
      <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={tc("closePanel", { title: t("panel.travel") })}>
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
            <p>{t("travel.calibrateTitle")}</p>
            <p className="field-label">{t("travel.calibrateHint")}</p>
            <button type="button" className="btn btn-sm btn-primary" onClick={onOpenScale}>
              {t("travel.openScale")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="zones-panel travel-panel">
      <div className="zones-panel-main">
        {header}
        <p className="panel-layer-label">{t("panel.layer", { name: layerName })}</p>

        {openFolder ? (
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
        <p className="field-label zone-tool-hint">{t("travel.idleHint")}</p>
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
                {items.length === 0 && <li className="field-label zone-empty-hint">{t("travel.emptyFolder")}</li>}
                {items.map((r, idx) => routeRow(r, routeLabel(r, idx), group.locked))}
              </FolderRow>
            );
          })}
          <li className="zone-region">
            <div className={["zone-region-row", activeGroupId === null && "active", drag.placeOf(UNGROUPED) && "drop-into"].filter(Boolean).join(" ")} {...drag.folderProps(UNGROUPED, true)}>
              <button className="zone-tree-toggle" onClick={() => toggle(UNGROUPED)} aria-label={expanded.has(UNGROUPED) ? t("layerFolders.collapse") : t("layerFolders.expand")}>
                {expanded.has(UNGROUPED) ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
              </button>
              <button
                className="zone-region-name line-panel-ungrouped"
                onClick={() => {
                  onSetActiveGroup(null);
                  setOpenFolderId(null);
                }}
                data-tooltip={t("travel.ungroupedHint")}
              >
                {t("panel.ungrouped")} <span className="field-label">({ungrouped.length})</span>
              </button>
            </div>
            {expanded.has(UNGROUPED) && (
              <ul className="zone-list">
                {ungrouped.length === 0 && <li className="field-label zone-empty-hint">{t("travel.ungroupedEmpty")}</li>}
                {ungrouped.map((r, i) => routeRow(r, routeLabel(r, i), false))}
              </ul>
            )}
          </li>
          {shared.length > 0 && (
            <li className="zone-region">
              <div className="zone-region-row">
                <button className="zone-tree-toggle" onClick={() => toggle(SHARED)} aria-label={expanded.has(SHARED) ? t("layerFolders.collapse") : t("layerFolders.expand")}>
                  {expanded.has(SHARED) ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
                </button>
                <button className="zone-region-name" onClick={() => toggle(SHARED)}>
                  {t("panel.fromOtherLayers")} <span className="field-label">({shared.length})</span>
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
              placeholder={t("travel.folderPlaceholder")}
              label={t("panel.newFolderName")}
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
            {t("panel.newFolder")}
          </button>
        )}
        </>
        )}
        {controls.error && <p className="form-error">{controls.error}</p>}
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
