"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Eye, EyeOff, Folder, Lock, LockOpen, Trash2, type LucideIcon } from "lucide-react";
import { dropMoves, type DropPlace } from "./multi-select";
import ConfirmDialog from "./ConfirmDialog";
import LayerChecklist from "./LayerChecklist";
import type { AlwaysDrawFlag, MapLayerData } from "./layer-images";
import ToolSection from "./ToolSection";

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
  noun: string;
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
  const [renaming, setRenaming] = useState(false);
  const rowClass = ["zone-region-row", isTarget && "active", isOpen && "folder-open", dropClass(dropPlace)].filter(Boolean).join(" ");
  return (
    <li className="zone-region">
      <div className={rowClass} {...dropProps}>
        <button className="zone-tree-toggle" onClick={onToggleExpand} aria-label={isExpanded ? "Collapse" : "Expand"}>
          {isExpanded ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
        </button>
        {renaming ? (
          <NameInput
            value={folder.name}
            label="Folder name"
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
            data-tooltip={sharedFrom ? undefined : `Click: open its settings, new ${noun}s go here. Double-click to rename.`}
          >
            {folder.name} <span className="field-label">({count})</span>
            {sharedFrom && <span className="field-label zone-region-shared"> · from {sharedFrom}</span>}
            {!sharedFrom && folder.extraLayerIds.length > 0 && <span className="field-label zone-region-shared"> · +{folder.extraLayerIds.length} {folder.extraLayerIds.length === 1 ? "layer" : "layers"}</span>}
          </button>
        )}
        {!sharedFrom && (
          <div className="zone-row-actions">
            <button className="btn btn-ghost btn-icon-xs" onClick={() => onMove("up")} disabled={!canMoveUp} aria-label="Move folder up" data-tooltip="Move up">
              <ArrowUp size={12} strokeWidth={2.25} />
            </button>
            <button className="btn btn-ghost btn-icon-xs" onClick={() => onMove("down")} disabled={!canMoveDown} aria-label="Move folder down" data-tooltip="Move down">
              <ArrowDown size={12} strokeWidth={2.25} />
            </button>
            <button className="btn btn-ghost btn-icon-xs" onClick={() => onUpdate({ visible: !folder.visible })} aria-label={folder.visible ? "Hide folder" : "Show folder"} data-tooltip={folder.visible ? "Hide folder" : "Show folder"}>
              {folder.visible ? <Eye size={12} strokeWidth={2.25} /> : <EyeOff size={12} strokeWidth={2.25} />}
            </button>
            <button className="btn btn-ghost btn-icon-xs" onClick={() => onUpdate({ locked: !folder.locked })} aria-label={folder.locked ? "Unlock folder" : "Lock folder"} data-tooltip={folder.locked ? "Unlock folder" : "Lock folder"}>
              {folder.locked ? <Lock size={12} strokeWidth={2.25} /> : <LockOpen size={12} strokeWidth={2.25} />}
            </button>
            <button className="btn btn-ghost btn-icon-xs" onClick={onDelete} aria-label="Delete folder" data-tooltip="Delete folder">
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
  noun: string;
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
  const isLocked = locked || lockedByFolder;
  const rowClass = ["zone-row", active && "active", dragged && "dragging", dropClass(dropPlace), dragProps?.draggable && "draggable"].filter(Boolean).join(" ");
  return (
    <li className={rowClass} {...dragProps}>
      <button
        className="zone-row-name"
        onClick={onSelect}
        data-tooltip={isLocked ? "Locked: unlock to move or edit it" : "Ctrl+click: pick several. Shift+click: pick a range. Drag to move or reorder."}
      >
        <Icon size={13} strokeWidth={2.25} />
        <span className="zone-color-dot" style={{ background: color }} />
        <span className={muted ? "field-label folder-item-label" : "folder-item-label"}>{label}</span>
      </button>
      <div className="zone-row-actions">
        <button className="btn btn-ghost btn-icon-xs" onClick={onToggleVisible} aria-label={visible ? `Hide ${noun}` : `Show ${noun}`} data-tooltip={visible ? `Hide ${noun}` : `Show ${noun}`}>
          {visible ? <Eye size={12} strokeWidth={2.25} /> : <EyeOff size={12} strokeWidth={2.25} />}
        </button>
        <button
          className="btn btn-ghost btn-icon-xs"
          onClick={onToggleLocked}
          disabled={lockedByFolder}
          aria-label={locked ? `Unlock ${noun}` : `Lock ${noun}`}
          data-tooltip={lockedByFolder ? "The folder is locked" : locked ? `Unlock ${noun}` : `Lock ${noun}`}
        >
          {isLocked ? <Lock size={12} strokeWidth={2.25} /> : <LockOpen size={12} strokeWidth={2.25} />}
        </button>
        <button className="btn btn-ghost btn-icon-xs" onClick={onDelete} disabled={isLocked} aria-label={`Delete ${noun}`} data-tooltip={`Delete ${noun}`}>
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
  /** "zone", "line", "text". */
  noun: string;
  layers: MapLayerData[];
  alwaysDrawFlag?: AlwaysDrawFlag;
  /** The style a newly turned-on default starts from (the tool's current one). */
  captureStyle: () => Record<string, unknown>;
  renderStyle: (style: Record<string, unknown>, onChange: (patch: Record<string, unknown>) => void) => React.ReactNode;
  onUpdate: (patch: FolderPatch) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const layerName = layers.find((l) => l.id === folder.layerId)?.name ?? "its layer";
  const style = folder.defaultStyle;
  return (
    <div className="folder-settings">
      <div className="zone-editor-header">
        <Folder size={14} strokeWidth={2.25} />
        {renaming ? (
          <NameInput
            value={folder.name}
            label="Folder name"
            onSave={(name) => {
              setRenaming(false);
              if (name && name !== folder.name) onUpdate({ name });
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <button type="button" className="zone-region-name folder-settings-name" onClick={() => setRenaming(true)} data-tooltip="Rename">
            {folder.name}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-primary zone-editor-done" onClick={onDone}>
          <Check size={13} strokeWidth={2.25} />
          Done
        </button>
      </div>
      <p className="field-label">
        Folder on {layerName} · {count} {count === 1 ? noun : `${noun}s`}. New {noun}s go here while it&apos;s selected.
      </p>

      <ToolSection id="folder-visibility" title="Visibility">
        <label className="layer-checkbox">
          <input type="checkbox" checked={folder.visible} onChange={(e) => onUpdate({ visible: e.target.checked })} />
          <span>Show its {noun}s</span>
        </label>
        <label className="layer-checkbox">
          <input type="checkbox" checked={folder.locked} onChange={(e) => onUpdate({ locked: e.target.checked })} />
          <span>Lock its {noun}s (no moving or editing)</span>
        </label>
      </ToolSection>

      <ToolSection id="folder-layers" title="Layers">
        <LayerChecklist layers={layers} homeLayerId={folder.layerId} value={folder.extraLayerIds} alwaysDrawFlag={alwaysDrawFlag} onChange={(extraLayerIds) => onUpdate({ extraLayerIds })} />
        <p className="field-label zone-tool-hint">Everything in the folder also shows (and can be edited) on these layers, on top of each {noun}&apos;s own choice.</p>
      </ToolSection>

      <ToolSection id="folder-style" title="Default style">
        <label className="layer-checkbox">
          <input type="checkbox" checked={style !== null} onChange={(e) => onUpdate({ defaultStyle: e.target.checked ? captureStyle() : null })} />
          <span>New {noun}s in this folder use this style</span>
        </label>
        {style ? (
          <div className="folder-style-fields">{renderStyle(style, (patch) => onUpdate({ defaultStyle: { ...style, ...patch } }))}</div>
        ) : (
          <p className="field-label zone-tool-hint">Off: new {noun}s get the tool&apos;s current style. Turning it on starts from that style.</p>
        )}
      </ToolSection>

      <button type="button" className="btn btn-danger" onClick={onDelete}>
        <Trash2 size={14} strokeWidth={2.25} />
        Delete folder
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
  noun: string;
  canKeep: boolean;
  onConfirm: (cascade: boolean) => void;
  onCancel: () => void;
}) {
  const [alsoItems, setAlsoItems] = useState(!canKeep);
  const [lastTarget, setLastTarget] = useState(target);
  if (target !== lastTarget) {
    setLastTarget(target);
    setAlsoItems(!canKeep);
  }
  const count = target?.count ?? 0;
  const items = `${count} ${count === 1 ? noun : `${noun}s`}`;
  return (
    <ConfirmDialog
      open={target !== null}
      title={`Delete the folder “${target?.folder.name}”?`}
      confirmLabel={alsoItems ? `Delete folder and ${items}` : "Delete folder"}
      onConfirm={() => onConfirm(alsoItems)}
      onCancel={onCancel}
    >
      <p>
        It holds {items}. {alsoItems ? "They will be deleted with it." : "They move to Ungrouped."}
      </p>
      {canKeep && (
        <label className="layer-checkbox">
          <input type="checkbox" checked={alsoItems} onChange={(e) => setAlsoItems(e.target.checked)} />
          <span>Also delete its {noun}s</span>
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
  noun: string;
  /** Selected items that are locked (their own lock or their folder's): edits skip them. */
  lockedCount: number;
  allVisible: boolean;
  allLocked: boolean;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const editable = count - lockedCount;
  return (
    <>
      <div className="zone-editor-header">
        <Icon size={14} strokeWidth={2.25} />
        <span className="line-panel-name">
          {count} {noun}s selected
        </span>
        <div className="zone-row-actions">
          <button type="button" className="btn btn-ghost btn-icon-xs" onClick={onToggleVisible} aria-label={allVisible ? `Hide the ${noun}s` : `Show the ${noun}s`} data-tooltip={allVisible ? "Hide them all" : "Show them all"}>
            {allVisible ? <Eye size={12} strokeWidth={2.25} /> : <EyeOff size={12} strokeWidth={2.25} />}
          </button>
          <button type="button" className="btn btn-ghost btn-icon-xs" onClick={onToggleLocked} aria-label={allLocked ? `Unlock the ${noun}s` : `Lock the ${noun}s`} data-tooltip={allLocked ? "Unlock them all" : "Lock them all"}>
            {allLocked ? <Lock size={12} strokeWidth={2.25} /> : <LockOpen size={12} strokeWidth={2.25} />}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon-xs"
            onClick={onDelete}
            disabled={editable === 0}
            aria-label={`Delete the ${noun}s`}
            data-tooltip={lockedCount ? `Delete the ${editable} unlocked ${noun}s (Delete)` : "Delete them all (Delete)"}
          >
            <Trash2 size={12} strokeWidth={2.25} />
          </button>
        </div>
        <button type="button" className="btn btn-sm btn-primary zone-editor-done" onClick={onDone}>
          <Check size={13} strokeWidth={2.25} />
          Done
        </button>
      </div>
      <p className="field-label zone-tool-hint">
        Changes apply to every selected {noun}. Settings marked <span className="mixed-tag">Mixed</span> differ between them.
      </p>
      {lockedCount > 0 && (
        <p className="field-label line-panel-locked">
          <Lock size={12} strokeWidth={2.25} aria-hidden /> {lockedCount} locked {lockedCount === 1 ? noun : `${noun}s`} won&apos;t change.
        </p>
      )}
    </>
  );
}

/** A checkbox that can show "some are on, some off" (the edited items differ). */
export function MixedCheckbox({ checked, mixed = false, onChange, children }: { checked: boolean; mixed?: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }) {
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
      {mixed && <span className="mixed-tag">Mixed</span>}
    </label>
  );
}

/** Marks a field whose value differs between the edited items. */
export function MixedTag({ show }: { show: boolean }) {
  return show ? <span className="mixed-tag">Mixed</span> : null;
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
  const known = value !== null && folders.some((f) => f.id === value);
  return (
    <label className="grid-field">
      <span className="field-label">Folder</span>
      <select value={mixed ? MIXED_OPTION : known ? (value ?? "") : ""} disabled={disabled} onChange={(e) => e.target.value !== MIXED_OPTION && onChange(e.target.value || null)} aria-label="Folder">
        {mixed && (
          <option value={MIXED_OPTION} disabled>
            — Mixed —
          </option>
        )}
        {noneLabel !== undefined && <option value="">{noneLabel}</option>}
        {noneLabel === undefined && !known && !mixed && <option value="">—</option>}
        {folders.map((f) => (
          <option key={f.id} value={f.id} disabled={f.locked}>
            {f.name}
            {f.locked ? " (locked)" : ""}
          </option>
        ))}
      </select>
      {hint && <span className="field-label zone-tool-hint">{hint}</span>}
    </label>
  );
}

/** Which layer items live on; `mixed`: different ones. */
export function LayerSelect({ value, mixed = false, layers, onChange }: { value: string | null; mixed?: boolean; layers: readonly MapLayerData[]; onChange: (layerId: string) => void }) {
  return (
    <label className="grid-field">
      <span className="field-label">Layer</span>
      <select value={mixed ? MIXED_OPTION : (value ?? "")} onChange={(e) => e.target.value && e.target.value !== MIXED_OPTION && onChange(e.target.value)} aria-label="Layer">
        {mixed && (
          <option value={MIXED_OPTION} disabled>
            — Mixed —
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
