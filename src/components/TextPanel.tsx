"use client";

import { useState } from "react";
import { X, Type, Plus, ChevronRight, ChevronDown } from "lucide-react";
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
import { clickMods, type ClickMods } from "./multi-select";
import type { MapTextData } from "./TextLayer";
import { useListDrag } from "./use-list-drag";
import type { TextStyle } from "@/server/texts/text-config";
import { useT } from "@/i18n/useT";
import { TextStyleFields, textLabel, type TextDraft, type TextPatch } from "./text-fields";

export type { TextDraft, TextPatch };

/**
 * The Text tool's list: the active layer's folders of texts (the text bar
 * places and edits them). A clicked folder's settings replace the list.
 */
export default function TextPanel({
  layerName,
  selected,
  draft,
  layers,
  maxFontSize,
  texts,
  groups,
  activeLayerId,
  activeGroupId,
  onClose,
  onSetActiveGroup,
  onSelectText,
  onUpdateText,
  onDeleteText,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  selectedIds,
  onPick,
  onUpdateMany,
}: {
  /** Name of the active layer this tool edits. */
  layerName: string;
  /** The one selected text: its folder opens in the list. */
  selected: MapTextData | null;
  /** The next text's style: where a folder's default style starts. */
  draft: TextDraft;
  layers: MapLayerData[];
  maxFontSize: number;
  /** Texts on the active layer (home or shown here). */
  texts: MapTextData[];
  /** Every text folder of the map. */
  groups: MapFolderData[];
  activeLayerId: string;
  /** Where new texts go; null = Ungrouped. */
  activeGroupId: string | null;
  onClose: () => void;
  onSetActiveGroup: (id: string | null) => void;
  onSelectText: (id: string | null) => void;
  onUpdateText: (id: string, patch: TextPatch) => void;
  onDeleteText: (id: string) => void;
  onCreateGroup: (name: string) => void;
  onUpdateGroup: (id: string, patch: FolderPatch) => void;
  onDeleteGroup: (id: string, cascade: boolean) => void;
  /** Every selected text (the text bar edits them). */
  selectedIds: string[];
  /** A click on a text in the list (Ctrl/Shift pick several); `order` is the list as shown. */
  onPick: (id: string, mods: ClickMods, order: string[]) => void;
  /** One edit of several texts (locked ones are skipped unless `includeLocked`). */
  onUpdateMany: (ids: string[], patchOf: (text: MapTextData) => TextPatch, opts?: { includeLocked?: boolean }) => void;
}) {
  const tm = useT("maps");
  const tc = useT("common");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([UNGROUPED]));
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<{ folder: MapFolderData; count: number } | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);

  const tree = folderTree(texts, groups, activeLayerId);
  const { ownGroups, itemsOf: textsOf, ungrouped, shared, order } = tree;
  const picked = new Set(selectedIds);
  const layerNameOf = (id: string | null) => layers.find((l) => l.id === id)?.name ?? tm("panel.anotherLayer");
  const groupOf = (t: MapTextData) => (t.groupId ? groups.find((g) => g.id === t.groupId) : undefined);
  const openFolder = selectedIds.length === 0 ? (ownGroups.find((g) => g.id === openFolderId) ?? null) : null;

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
    onSelectText(null);
    setExpanded((prev) => new Set(prev).add(group.id));
  };
  const requestDelete = (group: MapFolderData) => {
    const count = textsOf(group.id).length;
    if (count === 0) {
      if (openFolderId === group.id) setOpenFolderId(null);
      return onDeleteGroup(group.id, false);
    }
    setDeleting({ folder: group, count });
  };
  const isLocked = (t: MapTextData) => t.locked || Boolean(groupOf(t)?.locked);

  // Drag and drop: unlocked home texts move into a folder or next to another text.
  const canDrag = (t: MapTextData) => t.layerId === activeLayerId && !isLocked(t);
  const drag = useListDrag((ids, spot) => {
    const patches = folderDropPatches(tree, ids, spot);
    if (patches.size) onUpdateMany([...patches.keys()], (t) => patches.get(t.id) ?? {}, { includeLocked: true });
  });

  const textRow = (t: MapTextData, label: string, lockedByFolder: boolean) => (
    <ItemRow
      key={t.id}
      Icon={Type}
      color={t.color}
      label={label}
      active={picked.has(t.id)}
      visible={t.visible}
      locked={t.locked}
      lockedByFolder={lockedByFolder}
      noun="text"
      onSelect={(e) => onPick(t.id, clickMods(e), order)}
      onToggleVisible={() => onUpdateText(t.id, { visible: !t.visible })}
      onToggleLocked={() => onUpdateText(t.id, { locked: !t.locked })}
      onDelete={() => onDeleteText(t.id)}
      dragProps={drag.itemProps(t.id, {
        canDrag: canDrag(t),
        canDrop: t.layerId === activeLayerId && !lockedByFolder,
        idsOf: () => (picked.has(t.id) ? order.filter((id) => picked.has(id) && texts.some((x) => x.id === id && canDrag(x))) : [t.id]),
      })}
      dropPlace={drag.placeOf(t.id)}
      dragged={drag.isDragged(t.id)}
    />
  );

  return (
    <div className="zones-panel text-panel">
      <div className="zones-panel-main">
        <div className="marker-side-panel-header">
          <h2>
            <Type size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            {tm("panel.text")}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={tc("closePanel", { title: tm("panel.text") })}>
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>
        <p className="panel-layer-label">{tm("panel.layer", { name: layerName })}</p>

        {openFolder ? (
          <FolderSettings
            folder={openFolder}
            count={textsOf(openFolder.id).length}
            noun="text"
            layers={layers}
            alwaysDrawFlag="textsAlwaysVisible"
            captureStyle={() => {
              const { text: _text, ...style } = draft;
              void _text;
              return style;
            }}
            renderStyle={(style, change) => <TextStyleFields v={{ ...draft, ...style } as TextStyle} maxFontSize={maxFontSize} onChange={change} />}
            onUpdate={(patch) => onUpdateGroup(openFolder.id, patch)}
            onDelete={() => requestDelete(openFolder)}
            onDone={() => setOpenFolderId(null)}
          />
        ) : (
        <>
        <p className="field-label zone-tool-hint">{tm("text.idleHint")}</p>
        <ul className="zone-region-list">
          {ownGroups.map((group, i) => {
            const items = textsOf(group.id);
            return (
              <FolderRow
                key={group.id}
                folder={group}
                count={items.length}
                noun="text"
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
                {items.length === 0 && <li className="field-label zone-empty-hint">{tm("text.emptyFolder")}</li>}
                {items.map((t) => textRow(t, textLabel(t), group.locked))}
              </FolderRow>
            );
          })}
          <li className="zone-region">
            <div className={["zone-region-row", activeGroupId === null && "active", drag.placeOf(UNGROUPED) && "drop-into"].filter(Boolean).join(" ")} {...drag.folderProps(UNGROUPED, true)}>
              <button className="zone-tree-toggle" onClick={() => toggle(UNGROUPED)} aria-label={expanded.has(UNGROUPED) ? tm("layerFolders.collapse") : tm("layerFolders.expand")}>
                {expanded.has(UNGROUPED) ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
              </button>
              <button
                className="zone-region-name line-panel-ungrouped"
                onClick={() => {
                  onSetActiveGroup(null);
                  setOpenFolderId(null);
                }}
                data-tooltip={tm("text.ungroupedHint")}
              >
                {tm("panel.ungrouped")} <span className="field-label">({ungrouped.length})</span>
              </button>
            </div>
            {expanded.has(UNGROUPED) && (
              <ul className="zone-list">
                {ungrouped.length === 0 && <li className="field-label zone-empty-hint">{tm("text.ungroupedEmpty")}</li>}
                {ungrouped.map((t) => textRow(t, textLabel(t), false))}
              </ul>
            )}
          </li>
          {shared.length > 0 && (
            <li className="zone-region">
              <div className="zone-region-row">
                <button className="zone-tree-toggle" onClick={() => toggle(SHARED)} aria-label={expanded.has(SHARED) ? tm("layerFolders.collapse") : tm("layerFolders.expand")}>
                  {expanded.has(SHARED) ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
                </button>
                <button className="zone-region-name" onClick={() => toggle(SHARED)}>
                  {tm("panel.fromOtherLayers")} <span className="field-label">({shared.length})</span>
                </button>
              </div>
              {expanded.has(SHARED) && <ul className="zone-list">{shared.map((t) => textRow(t, `${textLabel(t)} · ${layerNameOf(t.layerId)}`, Boolean(groupOf(t)?.locked)))}</ul>}
            </li>
          )}
        </ul>

        {creating ? (
          <div className="zone-new-region">
            <NameInput
              value=""
              placeholder={tm("text.folderPlaceholder")}
              label={tm("panel.newFolderName")}
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
            {tm("panel.newFolder")}
          </button>
        )}
        </>
        )}
      </div>
      <DeleteFolderDialog
        target={deleting}
        noun="text"
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
