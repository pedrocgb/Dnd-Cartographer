"use client";

import { useState } from "react";
import { X, PenTool, Pencil, Spline, Check, Trash2, Plus, ChevronRight, ChevronDown, FolderOpen, Lock } from "lucide-react";
import ColorWheel from "./ColorWheel";
import { SliderField } from "./GridPanel";
import type { MapLayerData } from "./layer-images";
import LayerChecklist from "./LayerChecklist";
import {
  DeleteFolderDialog,
  FolderRow,
  FolderSelect,
  FolderSettings,
  ItemRow,
  LayerSelect,
  MixedCheckbox,
  MixedTag,
  MultiHeader,
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
import { clickMods, editLayers, mixedKeys, sharedLayers, type ClickMods } from "./multi-select";
import ToolSection from "./ToolSection";
import { useListDrag } from "./use-list-drag";
import { LINE_LIMITS, type LineCap, type LineKind, type LineStyle, type LineStyleKind } from "@/server/lines/line-config";
import { COLOR_PRESETS, normalizeColor } from "@/server/markers/icon-registry";

export type LinePatch = Partial<LineStyle & { layerId: string; extraLayerIds: string[]; name: string; visible: boolean; locked: boolean; groupId: string | null; sortOrder: number }>;

const NO_MIXED: ReadonlySet<string> = new Set();

function Segmented<T extends string>({
  label,
  value,
  options,
  mixed = false,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  mixed?: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid-field">
      <span className="field-label">
        {label} <MixedTag show={mixed} />
      </span>
      <div className="line-panel-segmented" role="group" aria-label={label} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((o) => {
          const on = !mixed && value === o.key;
          return (
            <button key={o.key} type="button" className={on ? "btn btn-sm active" : "btn btn-sm"} aria-pressed={on} onClick={() => onChange(o.key)}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const STYLE_OPTIONS: { key: LineStyleKind; label: string }[] = [
  { key: "solid", label: "Solid" },
  { key: "dot", label: "Dot" },
  { key: "dashed", label: "Dashed" },
];
const CAP_OPTIONS: { key: LineCap; label: string }[] = [
  { key: "round", label: "Circle" },
  { key: "square", label: "Square" },
];

/** A line's label in the list: its name, or its place in its folder. */
export const lineLabel = (line: MapLineData, index: number) => line.name || `Line ${index + 1}`;

/** Wraps a group of fields in a collapsible section, or not (inside a folder's default style). */
function Group({ id, title, sectioned, children }: { id: string; title: string; sectioned: boolean; children: React.ReactNode }) {
  return sectioned ? (
    <ToolSection id={id} title={title}>
      {children}
    </ToolSection>
  ) : (
    <>{children}</>
  );
}

/**
 * Color, size, dash, cap and shadow: for the selected line(s), the next one,
 * or a folder's default. `mixed`: fields that differ between several lines.
 */
export function LineStyleFields({
  v,
  maxWidth,
  sectioned = true,
  mixed = NO_MIXED,
  onChange,
}: {
  v: LineStyle;
  maxWidth: number;
  sectioned?: boolean;
  mixed?: ReadonlySet<string>;
  onChange: (patch: LinePatch) => void;
}) {
  const m = (key: keyof LineStyle) => mixed.has(key);
  const shadowOn = v.shadowEnabled || m("shadowEnabled");
  return (
    <>
      <Group id="line-color" title="Color and size" sectioned={sectioned}>
        <span className="field-label">
          Color <MixedTag show={m("color")} />
        </span>
        <ColorWheel value={v.color} mixed={m("color")} onChange={(color) => onChange({ color })} />
        <SliderField label="Size" value={v.width} mixed={m("width")} min={0.5} max={maxWidth} step={0.5} defaultValue={Math.max(1, Math.round(maxWidth / 8))} suffix=" px" onChange={(width) => onChange({ width })} />
        <SliderField label="Opacity" value={Math.round(v.opacity * 100)} mixed={m("opacity")} min={0} max={100} defaultValue={100} suffix="%" onChange={(o) => onChange({ opacity: o / 100 })} />
      </Group>

      <Group id="line-stroke" title="Line style" sectioned={sectioned}>
        <Segmented label="Line style" value={v.style} mixed={m("style")} options={STYLE_OPTIONS} onChange={(style) => onChange({ style })} />
        {(v.style === "dashed" || m("style")) && (
          <SliderField
            label="Dash length"
            value={v.dashLength}
            mixed={m("dashLength")}
            min={LINE_LIMITS.dashLength[0]}
            max={LINE_LIMITS.dashLength[1]}
            step={0.1}
            defaultValue={3}
            suffix="×"
            onChange={(dashLength) => onChange({ dashLength })}
          />
        )}
        {(v.style !== "solid" || m("style")) && (
          <SliderField
            label="Gap length"
            value={v.gapLength}
            mixed={m("gapLength")}
            min={LINE_LIMITS.gapLength[0]}
            max={LINE_LIMITS.gapLength[1]}
            step={0.1}
            defaultValue={2}
            suffix="×"
            onChange={(gapLength) => onChange({ gapLength })}
          />
        )}
        <Segmented label="Line cap" value={v.cap} mixed={m("cap")} options={CAP_OPTIONS} onChange={(cap) => onChange({ cap })} />
      </Group>

      <Group id="line-shadow" title="Shadow" sectioned={sectioned}>
        <MixedCheckbox checked={v.shadowEnabled} mixed={m("shadowEnabled")} onChange={(shadowEnabled) => onChange({ shadowEnabled })}>
          <span className="field-label">Shadow</span>
        </MixedCheckbox>
        {shadowOn && (
          <>
            <span className="field-label">
              Shadow color <MixedTag show={m("shadowColor")} />
            </span>
            <div className="color-swatch-row">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={!m("shadowColor") && normalizeColor(c) === v.shadowColor ? "color-swatch active" : "color-swatch"}
                  style={{ background: c }}
                  onClick={() => onChange({ shadowColor: normalizeColor(c) })}
                  aria-label={`Shadow color ${c}`}
                />
              ))}
            </div>
            <SliderField label="Shadow opacity" value={Math.round(v.shadowOpacity * 100)} mixed={m("shadowOpacity")} min={0} max={100} defaultValue={50} suffix="%" onChange={(o) => onChange({ shadowOpacity: o / 100 })} />
            <SliderField
              label="Shadow blur"
              value={v.shadowBlur}
              mixed={m("shadowBlur")}
              min={LINE_LIMITS.shadowBlur[0]}
              max={LINE_LIMITS.shadowBlur[1]}
              step={0.1}
              defaultValue={0.5}
              suffix="×"
              onChange={(shadowBlur) => onChange({ shadowBlur })}
            />
            <SliderField
              label="Shadow offset"
              value={v.shadowDistance}
              mixed={m("shadowDistance")}
              min={LINE_LIMITS.shadowDistance[0]}
              max={LINE_LIMITS.shadowDistance[1]}
              step={0.1}
              defaultValue={0.5}
              suffix="×"
              onChange={(shadowDistance) => onChange({ shadowDistance })}
            />
            <SliderField label="Shadow position" value={Math.round(v.shadowAngle)} mixed={m("shadowAngle")} min={-180} max={180} defaultValue={45} suffix="°" onChange={(shadowAngle) => onChange({ shadowAngle })} />
          </>
        )}
      </Group>
    </>
  );
}

/**
 * The Lines tool: drawing mode, the active layer's folders of lines (show/
 * hide, lock, reorder, rename, delete, drag and drop) and, in the right
 * column, the selected line's settings (or several lines' at once), a
 * clicked folder's settings, or the style of the next line.
 */
export default function LinePanel({
  layerName,
  selected,
  selectedLocked,
  draft,
  layers,
  mode,
  drawing,
  maxWidth,
  lines,
  groups,
  activeLayerId,
  activeGroupId,
  onSetMode,
  smoothing,
  onSmoothingChange,
  onToggleDrawing,
  onChange,
  onDelete,
  onDone,
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
  onDeleteMany,
}: {
  /** Name of the active layer this tool edits. */
  layerName: string;
  selected: MapLineData | null;
  /** The selected line or its folder is locked. */
  selectedLocked: boolean;
  draft: LineStyle;
  layers: MapLayerData[];
  mode: LineKind;
  drawing: boolean;
  maxWidth: number;
  /** Lines on the active layer (home or shown here). */
  lines: MapLineData[];
  /** Every folder of the map. */
  groups: MapFolderData[];
  activeLayerId: string;
  /** Where new lines go; null = Ungrouped. */
  activeGroupId: string | null;
  onSetMode: (mode: LineKind) => void;
  /** Free-draw smoothing, 0–100. */
  smoothing: number;
  onSmoothingChange: (value: number) => void;
  onToggleDrawing: () => void;
  onChange: (patch: LinePatch) => void;
  onDelete: () => void;
  onDone: () => void;
  onClose: () => void;
  onSetActiveGroup: (id: string | null) => void;
  onSelectLine: (id: string | null) => void;
  onUpdateLine: (id: string, patch: LinePatch) => void;
  onDeleteLine: (id: string) => void;
  onCreateGroup: (name: string) => void;
  onUpdateGroup: (id: string, patch: FolderPatch) => void;
  onDeleteGroup: (id: string, cascade: boolean) => void;
  /** Every selected line (several: they're edited together). */
  selectedIds: string[];
  /** A click on a line in the list (Ctrl/Shift pick several); `order` is the list as shown. */
  onPick: (id: string, mods: ClickMods, order: string[]) => void;
  /** One edit of several lines (locked ones are skipped unless `includeLocked`). */
  onUpdateMany: (ids: string[], patchOf: (line: MapLineData) => LinePatch, opts?: { includeLocked?: boolean }) => void;
  onDeleteMany: (ids: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([UNGROUPED]));
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<{ folder: MapFolderData; count: number } | null>(null);
  const [renamingLine, setRenamingLine] = useState(false);
  /** The folder whose settings fill the right column (when no line is selected). */
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);

  const tree = folderTree(lines, groups, activeLayerId);
  const { ownGroups, itemsOf: linesOf, ungrouped, shared, order } = tree;
  const layerNameOf = (id: string | null) => layers.find((l) => l.id === id)?.name ?? "another layer";
  const groupOf = (l: MapLineData) => (l.groupId ? groups.find((g) => g.id === l.groupId) : undefined);
  const openFolder = ownGroups.find((g) => g.id === openFolderId) ?? null;
  const picked = new Set(selectedIds);
  const multi = selectedIds.length > 1 ? lines.filter((l) => picked.has(l.id)) : [];
  const isLocked = (l: MapLineData) => l.locked || Boolean(groupOf(l)?.locked);

  // Selecting a line (on the map or in the list) opens its folder in the tree.
  const selectedFolderKey = selected ? (selected.layerId !== activeLayerId ? SHARED : (tree.folderOf(selected) ?? UNGROUPED)) : null;
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  if ((selected?.id ?? null) !== lastSelectedId) {
    setLastSelectedId(selected?.id ?? null);
    setRenamingLine(false);
    if (selectedFolderKey && !expanded.has(selectedFolderKey)) setExpanded((prev) => new Set(prev).add(selectedFolderKey));
  }

  const target = ownGroups.find((g) => g.id === activeGroupId) ?? null;
  const drawBlocked = Boolean(target && (target.locked || !target.visible));
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
  const indexIn = (line: MapLineData) => {
    const list = line.layerId !== activeLayerId ? shared : linesOf(tree.folderOf(line));
    return Math.max(0, list.findIndex((l) => l.id === line.id));
  };
  const selectedFolderOptions = selected ? groups.filter((g) => g.layerId === selected.layerId).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const selectedGroup = selected ? groupOf(selected) : undefined;

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
    <div className="zones-panel zones-panel-editing line-panel">
      <div className="zones-panel-main">
        <div className="marker-side-panel-header">
          <h2>
            <PenTool size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            Lines
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close lines panel">
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>
        <p className="panel-layer-label">Layer: {layerName}</p>

        <div className="line-panel-segmented" role="group" aria-label="Drawing mode" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <button type="button" className={mode === "free" ? "btn btn-sm active" : "btn btn-sm"} aria-pressed={mode === "free"} onClick={() => onSetMode("free")}>
            <Pencil size={13} strokeWidth={2.25} />
            Free draw
          </button>
          <button type="button" className={mode === "pen" ? "btn btn-sm active" : "btn btn-sm"} aria-pressed={mode === "pen"} onClick={() => onSetMode("pen")}>
            <Spline size={13} strokeWidth={2.25} />
            Pen
          </button>
        </div>
        <button
          type="button"
          className={drawing ? "btn btn-primary" : "btn"}
          onClick={() => {
            // Starting to draw shows the next line's style, so it can be set before the first click on the map.
            if (!drawing) setOpenFolderId(null);
            onToggleDrawing();
          }}
          disabled={drawBlocked && !drawing}
          data-tooltip={drawBlocked ? "The folder is hidden or locked" : undefined}
        >
          <PenTool size={15} strokeWidth={2.25} />
          {drawing ? "Drawing… (click to stop)" : "Draw line"}
        </button>
        <p className="field-label zone-tool-hint">
          {drawing
            ? mode === "pen"
              ? "Click = corner, click-and-drag = curve, hold Shift for straight/45° segments. Right-click (or Enter) finishes, Backspace removes the last point, Esc cancels. Existing lines are ignored while drawing: stop drawing to edit one."
              : "Hold the left button and drag to draw, over other lines too. Stop drawing to edit an existing line."
            : "Click a line on the map or in the list to edit it, a folder for its settings. Ctrl/Shift+click picks several, Ctrl+A a whole folder."}
        </p>
        <p className="field-label line-panel-target">
          <FolderOpen size={13} strokeWidth={2.25} aria-hidden />
          New lines go into: <strong>{target ? target.name : "Ungrouped"}</strong>
          {target?.locked && " (locked)"}
          {target && !target.visible && " (hidden)"}
        </p>

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
                {items.length === 0 && <li className="field-label zone-empty-hint">No lines yet.</li>}
                {items.map((line, idx) => lineRow(line, lineLabel(line, idx), group.locked))}
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
                data-tooltip="Lines outside any folder. Click: new lines go here."
              >
                Ungrouped <span className="field-label">({ungrouped.length})</span>
              </button>
            </div>
            {expanded.has(UNGROUPED) && (
              <ul className="zone-list">
                {ungrouped.length === 0 && <li className="field-label zone-empty-hint">No lines outside folders.</li>}
                {ungrouped.map((line, i) => lineRow(line, lineLabel(line, i), false))}
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
              placeholder="Folder name (e.g. Roads, Rivers)"
              label="New folder name"
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
            New folder
          </button>
        )}
      </div>

      <div className="zones-panel-editor">
        {multi.length > 1 ? (
          <MultiLineEditor
            lines={multi}
            layers={layers}
            groups={groups}
            maxWidth={maxWidth}
            folderOf={(l) => (l.groupId && groups.some((g) => g.id === l.groupId) ? l.groupId : null)}
            isLocked={isLocked}
            onUpdateMany={(patchOf, opts) => onUpdateMany(selectedIds, patchOf, opts)}
            onDelete={() => onDeleteMany(selectedIds)}
            onDone={() => onSelectLine(null)}
          />
        ) : selected ? (
          <>
            <div className="zone-editor-header">
              {selected.kind === "pen" ? <Spline size={14} strokeWidth={2.25} /> : <Pencil size={14} strokeWidth={2.25} />}
              {renamingLine ? (
                <NameInput
                  value={selected.name}
                  placeholder={lineLabel({ ...selected, name: "" }, indexIn(selected))}
                  label="Line name"
                  onSave={(name) => {
                    setRenamingLine(false);
                    if (name !== selected.name) onChange({ name });
                  }}
                  onCancel={() => setRenamingLine(false)}
                />
              ) : (
                <button type="button" className="zone-region-name line-panel-name" onClick={() => setRenamingLine(true)} data-tooltip="Rename">
                  {lineLabel(selected, indexIn(selected))}
                </button>
              )}
              <button type="button" className="btn btn-sm btn-primary zone-editor-done" onClick={onDone}>
                <Check size={13} strokeWidth={2.25} />
                Done
              </button>
            </div>
            {selectedLocked && (
              <p className="field-label line-panel-locked">
                <Lock size={12} strokeWidth={2.25} aria-hidden /> Locked{selectedGroup?.locked ? " by its folder" : ""}. Unlock it to move or edit it.
              </p>
            )}
            <fieldset className="line-panel-fieldset" disabled={selectedLocked}>
              <LineStyleFields v={selected} maxWidth={maxWidth} onChange={onChange} />
              <ToolSection id="line-layers" title="Folder and layers">
                <FolderSelect
                  value={selectedGroup && selectedFolderOptions.includes(selectedGroup) ? selectedGroup.id : null}
                  folders={selectedFolderOptions}
                  noneLabel="Ungrouped"
                  onChange={(groupId) => onChange({ groupId })}
                />
                <LayerSelect value={selected.layerId} layers={layers} onChange={(layerId) => onChange({ layerId })} />
                <LayerChecklist
                  layers={layers}
                  homeLayerId={selected.layerId}
                  value={selected.extraLayerIds ?? []}
                  alwaysDrawFlag="linesAlwaysVisible"
                  inherited={selectedGroup ? { ids: selectedGroup.extraLayerIds, from: selectedGroup.name } : undefined}
                  onChange={(extraLayerIds) => onChange({ extraLayerIds })}
                />
              </ToolSection>
            </fieldset>
            <button type="button" className="btn btn-danger" onClick={onDelete} disabled={selectedLocked}>
              <Trash2 size={14} strokeWidth={2.25} />
              Delete line
            </button>
          </>
        ) : openFolder ? (
          <FolderSettings
            folder={openFolder}
            count={linesOf(openFolder.id).length}
            noun="line"
            layers={layers}
            alwaysDrawFlag="linesAlwaysVisible"
            captureStyle={() => ({ ...draft })}
            renderStyle={(style, change) => <LineStyleFields v={{ ...draft, ...style } as LineStyle} maxWidth={maxWidth} sectioned={false} onChange={change} />}
            onUpdate={(patch) => onUpdateGroup(openFolder.id, patch)}
            onDelete={() => requestDelete(openFolder)}
            onDone={() => setOpenFolderId(null)}
          />
        ) : (
          <>
            <div className="zone-editor-header">
              {mode === "pen" ? <Spline size={14} strokeWidth={2.25} /> : <Pencil size={14} strokeWidth={2.25} />}
              <span className="line-panel-name">Next line</span>
            </div>
            {mode === "free" && (
              <ToolSection id="line-drawing" title="Drawing">
                <SliderField label="Smoothing" value={smoothing} min={0} max={100} defaultValue={50} onChange={onSmoothingChange} />
                <p className="field-label zone-tool-hint">Steadies free-draw strokes: the pen trails the cursor a little, so hand shakes don&apos;t show. 0 = off.</p>
              </ToolSection>
            )}
            {target?.defaultStyle ? (
              <>
                <p className="field-label zone-tool-hint">New lines in “{target.name}” use the folder&apos;s default style.</p>
                <button type="button" className="btn btn-sm" onClick={() => setOpenFolderId(target.id)}>
                  <FolderOpen size={13} strokeWidth={2.25} />
                  Edit the folder&apos;s style
                </button>
              </>
            ) : (
              <>
                <p className="field-label zone-tool-hint">The style the next line you draw gets. Select a line to edit it instead.</p>
                <LineStyleFields v={draft} maxWidth={maxWidth} onChange={onChange} />
              </>
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

/** Several lines' settings at once: a field shows its value when they agree, "Mixed" when not. */
function MultiLineEditor({
  lines,
  layers,
  groups,
  maxWidth,
  folderOf,
  isLocked,
  onUpdateMany,
  onDelete,
  onDone,
}: {
  lines: MapLineData[];
  layers: MapLayerData[];
  groups: MapFolderData[];
  maxWidth: number;
  folderOf: (line: MapLineData) => string | null;
  isLocked: (line: MapLineData) => boolean;
  onUpdateMany: (patchOf: (line: MapLineData) => LinePatch, opts?: { includeLocked?: boolean }) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const [first] = lines;
  const mixed = mixedKeys(lines);
  const layersOf = sharedLayers(lines.map((l) => l.extraLayerIds));
  const folders = new Set(lines.map(folderOf));
  const oneLayer = !mixed.has("layerId");
  const folderOptions = oneLayer ? groups.filter((g) => g.layerId === first.layerId).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const allVisible = lines.every((l) => l.visible);
  const allLocked = lines.every((l) => l.locked);
  const setAll = (patch: LinePatch) => onUpdateMany(() => patch);
  return (
    <>
      <MultiHeader
        Icon={PenTool}
        count={lines.length}
        noun="line"
        lockedCount={lines.filter(isLocked).length}
        allVisible={allVisible}
        allLocked={allLocked}
        onToggleVisible={() => onUpdateMany(() => ({ visible: !allVisible }), { includeLocked: true })}
        onToggleLocked={() => onUpdateMany(() => ({ locked: !allLocked }), { includeLocked: true })}
        onDelete={onDelete}
        onDone={onDone}
      />
      <LineStyleFields v={first} maxWidth={maxWidth} mixed={mixed} onChange={setAll} />
      <ToolSection id="line-layers" title="Folder and layers">
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
          alwaysDrawFlag="linesAlwaysVisible"
          onChange={() => undefined}
          onEdit={(add, remove) => onUpdateMany((l) => ({ extraLayerIds: editLayers(l.extraLayerIds, add, remove).filter((id) => id !== l.layerId) }))}
        />
      </ToolSection>
    </>
  );
}
