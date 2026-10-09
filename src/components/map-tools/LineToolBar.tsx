"use client";

import { MoreHorizontal, MousePointer2, Pencil, Spline, Trash2 } from "lucide-react";
import { formatInteger } from "@/server/settings/number-format";
import type { LineKind, LineStyle, LineStyleKind } from "@/server/lines/line-config";
import { useT } from "@/i18n/useT";
import LayerChecklist from "../LayerChecklist";
import { FolderSelect, LayerSelect, useNoun, type MapFolderData } from "../LayerFolders";
import { editLayers, mixedKeys, sharedLayers } from "../multi-select";
import ToolSection from "../ToolSection";
import type { MapLayerData } from "../layer-images";
import type { MapLineData } from "../LineLayer";
import { LineColorFields, LineShadowFields, LineStrokeFields, LineWidthField, type LinePatch } from "../line-fields";
import { DoneButton, FolderTargetPopover, MultiSelectionGroup, NameField, SelectedCount, Swatch, ToolBar, ToolBarButton, ToolBarDivider, ToolBarPopover } from "./ToolBar";

const NO_MIXED: ReadonlySet<string> = new Set();

/** The dash pattern of each line style, drawn on its button. */
const STYLE_DASH: Record<LineStyleKind, string | undefined> = { solid: undefined, dot: "0.5 3.5", dashed: "5 3" };

/** A short sample of a line style, for the style button's face. */
function StyleSample({ style }: { style: LineStyleKind }) {
  return (
    <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden>
      <line x1="2" y1="4" x2="20" y2="4" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeDasharray={STYLE_DASH[style]} />
    </svg>
  );
}

/**
 * The Lines tool's bar: select, draw (free or pen), and the folder new lines
 * go into. With lines selected (or while drawing: the next line) it grows
 * their settings: color, width, style and "More" (shadow, name, folder and
 * layers).
 */
export default function LineToolBar({
  inset,
  layers,
  lines,
  groups,
  activeLayerId,
  activeGroupId,
  onSetActiveGroup,
  mode,
  onSetMode,
  drawing,
  onToggleDrawing,
  smoothing,
  onSmoothingChange,
  selected,
  selectedLabel,
  selectedLocked,
  draft,
  maxWidth,
  onChange,
  onDelete,
  onDone,
  selectedIds,
  isLocked,
  onUpdateMany,
  onDeleteMany,
}: {
  /** Where the map's free part starts (right of the side panel). */
  inset: number;
  layers: MapLayerData[];
  /** Lines on the active layer (home or shown here). */
  lines: MapLineData[];
  /** Every line folder of the map. */
  groups: MapFolderData[];
  activeLayerId: string;
  /** Where new lines go; null = Ungrouped. */
  activeGroupId: string | null;
  onSetActiveGroup: (id: string | null) => void;
  mode: LineKind;
  onSetMode: (mode: LineKind) => void;
  drawing: boolean;
  onToggleDrawing: () => void;
  /** Free-draw smoothing, 0–100. */
  smoothing: number;
  onSmoothingChange: (value: number) => void;
  /** The one selected line. */
  selected: MapLineData | null;
  /** Its label (its name, or its place in its folder). */
  selectedLabel: string;
  /** It or its folder is locked. */
  selectedLocked: boolean;
  /** The next drawn line's style. */
  draft: LineStyle;
  maxWidth: number;
  /** Edits the selected line, or the next one when none is selected. */
  onChange: (patch: LinePatch) => void;
  onDelete: () => void;
  onDone: () => void;
  selectedIds: string[];
  isLocked: (line: MapLineData) => boolean;
  /** One edit of several lines (locked ones are skipped unless `includeLocked`). */
  onUpdateMany: (ids: string[], patchOf: (line: MapLineData) => LinePatch, opts?: { includeLocked?: boolean }) => void;
  onDeleteMany: (ids: string[]) => void;
}) {
  const t = useT("maps");
  const { one, many } = useNoun("line");
  const ownGroups = groups.filter((g) => g.layerId === activeLayerId).sort((a, b) => a.sortOrder - b.sortOrder);
  const target = ownGroups.find((g) => g.id === activeGroupId) ?? null;
  const drawBlocked = Boolean(target && (target.locked || !target.visible));

  const picked = new Set(selectedIds);
  const multi = selectedIds.length > 1 ? lines.filter((l) => picked.has(l.id)) : [];
  const lockedCount = multi.filter(isLocked).length;
  // What the style buttons edit: the selection, or the next line while drawing (unless its folder sets the style).
  const editing: { v: LineStyle; mixed: ReadonlySet<string>; onChange: (patch: LinePatch) => void; disabled: boolean } | null =
    multi.length > 1
      ? { v: multi[0], mixed: mixedKeys(multi), onChange: (patch) => onUpdateMany(selectedIds, () => patch), disabled: lockedCount === multi.length }
      : selected
        ? { v: selected, mixed: NO_MIXED, onChange, disabled: selectedLocked }
        : drawing && !target?.defaultStyle
          ? { v: draft, mixed: NO_MIXED, onChange, disabled: false }
          : null;

  /** Arms drawing in `kind` (or stops, when it's already the armed one). */
  function draw(kind: LineKind) {
    if (drawing && mode === kind) return onToggleDrawing();
    onSetMode(kind);
    if (!drawing) onToggleDrawing();
  }

  const caption = captionFor();
  function captionFor(): string | undefined {
    if (multi.length > 1) return lockedCount ? t("layerFolders.lockedWontChange", { count: lockedCount, n: formatInteger(lockedCount), noun: one, nouns: many }) : undefined;
    if (selected) return selectedLocked ? (selected.groupId && groups.find((g) => g.id === selected.groupId)?.locked ? t("lines.lockedByFolder") : t("lines.locked")) : undefined;
    if (!drawing) return undefined;
    const hint = mode === "pen" ? t("lines.penHint") : t("lines.freeHint");
    return target?.defaultStyle ? `${hint} ${t("lines.folderStyle", { name: target.name })}` : hint;
  }

  const mixedTag = <span className="mixed-tag">{t("layerFolders.mixed")}</span>;

  return (
    <ToolBar label={t("lineBar.label")} inset={inset} caption={caption}>
      <ToolBarButton Icon={MousePointer2} label={t("lineBar.select")} hint={t("lineBar.selectHint")} pressed={!drawing} onClick={() => drawing && onToggleDrawing()} />
      <ToolBarDivider />
      <ToolBarButton
        Icon={Pencil}
        label={t("lines.mode.free")}
        hint={drawBlocked ? t("panel.folderBlocked") : t("lineBar.freeHint")}
        pressed={drawing && mode === "free"}
        disabled={drawBlocked && !drawing}
        onClick={() => draw("free")}
      />
      <ToolBarButton
        Icon={Spline}
        label={t("lines.mode.pen")}
        hint={drawBlocked ? t("panel.folderBlocked") : t("lineBar.penHint")}
        pressed={drawing && mode === "pen"}
        disabled={drawBlocked && !drawing}
        onClick={() => draw("pen")}
      />
      {drawing && mode === "free" && (
        <label className="tool-bar-slider" data-tooltip={t("lines.smoothingHint")}>
          <span className="tool-bar-value">{t("lineBar.smoothingValue", { n: formatInteger(smoothing) })}</span>
          <input type="range" min={0} max={100} value={smoothing} aria-label={t("lines.smoothing")} onChange={(e) => onSmoothingChange(Number(e.target.value))} />
        </label>
      )}
      <ToolBarDivider />
      <FolderTargetPopover
        label={t("lines.target", { folder: target?.name ?? t("panel.ungrouped") })}
        hint={t("lineBar.folderHint")}
        folders={ownGroups}
        activeId={activeGroupId}
        placeholder={t("panel.ungrouped")}
        noneLabel={t("panel.ungrouped")}
        emptyText={t("panel.ungrouped")}
        onPick={onSetActiveGroup}
      />

      {(selected || multi.length > 1 || editing) && <ToolBarDivider />}
      {selected && (
        <span className="tool-bar-label">
          {selected.kind === "pen" ? <Spline size={14} strokeWidth={2.25} aria-hidden /> : <Pencil size={14} strokeWidth={2.25} aria-hidden />}
          <span className="tool-bar-text">{selectedLabel}</span>
        </span>
      )}
      {multi.length > 1 && <SelectedCount noun="line" count={multi.length} />}
      {!selected && multi.length === 0 && editing && <span className="tool-bar-label">{t("lines.next")}</span>}

      {editing && (
        <>
          <ToolBarPopover label={t("style.color")} disabled={editing.disabled} face={<Swatch color={editing.v.color} mixed={editing.mixed.has("color")} />}>
            <div className="tool-bar-pop-fields">
              <LineColorFields {...editing} />
            </div>
          </ToolBarPopover>
          <ToolBarPopover
            label={t("style.size")}
            disabled={editing.disabled}
            face={editing.mixed.has("width") ? mixedTag : <span className="tool-bar-value">{t("toolBar.px", { n: formatInteger(editing.v.width) })}</span>}
          >
            <div className="tool-bar-pop-fields">
              <LineWidthField {...editing} maxWidth={maxWidth} />
            </div>
          </ToolBarPopover>
          <ToolBarPopover label={t("lines.style")} disabled={editing.disabled} face={editing.mixed.has("style") ? mixedTag : <StyleSample style={editing.v.style} />}>
            <div className="tool-bar-pop-fields">
              <LineStrokeFields {...editing} />
            </div>
          </ToolBarPopover>
          <ToolBarPopover label={t("toolBar.more")} hint={t(selected || multi.length > 1 ? "lineBar.moreHint" : "lineBar.moreDraftHint")} wide disabled={editing.disabled} face={<MoreHorizontal size={16} strokeWidth={2.25} aria-hidden />}>
            <div className="tool-bar-pop-fields">
              {selected && <NameField sourceKey={selected.id} value={selected.name} placeholder={selected.name ? undefined : selectedLabel} allowEmpty onRename={(name) => onChange({ name })} />}
              <ToolSection id="line-shadow" title={t("style.shadow")}>
                <LineShadowFields {...editing} />
              </ToolSection>
              {(selected || multi.length > 1) && (
                <LinePlacement lines={multi.length > 1 ? multi : [selected!]} layers={layers} groups={groups} onUpdate={(patchOf) => (multi.length > 1 ? onUpdateMany(selectedIds, patchOf) : onChange(patchOf(selected!)))} />
              )}
            </div>
          </ToolBarPopover>
        </>
      )}

      {selected && (
        <>
          <ToolBarButton Icon={Trash2} danger label={t("lines.delete")} disabled={selectedLocked} onClick={onDelete} />
          <DoneButton onClick={onDone} />
        </>
      )}
      {multi.length > 1 && (
        <MultiSelectionGroup
          noun="line"
          count={multi.length}
          lockedCount={lockedCount}
          allVisible={multi.every((l) => l.visible)}
          allLocked={multi.every((l) => l.locked)}
          onToggleVisible={() => onUpdateMany(selectedIds, () => ({ visible: !multi.every((l) => l.visible) }), { includeLocked: true })}
          onToggleLocked={() => onUpdateMany(selectedIds, () => ({ locked: !multi.every((l) => l.locked) }), { includeLocked: true })}
          onDelete={() => onDeleteMany(selectedIds)}
          onDone={onDone}
        />
      )}
    </ToolBar>
  );
}

/** The selected lines' folder, home layer and the other layers they show on. */
function LinePlacement({ lines, layers, groups, onUpdate }: { lines: MapLineData[]; layers: MapLayerData[]; groups: MapFolderData[]; onUpdate: (patchOf: (line: MapLineData) => LinePatch) => void }) {
  const t = useT("maps");
  const [first] = lines;
  const multi = lines.length > 1;
  const mixed = multi ? mixedKeys(lines) : NO_MIXED;
  const oneLayer = !mixed.has("layerId");
  const folderOf = (l: MapLineData) => (l.groupId && groups.some((g) => g.id === l.groupId) ? l.groupId : null);
  const folders = new Set(lines.map(folderOf));
  const folderOptions = oneLayer ? groups.filter((g) => g.layerId === first.layerId).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const group = !multi && first.groupId ? groups.find((g) => g.id === first.groupId) : undefined;
  const layersOf = sharedLayers(lines.map((l) => l.extraLayerIds));
  const setAll = (patch: LinePatch) => onUpdate(() => patch);
  return (
    <ToolSection id="line-layers" title={t("panel.folderLayers")}>
      <FolderSelect
        value={folderOf(first)}
        mixed={folders.size > 1}
        folders={folderOptions}
        noneLabel={t("panel.ungrouped")}
        disabled={!oneLayer}
        hint={oneLayer ? undefined : t("panel.differentLayers")}
        onChange={(groupId) => setAll({ groupId })}
      />
      <LayerSelect value={first.layerId} mixed={!oneLayer} layers={layers} onChange={(layerId) => setAll({ layerId })} />
      {multi ? (
        <LayerChecklist
          layers={layers}
          homeLayerId={oneLayer ? first.layerId : null}
          value={layersOf.all}
          mixedIds={layersOf.some}
          alwaysDrawFlag="linesAlwaysVisible"
          onChange={() => undefined}
          onEdit={(add, remove) => onUpdate((l) => ({ extraLayerIds: editLayers(l.extraLayerIds, add, remove).filter((id) => id !== l.layerId) }))}
        />
      ) : (
        <LayerChecklist
          layers={layers}
          homeLayerId={first.layerId}
          value={first.extraLayerIds ?? []}
          alwaysDrawFlag="linesAlwaysVisible"
          inherited={group ? { ids: group.extraLayerIds, from: group.name } : undefined}
          onChange={(extraLayerIds) => setAll({ extraLayerIds })}
        />
      )}
    </ToolSection>
  );
}
