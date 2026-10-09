"use client";

import { useState } from "react";
import { X, PenTool, Pencil, Spline, Plus, ChevronRight, ChevronDown } from "lucide-react";
import type { MapLayerData } from "./layer-images";
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
  type FolderPatch,
  type MapFolderData,
} from "./LayerFolders";
import type { MapLineData } from "./LineLayer";
import { clickMods, type ClickMods } from "./multi-select";
import { useListDrag } from "./use-list-drag";
import type { LineStyle } from "@/server/lines/line-config";
import { useT } from "@/i18n/useT";
import { LineStyleFields, lineLabel, type LinePatch } from "./line-fields";

export type { LinePatch };

/**
 * The Lines tool's list: the active layer's folders of lines (show/hide,
 * lock, reorder, rename, delete, drag and drop; the line bar draws and edits
 * them). A clicked folder's settings replace the list.
 */
export default function LinePanel({
  layerName,
  selected,
  draft,
  layers,
  maxWidth,
  lines,
  groups,
  activeLayerId,
  activeGroupId,
  onClose,
  onSetActiveGroup,
  onSelectLine,
  onUpdateLine,
  onDeleteLine,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  selectedIds,
  onPick,
  onUpdateMany,
}: {
  /** Name of the active layer this tool edits. */
  layerName: string;
  /** The one selected line: its folder opens in the list. */
  selected: MapLineData | null;
  /** The next line's style: where a folder's default style starts. */
  draft: LineStyle;
  layers: MapLayerData[];
  maxWidth: number;
  /** Lines on the active layer (home or shown here). */
  lines: MapLineData[];
  /** Every folder of the map. */
  groups: MapFolderData[];
  activeLayerId: string;
  /** Where new lines go; null = Ungrouped. */
  activeGroupId: string | null;
  onClose: () => void;
  onSetActiveGroup: (id: string | null) => void;
  onSelectLine: (id: string | null) => void;
  onUpdateLine: (id: string, patch: LinePatch) => void;
  onDeleteLine: (id: string) => void;
  onCreateGroup: (name: string) => void;
  onUpdateGroup: (id: string, patch: FolderPatch) => void;
  onDeleteGroup: (id: string, cascade: boolean) => void;
  /** Every selected line (the line bar edits them). */
  selectedIds: string[];
  /** A click on a line in the list (Ctrl/Shift pick several); `order` is the list as shown. */
  onPick: (id: string, mods: ClickMods, order: string[]) => void;
  /** One edit of several lines (locked ones are skipped unless `includeLocked`). */
  onUpdateMany: (ids: string[], patchOf: (line: MapLineData) => LinePatch, opts?: { includeLocked?: boolean }) => void;
}) {
  const t = useT("maps");
  const tc = useT("common");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([UNGROUPED]));
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<{ folder: MapFolderData; count: number } | null>(null);
  /** The folder whose settings replace the list (when no line is selected). */
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);

  const tree = folderTree(lines, groups, activeLayerId);
  const { ownGroups, itemsOf: linesOf, ungrouped, shared, order } = tree;
  const layerNameOf = (id: string | null) => layers.find((l) => l.id === id)?.name ?? t("panel.anotherLayer");
  const groupOf = (l: MapLineData) => (l.groupId ? groups.find((g) => g.id === l.groupId) : undefined);
  const openFolder = selectedIds.length === 0 ? (ownGroups.find((g) => g.id === openFolderId) ?? null) : null;
  const picked = new Set(selectedIds);
  const isLocked = (l: MapLineData) => l.locked || Boolean(groupOf(l)?.locked);

  // Selecting a line (on the map or in the list) opens its folder in the tree.
  const selectedFolderKey = selected ? (selected.layerId !== activeLayerId ? SHARED : (tree.folderOf(selected) ?? UNGROUPED)) : null;
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  if ((selected?.id ?? null) !== lastSelectedId) {
    setLastSelectedId(selected?.id ?? null);
    if (selectedFolderKey && !expanded.has(selectedFolderKey)) setExpanded((prev) => new Set(prev).add(selectedFolderKey));
  }

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const openGroup = (group: MapFolderData) => {
    onSetActiveGroup(group.id);
    setOpenFolderId(group.id);
    onSelectLine(null);
    setExpanded((prev) => new Set(prev).add(group.id));
  };
  const requestDelete = (group: MapFolderData) => {
    const count = linesOf(group.id).length;
    if (count === 0) {
      if (openFolderId === group.id) setOpenFolderId(null);
      return onDeleteGroup(group.id, false);
    }
    setDeleting({ folder: group, count });
  };

  // Drag and drop: unlocked home lines move into a folder or next to another line.
  const canDrag = (l: MapLineData) => l.layerId === activeLayerId && !isLocked(l);
  const drag = useListDrag((ids, spot) => {
    const patches = folderDropPatches(tree, ids, spot);
    if (patches.size) onUpdateMany([...patches.keys()], (l) => patches.get(l.id) ?? {}, { includeLocked: true });
  });

  const lineRow = (line: MapLineData, label: string, lockedByFolder: boolean) => {
    const home = line.layerId === activeLayerId;
    return (
      <ItemRow
        key={line.id}
        Icon={line.kind === "pen" ? Spline : Pencil}
        color={line.color}
        label={label}
        muted={!line.name}
        active={picked.has(line.id)}
        visible={line.visible}
        locked={line.locked}
        lockedByFolder={lockedByFolder}
        noun="line"
        onSelect={(e) => onPick(line.id, clickMods(e), order)}
        onToggleVisible={() => onUpdateLine(line.id, { visible: !line.visible })}
        onToggleLocked={() => onUpdateLine(line.id, { locked: !line.locked })}
        onDelete={() => onDeleteLine(line.id)}
        dragProps={drag.itemProps(line.id, {
          canDrag: canDrag(line),
          canDrop: home && !lockedByFolder,
          idsOf: () => (picked.has(line.id) ? order.filter((id) => picked.has(id) && lines.some((l) => l.id === id && canDrag(l))) : [line.id]),
        })}
        dropPlace={drag.placeOf(line.id)}
        dragged={drag.isDragged(line.id)}
      />
    );
  };

  return (
    <div className="zones-panel line-panel">
      <div className="zones-panel-main">
        <div className="marker-side-panel-header">
          <h2>
            <PenTool size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            {t("panel.lines")}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={tc("closePanel", { title: t("panel.lines") })}>
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>
        <p className="panel-layer-label">{t("panel.layer", { name: layerName })}</p>

        {openFolder ? (
          <FolderSettings
            folder={openFolder}
            count={linesOf(openFolder.id).length}
            noun="line"
            layers={layers}
            alwaysDrawFlag="linesAlwaysVisible"
            captureStyle={() => ({ ...draft })}
            renderStyle={(style, change) => <LineStyleFields v={{ ...draft, ...style } as LineStyle} maxWidth={maxWidth} onChange={change} />}
            onUpdate={(patch) => onUpdateGroup(openFolder.id, patch)}
            onDelete={() => requestDelete(openFolder)}
            onDone={() => setOpenFolderId(null)}
          />
        ) : (
        <>
        <p className="field-label zone-tool-hint">{t("lines.idleHint")}</p>
        <ul className="zone-region-list">
          {ownGroups.map((group, i) => {
            const items = linesOf(group.id);
            return (
              <FolderRow
                key={group.id}
                folder={group}
                count={items.length}
                noun="line"
                isTarget={group.id === activeGroupId}
                isOpen={group.id === openFolderId && selectedIds.length === 0}
                isExpanded={expanded.has(group.id)}
                canMoveUp={i > 0}
                canMoveDown={i < ownGroups.length - 1}
                onToggleExpand={() => toggle(group.id)}
                onOpen={() => openGroup(group)}
                onUpdate={(patch) => onUpdateGroup(group.id, patch)}
                onMove={(dir) => swapOrder(ownGroups, group, dir).forEach(([id, sortOrder]) => onUpdateGroup(id, { sortOrder }))}
                onDelete={() => requestDelete(group)}
                dropProps={drag.folderProps(group.id, !group.locked)}
                dropPlace={drag.placeOf(group.id)}
              >
                {items.length === 0 && <li className="field-label zone-empty-hint">{t("lines.emptyFolder")}</li>}
                {items.map((line, idx) => lineRow(line, lineLabel(line, idx), group.locked))}
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
                data-tooltip={t("lines.ungroupedHint")}
              >
                {t("panel.ungrouped")} <span className="field-label">({ungrouped.length})</span>
              </button>
            </div>
            {expanded.has(UNGROUPED) && (
              <ul className="zone-list">
                {ungrouped.length === 0 && <li className="field-label zone-empty-hint">{t("lines.ungroupedEmpty")}</li>}
                {ungrouped.map((line, i) => lineRow(line, lineLabel(line, i), false))}
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
              {expanded.has(SHARED) && (
                <ul className="zone-list">{shared.map((line, i) => lineRow(line, `${lineLabel(line, i)} · ${layerNameOf(line.layerId)}`, Boolean(groupOf(line)?.locked)))}</ul>
              )}
            </li>
          )}
        </ul>

        {creating ? (
          <div className="zone-new-region">
            <NameInput
              value=""
              placeholder={t("lines.folderPlaceholder")}
              label={t("panel.newFolderName")}
              onSave={(name) => {
                setCreating(false);
                if (name) onCreateGroup(name);
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
      </div>

      <DeleteFolderDialog
        target={deleting}
        noun="line"
        canKeep
        onConfirm={(cascade) => {
          if (deleting) {
            onDeleteGroup(deleting.folder.id, cascade);
            if (openFolderId === deleting.folder.id) setOpenFolderId(null);
          }
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
