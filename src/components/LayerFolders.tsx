"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Eye, EyeOff, Folder, Lock, LockOpen, Trash2, type LucideIcon } from "lucide-react";
import { dropMoves, type DropPlace } from "./multi-select";
import ConfirmDialog from "./ConfirmDialog";
import LayerChecklist from "./LayerChecklist";
import type { AlwaysDrawFlag, MapLayerData } from "./layer-images";
import ToolSection from "./ToolSection";
import { useT } from "@/i18n/useT";
import { formatInteger } from "@/server/settings/number-format";

/**
 * Folders of map items (zone regions, line and text groups): the tree rows
 * the tool panels list them with, and the folder settings shown in the
 * panel's right column when a folder is clicked.
 */

export interface MapFolderData {
  id: string;
  mapId: string;
  layerId: string | null;
  name: string;
  visible: boolean;
  locked: boolean;
  sortOrder: number;
  /** Other layers everything in the folder is also shown (and editable) on. */
  extraLayerIds: string[];
  /** The style new items drawn into the folder start with, or null (the tool's own). */
  defaultStyle: Record<string, unknown> | null;
}

/** What a folder holds; picks the item words in the user's language. */
export type FolderNoun = "zone" | "line" | "text" | "route";

/** The item word for `noun`, singular and plural, plus "3 zones" for a count. */
export function useNoun(noun: FolderNoun) {
  const t = useT("maps");
  const word = (count: number) => t(`noun.${noun}`, { count });
  return { t, one: word(1), many: word(2), items: (count: number) => t("countNoun", { n: formatInteger(count), noun: word(count) }) };
}

export type FolderPatch = Partial<Pick<MapFolderData, "name" | "visible" | "locked" | "sortOrder" | "extraLayerIds" | "defaultStyle">>;

const MAX_NAME = 120;

type DragProps = Pick<React.HTMLAttributes<HTMLElement>, "onDragStart" | "onDragEnd" | "onDragOver" | "onDragLeave" | "onDrop"> & { draggable?: boolean };

const dropClass = (place: DropPlace | null | undefined) => (place === "before" ? "drop-before" : place === "after" ? "drop-after" : place === "into" ? "drop-into" : undefined);

/** Folder ids first by their order, for moving one up or down among its siblings. */
export function swapOrder(folders: readonly MapFolderData[], folder: MapFolderData, dir: "up" | "down"): [string, number][] {
  const idx = folders.findIndex((f) => f.id === folder.id);
  const other = folders[dir === "up" ? idx - 1 : idx + 1];
  return other ? [[folder.id, other.sortOrder], [other.id, folder.sortOrder]] : [];
}

/** An inline name editor: Enter or leaving saves, Esc cancels. */
export function NameInput({ value, placeholder, label, onSave, onCancel }: { value: string; placeholder?: string; label: string; onSave: (name: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      type="text"
      className="zone-region-name-input"
      value={draft}
      placeholder={placeholder}
      maxLength={MAX_NAME}
      autoFocus
      aria-label={label}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onSave(draft.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    />
  );
}

/** One folder's row: expand arrow, name (click opens it, double-click renames), count and actions. */
export function FolderRow({
  folder,
  count,
  isTarget,
  isOpen,
  isExpanded,
  sharedFrom,
  noun,
  canMoveUp,
  canMoveDown,
  onToggleExpand,
  onOpen,
  onUpdate,
  onMove,
  onDelete,
  dropProps,
  dropPlace,
  children,
}: {
  folder: MapFolderData;
  count: number;
  /** New items go into it. */
  isTarget: boolean;
  /** Its settings are open. */
  isOpen: boolean;
  isExpanded: boolean;
  /** Set when it lives on another layer and only some of its items show here (read-only row). */
  sharedFrom?: string;
  noun: FolderNoun;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleExpand: () => void;
  onOpen: () => void;
  onUpdate: (patch: FolderPatch) => void;
  onMove: (dir: "up" | "down") => void;
  onDelete: () => void;
  /** Drop target: dragged items go into the folder. */
  dropProps?: DragProps;
  dropPlace?: DropPlace | null;
  children: React.ReactNode;
}) {
  const { t, many } = useNoun(noun);
  const [renaming, setRenaming] = useState(false);
  const rowClass = ["zone-region-row", isTarget && "active", isOpen && "folder-open", dropClass(dropPlace)].filter(Boolean).join(" ");
  return (
    <li className="zone-region">
      <div className={rowClass} {...dropProps}>
        <button className="zone-tree-toggle" onClick={onToggleExpand} aria-label={isExpanded ? t("layerFolders.collapse") : t("layerFolders.expand")}>
          {isExpanded ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
        </button>
        {renaming ? (
          <NameInput
            value={folder.name}
            label={t("folderName")}
            onSave={(name) => {
              setRenaming(false);
              if (name && name !== folder.name) onUpdate({ name });
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <button
            className="zone-region-name"
            onClick={sharedFrom ? onToggleExpand : onOpen}
            onDoubleClick={sharedFrom ? undefined : () => setRenaming(true)}
            data-tooltip={sharedFrom ? undefined : t("layerFolders.openHint", { nouns: many })}
          >
            {folder.name} <span className="field-label">({count})</span>
            {sharedFrom && <span className="field-label zone-region-shared">{t("layerFolders.from", { layer: sharedFrom })}</span>}
            {!sharedFrom && folder.extraLayerIds.length > 0 && <span className="field-label zone-region-shared">{t("layerFolders.extraLayers", { count: folder.extraLayerIds.length, n: formatInteger(folder.extraLayerIds.length) })}</span>}
          </button>
        )}
        {!sharedFrom && (
          <div className="zone-row-actions">
            <button className="btn btn-ghost btn-icon-xs" onClick={() => onMove("up")} disabled={!canMoveUp} aria-label={t("layerFolders.moveUp")} data-tooltip={t("layerFolders.moveUpHint")}>
              <ArrowUp size={12} strokeWidth={2.25} />
            </button>
            <button className="btn btn-ghost btn-icon-xs" onClick={() => onMove("down")} disabled={!canMoveDown} aria-label={t("layerFolders.moveDown")} data-tooltip={t("layerFolders.moveDownHint")}>
              <ArrowDown size={12} strokeWidth={2.25} />
            </button>
            <button className="btn btn-ghost btn-icon-xs" onClick={() => onUpdate({ visible: !folder.visible })} aria-label={folder.visible ? t("layerFolders.hideFolder") : t("layerFolders.showFolder")} data-tooltip={folder.visible ? t("layerFolders.hideFolder") : t("layerFolders.showFolder")}>
              {folder.visible ? <Eye size={12} strokeWidth={2.25} /> : <EyeOff size={12} strokeWidth={2.25} />}
            </button>
            <button className="btn btn-ghost btn-icon-xs" onClick={() => onUpdate({ locked: !folder.locked })} aria-label={folder.locked ? t("layerFolders.unlockFolder") : t("layerFolders.lockFolder")} data-tooltip={folder.locked ? t("layerFolders.unlockFolder") : t("layerFolders.lockFolder")}>
              {folder.locked ? <Lock size={12} strokeWidth={2.25} /> : <LockOpen size={12} strokeWidth={2.25} />}
            </button>
            <button className="btn btn-ghost btn-icon-xs" onClick={onDelete} aria-label={t("deleteFolder")} data-tooltip={t("deleteFolder")}>
              <Trash2 size={12} strokeWidth={2.25} />
            </button>
          </div>
        )}
      </div>
      {isExpanded && <ul className="zone-list">{children}</ul>}
    </li>
  );
}

/**
 * One item in a folder: icon, color, label, show/hide, lock, delete. The
 * click gets its event (Ctrl/Shift pick several); the row can be dragged.
 */
export function ItemRow({
  Icon,
  color,
  label,
  muted = false,
  active,
  visible,
  locked,
  lockedByFolder,
  noun,
  onSelect,
  onToggleVisible,
  onToggleLocked,
  onDelete,
  dragProps,
  dropPlace,
  dragged = false,
}: {
  Icon: LucideIcon;
  color: string;
  label: string;
  /** The label is a placeholder ("Line 3"), not a name. */
  muted?: boolean;
  active: boolean;
  visible: boolean;
  locked: boolean;
  lockedByFolder: boolean;
  noun: FolderNoun;
  onSelect: (e: React.MouseEvent) => void;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onDelete: () => void;
  dragProps?: DragProps;
  /** Where a drop on this row would land. */
  dropPlace?: DropPlace | null;
  /** Part of the drag in progress. */
  dragged?: boolean;
}) {
  const { t, one } = useNoun(noun);
  const isLocked = locked || lockedByFolder;
  const rowClass = ["zone-row", active && "active", dragged && "dragging", dropClass(dropPlace), dragProps?.draggable && "draggable"].filter(Boolean).join(" ");
  return (
    <li className={rowClass} {...dragProps}>
      <button
        className="zone-row-name"
        onClick={onSelect}
        data-tooltip={isLocked ? t("layerFolders.itemLockedHint") : t("layerFolders.itemHint")}
      >
        <Icon size={13} strokeWidth={2.25} />
        <span className="zone-color-dot" style={{ background: color }} />
        <span className={muted ? "field-label folder-item-label" : "folder-item-label"}>{label}</span>
      </button>
      <div className="zone-row-actions">
        <button className="btn btn-ghost btn-icon-xs" onClick={onToggleVisible} aria-label={visible ? t("layerFolders.hideItem", { noun: one }) : t("layerFolders.showItem", { noun: one })} data-tooltip={visible ? t("layerFolders.hideItem", { noun: one }) : t("layerFolders.showItem", { noun: one })}>
          {visible ? <Eye size={12} strokeWidth={2.25} /> : <EyeOff size={12} strokeWidth={2.25} />}
        </button>
        <button
          className="btn btn-ghost btn-icon-xs"
          onClick={onToggleLocked}
          disabled={lockedByFolder}
          aria-label={locked ? t("layerFolders.unlockItem", { noun: one }) : t("layerFolders.lockItem", { noun: one })}
          data-tooltip={lockedByFolder ? t("layerFolders.folderLocked") : locked ? t("layerFolders.unlockItem", { noun: one }) : t("layerFolders.lockItem", { noun: one })}
        >
          {isLocked ? <Lock size={12} strokeWidth={2.25} /> : <LockOpen size={12} strokeWidth={2.25} />}
        </button>
        <button className="btn btn-ghost btn-icon-xs" onClick={onDelete} disabled={isLocked} aria-label={t("layerFolders.deleteItem", { noun: one })} data-tooltip={t("layerFolders.deleteItem", { noun: one })}>
          <Trash2 size={12} strokeWidth={2.25} />
        </button>
      </div>
    </li>
  );
}

/**
 * A folder's settings (the tool panel's right column): name, show/lock,
 * "Also show on" for everything in it, and a default style for new items.
 * `renderStyle` draws the tool's own style controls for that default.
 */
export function FolderSettings({
  folder,
  count,
  noun,
  layers,
  alwaysDrawFlag,
  captureStyle,
  renderStyle,
  onUpdate,
  onDelete,
  onDone,
}: {
  folder: MapFolderData;
  count: number;
  noun: FolderNoun;
  layers: MapLayerData[];
  alwaysDrawFlag?: AlwaysDrawFlag;
  /** The style a newly turned-on default starts from (the tool's current one). */
  captureStyle: () => Record<string, unknown>;
  renderStyle: (style: Record<string, unknown>, onChange: (patch: Record<string, unknown>) => void) => React.ReactNode;
  onUpdate: (patch: FolderPatch) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const { t, one, many, items } = useNoun(noun);
  const tc = useT("common");
  const [renaming, setRenaming] = useState(false);
  const layerName = layers.find((l) => l.id === folder.layerId)?.name ?? t("layerFolders.itsLayer");
  const style = folder.defaultStyle;
  return (
    <div className="folder-settings">
      <div className="zone-editor-header">
        <Folder size={14} strokeWidth={2.25} />
        {renaming ? (
          <NameInput
            value={folder.name}
            label={t("folderName")}
            onSave={(name) => {
              setRenaming(false);
              if (name && name !== folder.name) onUpdate({ name });
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <button type="button" className="zone-region-name folder-settings-name" onClick={() => setRenaming(true)} data-tooltip={t("layerFolders.rename")}>
            {folder.name}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-primary zone-editor-done" onClick={onDone}>
          <Check size={13} strokeWidth={2.25} />
          {tc("done")}
        </button>
      </div>
      <p className="field-label">{t("layerFolders.summary", { layer: layerName, items: items(count), nouns: many })}</p>

      <ToolSection id="folder-visibility" title={t("layerFolders.visibility")}>
        <label className="layer-checkbox">
          <input type="checkbox" checked={folder.visible} onChange={(e) => onUpdate({ visible: e.target.checked })} />
          <span>{t("layerFolders.showIts", { nouns: many })}</span>
        </label>
        <label className="layer-checkbox">
          <input type="checkbox" checked={folder.locked} onChange={(e) => onUpdate({ locked: e.target.checked })} />
          <span>{t("layerFolders.lockIts", { nouns: many })}</span>
        </label>
      </ToolSection>

      <ToolSection id="folder-layers" title={t("layerFolders.layers")}>
        <LayerChecklist layers={layers} homeLayerId={folder.layerId} value={folder.extraLayerIds} alwaysDrawFlag={alwaysDrawFlag} onChange={(extraLayerIds) => onUpdate({ extraLayerIds })} />
        <p className="field-label zone-tool-hint">{t("layerFolders.layersHint", { noun: one })}</p>
      </ToolSection>

      <ToolSection id="folder-style" title={t("layerFolders.defaultStyle")}>
        <label className="layer-checkbox">
          <input type="checkbox" checked={style !== null} onChange={(e) => onUpdate({ defaultStyle: e.target.checked ? captureStyle() : null })} />
          <span>{t("layerFolders.useStyle", { nouns: many })}</span>
        </label>
        {style ? (
          <div className="folder-style-fields">{renderStyle(style, (patch) => onUpdate({ defaultStyle: { ...style, ...patch } }))}</div>
        ) : (
          <p className="field-label zone-tool-hint">{t("layerFolders.styleOff", { nouns: many })}</p>
        )}
      </ToolSection>

      <button type="button" className="btn btn-danger" onClick={onDelete}>
        <Trash2 size={14} strokeWidth={2.25} />
        {t("deleteFolder")}
      </button>
    </div>
  );
}

/**
 * Confirms deleting a folder that still holds items. With `canKeep` its items
 * can move to Ungrouped instead of being deleted (lines, texts; zones always
 * need a region, so theirs go with it).
 */
export function DeleteFolderDialog({
  target,
  noun,
  canKeep,
  onConfirm,
  onCancel,
}: {
  target: { folder: MapFolderData; count: number } | null;
  noun: FolderNoun;
  canKeep: boolean;
  onConfirm: (cascade: boolean) => void;
  onCancel: () => void;
}) {
  const { t, many, items: itemsOf } = useNoun(noun);
  const [alsoItems, setAlsoItems] = useState(!canKeep);
  const [lastTarget, setLastTarget] = useState(target);
  if (target !== lastTarget) {
    setLastTarget(target);
    setAlsoItems(!canKeep);
  }
  const count = target?.count ?? 0;
  const items = itemsOf(count);
  return (
    <ConfirmDialog
      open={target !== null}
      title={t("deleteFolder.title", { name: target?.folder.name ?? "" })}
      confirmLabel={alsoItems ? t("layerFolders.deleteWith", { items }) : t("deleteFolder")}
      onConfirm={() => onConfirm(alsoItems)}
      onCancel={onCancel}
    >
      <p>{t(alsoItems ? "layerFolders.holdsDelete" : "layerFolders.holdsMove", { items })}</p>
      {canKeep && (
        <label className="layer-checkbox">
          <input type="checkbox" checked={alsoItems} onChange={(e) => setAlsoItems(e.target.checked)} />
          <span>{t("layerFolders.alsoDelete", { nouns: many })}</span>
        </label>
      )}
    </ConfirmDialog>
  );
}

/**
 * The right column's header while several items are selected: how many,
 * show/hide and lock them all, delete them, and Done (clears the selection).
 */
export function MultiHeader({
  Icon,
  count,
  noun,
  lockedCount,
  allVisible,
  allLocked,
  onToggleVisible,
  onToggleLocked,
  onDelete,
  onDone,
}: {
  Icon: LucideIcon;
  count: number;
  noun: FolderNoun;
  /** Selected items that are locked (their own lock or their folder's): edits skip them. */
  lockedCount: number;
  allVisible: boolean;
  allLocked: boolean;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const { t, one, many, items } = useNoun(noun);
  const tc = useT("common");
  const editable = count - lockedCount;
  const [hintBefore, hintAfter] = t("layerFolders.multiHint", { noun: one }).split("{mixed}");
  return (
    <>
      <div className="zone-editor-header">
        <Icon size={14} strokeWidth={2.25} />
        <span className="line-panel-name">{t("layerFolders.selected", { items: items(count) })}</span>
        <div className="zone-row-actions">
          <button type="button" className="btn btn-ghost btn-icon-xs" onClick={onToggleVisible} aria-label={allVisible ? t("layerFolders.hideSelected", { nouns: many }) : t("layerFolders.showSelected", { nouns: many })} data-tooltip={allVisible ? t("layerFolders.hideAll") : t("layerFolders.showAll")}>
            {allVisible ? <Eye size={12} strokeWidth={2.25} /> : <EyeOff size={12} strokeWidth={2.25} />}
          </button>
          <button type="button" className="btn btn-ghost btn-icon-xs" onClick={onToggleLocked} aria-label={allLocked ? t("layerFolders.unlockSelected", { nouns: many }) : t("layerFolders.lockSelected", { nouns: many })} data-tooltip={allLocked ? t("layerFolders.unlockAll") : t("layerFolders.lockAll")}>
            {allLocked ? <Lock size={12} strokeWidth={2.25} /> : <LockOpen size={12} strokeWidth={2.25} />}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon-xs"
            onClick={onDelete}
            disabled={editable === 0}
            aria-label={t("layerFolders.deleteSelected", { nouns: many })}
            data-tooltip={lockedCount ? t("layerFolders.deleteUnlocked", { n: formatInteger(editable), nouns: many }) : t("layerFolders.deleteAll")}
          >
            <Trash2 size={12} strokeWidth={2.25} />
          </button>
        </div>
        <button type="button" className="btn btn-sm btn-primary zone-editor-done" onClick={onDone}>
          <Check size={13} strokeWidth={2.25} />
          {tc("done")}
        </button>
      </div>
      <p className="field-label zone-tool-hint">
        {hintBefore}
        <span className="mixed-tag">{t("layerFolders.mixed")}</span>
        {hintAfter}
      </p>
      {lockedCount > 0 && (
        <p className="field-label line-panel-locked">
          <Lock size={12} strokeWidth={2.25} aria-hidden /> {t("layerFolders.lockedWontChange", { count: lockedCount, n: formatInteger(lockedCount), noun: one, nouns: many })}
        </p>
      )}
    </>
  );
}

/** A checkbox that can show "some are on, some off" (the edited items differ). */
export function MixedCheckbox({ checked, mixed = false, onChange, children }: { checked: boolean; mixed?: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }) {
  const t = useT("maps");
  return (
    <label className="layer-checkbox">
      <input
        type="checkbox"
        checked={!mixed && checked}
        ref={(el) => {
          if (el) el.indeterminate = mixed;
        }}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
      {mixed && <span className="mixed-tag">{t("layerFolders.mixed")}</span>}
    </label>
  );
}

/** Marks a field whose value differs between the edited items. */
export function MixedTag({ show }: { show: boolean }) {
  const t = useT("maps");
  return show ? <span className="mixed-tag">{t("layerFolders.mixed")}</span> : null;
}

const MIXED_OPTION = "__mixed__";

/**
 * Which folder an item (or several) is in. `mixed`: they're in different
 * ones. Locked folders can't be picked; `noneLabel` adds an "outside any
 * folder" choice (lines, texts; zones always need a region).
 */
export function FolderSelect({
  value,
  mixed = false,
  folders,
  noneLabel,
  disabled = false,
  hint,
  onChange,
}: {
  value: string | null;
  mixed?: boolean;
  folders: readonly MapFolderData[];
  noneLabel?: string;
  disabled?: boolean;
  hint?: string;
  onChange: (folderId: string | null) => void;
}) {
  const t = useT("maps");
  const known = value !== null && folders.some((f) => f.id === value);
  return (
    <label className="grid-field">
      <span className="field-label">{t("field.folder")}</span>
      <select value={mixed ? MIXED_OPTION : known ? (value ?? "") : ""} disabled={disabled} onChange={(e) => e.target.value !== MIXED_OPTION && onChange(e.target.value || null)} aria-label={t("field.folder")}>
        {mixed && (
          <option value={MIXED_OPTION} disabled>
            {t("layerFolders.mixedOption")}
          </option>
        )}
        {noneLabel !== undefined && <option value="">{noneLabel}</option>}
        {noneLabel === undefined && !known && !mixed && <option value="">—</option>}
        {folders.map((f) => (
          <option key={f.id} value={f.id} disabled={f.locked}>
            {f.locked ? t("layerFolders.lockedOption", { name: f.name }) : f.name}
          </option>
        ))}
      </select>
      {hint && <span className="field-label zone-tool-hint">{hint}</span>}
    </label>
  );
}

/** Which layer items live on; `mixed`: different ones. */
export function LayerSelect({ value, mixed = false, layers, onChange }: { value: string | null; mixed?: boolean; layers: readonly MapLayerData[]; onChange: (layerId: string) => void }) {
  const t = useT("maps");
  return (
    <label className="grid-field">
      <span className="field-label">{t("field.layer")}</span>
      <select value={mixed ? MIXED_OPTION : (value ?? "")} onChange={(e) => e.target.value && e.target.value !== MIXED_OPTION && onChange(e.target.value)} aria-label={t("field.layer")}>
        {mixed && (
          <option value={MIXED_OPTION} disabled>
            {t("layerFolders.mixedOption")}
          </option>
        )}
        {layers.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** An item listed in a folder tree (lines, texts). */
export interface FolderItem {
  id: string;
  layerId: string | null;
  groupId: string | null;
  sortOrder: number;
}

/** The Ungrouped pseudo-folder's and the shared list's keys (expanded set, drops). */
export const UNGROUPED = "__ungrouped__";
export const SHARED = "__shared__";

const bySortOrder = (a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder;

/**
 * The active layer's folders of items as the Lines and Text panels list
 * them: its folders in order, Ungrouped (items whose folder is gone count as
 * Ungrouped), and items shared from other layers; plus the flat order Shift
 * ranges follow.
 */
export function folderTree<T extends FolderItem>(items: readonly T[], groups: readonly MapFolderData[], activeLayerId: string) {
  const ownGroups = groups.filter((g) => g.layerId === activeLayerId).sort(bySortOrder);
  const ownIds = new Set(ownGroups.map((g) => g.id));
  const home = items.filter((item) => item.layerId === activeLayerId);
  const folderOf = (item: T): string | null => (item.groupId && ownIds.has(item.groupId) ? item.groupId : null);
  const itemsOf = (groupId: string | null) => home.filter((item) => folderOf(item) === groupId).sort(bySortOrder);
  const shared = items.filter((item) => item.layerId !== activeLayerId);
  const order = [...ownGroups.flatMap((g) => itemsOf(g.id)), ...itemsOf(null), ...shared].map((item) => item.id);
  const byId = new Map(items.map((item) => [item.id, item]));
  return { ownGroups, ownIds, itemsOf, ungrouped: itemsOf(null), shared, order, folderOf, byId };
}

/** What dropping `ids` on `spot` changes: each item's folder (groupId) and place (sortOrder). */
export function folderDropPatches<T extends FolderItem>(tree: ReturnType<typeof folderTree<T>>, ids: readonly string[], spot: { key: string; place: DropPlace }) {
  const anchor = spot.place === "into" ? undefined : tree.byId.get(spot.key);
  const target = spot.place === "into" ? (spot.key === UNGROUPED ? null : spot.key) : anchor ? tree.folderOf(anchor) : null;
  const moving = tree.order.filter((id) => ids.includes(id));
  const moves = dropMoves(tree.itemsOf(target), moving, anchor?.id ?? null, spot.place, (id) => {
    const item = tree.byId.get(id);
    return item ? tree.folderOf(item) : null;
  }, target);
  return new Map([...moves].map(([id, m]) => [id, "folder" in m ? { groupId: m.folder ?? null, sortOrder: m.sortOrder } : { sortOrder: m.sortOrder }]));
}
