"use client";

import { Bold, Check, MoreHorizontal, MousePointer2, MousePointerClick, PenLine, RotateCw, Trash2, Type } from "lucide-react";
import { formatInteger } from "@/server/settings/number-format";
import { MAP_FONTS, mapFontFamily } from "@/server/texts/fonts";
import type { TextStyle } from "@/server/texts/text-config";
import { useT } from "@/i18n/useT";
import LayerChecklist from "../LayerChecklist";
import { FolderSelect, LayerSelect, useNoun, type MapFolderData } from "../LayerFolders";
import { editLayers, mixedKeys, sharedLayers } from "../multi-select";
import ToolSection from "../ToolSection";
import type { MapLayerData } from "../layer-images";
import type { MapTextData } from "../TextLayer";
import {
  ALIGNS,
  TextAlignField,
  TextColorField,
  TextContentField,
  TextLayoutFields,
  TextOutlineFields,
  TextRotationField,
  TextShadowFields,
  TextSizeField,
  textLabel,
  type TextDraft,
  type TextPatch,
} from "../text-fields";
import { DoneButton, FolderTargetPopover, MultiSelectionGroup, SelectedCount, Swatch, ToolBar, ToolBarButton, ToolBarDivider, ToolBarPopover } from "./ToolBar";

const NO_MIXED: ReadonlySet<string> = new Set();

/**
 * The Text tool's bar: select, place, and the folder new texts go into.
 * With texts selected (or while placing: the next text) it grows their
 * settings: content, font, bold, size, alignment, color, rotation and
 * "More" (layout, outline, shadow, folder and layers).
 */
export default function TextToolBar({
  inset,
  layers,
  texts,
  groups,
  activeLayerId,
  activeGroupId,
  onSetActiveGroup,
  placing,
  onTogglePlacing,
  selected,
  selectedLocked,
  draft,
  maxFontSize,
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
  /** Texts on the active layer (home or shown here). */
  texts: MapTextData[];
  /** Every text folder of the map. */
  groups: MapFolderData[];
  activeLayerId: string;
  /** Where new texts go; null = Ungrouped. */
  activeGroupId: string | null;
  onSetActiveGroup: (id: string | null) => void;
  placing: boolean;
  onTogglePlacing: () => void;
  /** The one selected text. */
  selected: MapTextData | null;
  /** It or its folder is locked. */
  selectedLocked: boolean;
  /** What the next placed text says and looks like. */
  draft: TextDraft;
  maxFontSize: number;
  /** Edits the selected text, or the next one when none is selected. */
  onChange: (patch: TextPatch) => void;
  onDelete: () => void;
  onDone: () => void;
  selectedIds: string[];
  isLocked: (text: MapTextData) => boolean;
  /** One edit of several texts (locked ones are skipped unless `includeLocked`). */
  onUpdateMany: (ids: string[], patchOf: (text: MapTextData) => TextPatch, opts?: { includeLocked?: boolean }) => void;
  onDeleteMany: (ids: string[]) => void;
}) {
  const tm = useT("maps");
  const { one, many } = useNoun("text");
  const ownGroups = groups.filter((g) => g.layerId === activeLayerId).sort((a, b) => a.sortOrder - b.sortOrder);
  const target = ownGroups.find((g) => g.id === activeGroupId) ?? null;
  const placeBlocked = Boolean(target && (target.locked || !target.visible));

  const picked = new Set(selectedIds);
  const multi = selectedIds.length > 1 ? texts.filter((t) => picked.has(t.id)) : [];
  const lockedCount = multi.filter(isLocked).length;
  // What the style buttons edit: the selection, or the next text while placing (unless its folder sets the style).
  const editing: { v: TextStyle; mixed: ReadonlySet<string>; onChange: (patch: TextPatch) => void; disabled: boolean } | null =
    multi.length > 1
      ? { v: multi[0], mixed: mixedKeys(multi), onChange: (patch) => onUpdateMany(selectedIds, () => patch), disabled: lockedCount === multi.length }
      : selected
        ? { v: selected, mixed: NO_MIXED, onChange, disabled: selectedLocked }
        : placing && !target?.defaultStyle
          ? { v: draft, mixed: NO_MIXED, onChange, disabled: false }
          : null;

  const caption = captionFor();
  function captionFor(): string | undefined {
    if (multi.length > 1) return lockedCount ? tm("layerFolders.lockedWontChange", { count: lockedCount, n: formatInteger(lockedCount), noun: one, nouns: many }) : undefined;
    if (selected) return selectedLocked ? (selected.groupId && groups.find((g) => g.id === selected.groupId)?.locked ? tm("text.lockedByFolder") : tm("text.locked")) : tm("text.editingHint");
    if (!placing) return undefined;
    if (target?.defaultStyle) return `${tm("text.placing")} ${tm("text.folderStyle", { name: target.name })}`;
    return tm("text.placing");
  }

  return (
    <ToolBar label={tm("textBar.label")} inset={inset} caption={caption}>
      <ToolBarButton Icon={MousePointer2} label={tm("textBar.select")} hint={tm("textBar.selectHint")} pressed={!placing} onClick={() => placing && onTogglePlacing()} />
      <ToolBarButton
        Icon={MousePointerClick}
        label={tm("text.place")}
        hint={placeBlocked ? tm("panel.folderBlocked") : tm("textBar.placeHint")}
        pressed={placing}
        disabled={placeBlocked && !placing}
        onClick={onTogglePlacing}
      />
      <ToolBarDivider />
      <FolderTargetPopover
        label={tm("text.target", { folder: target?.name ?? tm("panel.ungrouped") })}
        hint={tm("textBar.folderHint")}
        folders={ownGroups}
        activeId={activeGroupId}
        placeholder={tm("panel.ungrouped")}
        noneLabel={tm("panel.ungrouped")}
        emptyText={tm("panel.ungrouped")}
        onPick={onSetActiveGroup}
      />

      {(selected || multi.length > 1 || placing) && <ToolBarDivider />}
      {selected && (
        <span className="tool-bar-label">
          <Type size={14} strokeWidth={2.25} aria-hidden />
          <span className="tool-bar-text">{textLabel(selected)}</span>
        </span>
      )}
      {multi.length > 1 && <SelectedCount noun="text" count={multi.length} />}
      {placing && !selected && <span className="tool-bar-label">{tm("text.next")}</span>}

      {(selected || multi.length > 1 || placing) && (
        <ToolBarPopover label={tm("textBar.editText")} disabled={editing ? editing.disabled : !placing} face={<PenLine size={16} strokeWidth={2.25} aria-hidden />}>
          <div className="tool-bar-pop-fields">
            {multi.length > 1 ? (
              <TextContentField sourceKey={selectedIds.join(",")} value={multi[0].text} mixed={mixedKeys(multi).has("text")} autoFocus onChange={(text) => onUpdateMany(selectedIds, () => ({ text }))} />
            ) : (
              <TextContentField sourceKey={selected?.id ?? "draft"} value={selected?.text ?? draft.text} autoFocus onChange={(text) => onChange({ text })} />
            )}
          </div>
        </ToolBarPopover>
      )}
      {editing && <StyleButtons {...editing} maxFontSize={maxFontSize} />}
      {editing && (
        <ToolBarPopover label={tm("toolBar.more")} hint={tm("textBar.moreHint")} wide disabled={editing.disabled} face={<MoreHorizontal size={16} strokeWidth={2.25} aria-hidden />}>
          <div className="tool-bar-pop-fields">
            <ToolSection id="text-layout" title={tm("text.layout")}>
              <TextLayoutFields {...editing} />
            </ToolSection>
            <ToolSection id="text-outline" title={tm("zones.outline")}>
              <TextOutlineFields {...editing} />
            </ToolSection>
            <ToolSection id="text-shadow" title={tm("style.shadow")}>
              <TextShadowFields {...editing} />
            </ToolSection>
            {(selected || multi.length > 1) && <TextPlacement texts={multi.length > 1 ? multi : [selected!]} layers={layers} groups={groups} onUpdate={(patchOf) => (multi.length > 1 ? onUpdateMany(selectedIds, patchOf) : onChange(patchOf(selected!)))} />}
          </div>
        </ToolBarPopover>
      )}

      {selected && (
        <>
          <ToolBarButton Icon={Trash2} danger label={tm("text.delete")} disabled={selectedLocked} onClick={onDelete} />
          <DoneButton onClick={onDone} />
        </>
      )}
      {multi.length > 1 && (
        <MultiSelectionGroup
          noun="text"
          count={multi.length}
          lockedCount={lockedCount}
          allVisible={multi.every((t) => t.visible)}
          allLocked={multi.every((t) => t.locked)}
          onToggleVisible={() => onUpdateMany(selectedIds, () => ({ visible: !multi.every((t) => t.visible) }), { includeLocked: true })}
          onToggleLocked={() => onUpdateMany(selectedIds, () => ({ locked: !multi.every((t) => t.locked) }), { includeLocked: true })}
          onDelete={() => onDeleteMany(selectedIds)}
          onDone={onDone}
        />
      )}
    </ToolBar>
  );
}

/** Font, bold, size, alignment, color and rotation: one button each. */
function StyleButtons({ v, mixed, onChange, disabled, maxFontSize }: { v: TextStyle; mixed: ReadonlySet<string>; onChange: (patch: TextPatch) => void; disabled: boolean; maxFontSize: number }) {
  const tm = useT("maps");
  const tc = useT("common");
  const mixedTag = <span className="mixed-tag">{tm("layerFolders.mixed")}</span>;
  const font = MAP_FONTS.find((f) => f.key === v.fontKey) ?? MAP_FONTS[0];
  const AlignIcon = (ALIGNS.find((a) => a.key === v.align) ?? ALIGNS[0]).Icon;
  const bold = mixed.has("bold") ? false : v.bold;
  return (
    <>
      <ToolBarPopover
        label={tm("text.font")}
        disabled={disabled}
        face={mixed.has("fontKey") ? mixedTag : <span className="tool-bar-text" style={{ fontFamily: mapFontFamily(font.key), fontWeight: v.bold ? 700 : 400 }}>{font.label}</span>}
      >
        {(close) => (
          <>
            <span className="field-label">{tc("font.label")}</span>
            <ul className="tool-bar-choices">
              {MAP_FONTS.map((f) => {
                const on = !mixed.has("fontKey") && f.key === v.fontKey;
                return (
                  <li key={f.key}>
                    <button
                      type="button"
                      aria-pressed={on}
                      style={{ fontFamily: mapFontFamily(f.key), fontWeight: v.bold ? 700 : 400 }}
                      onClick={() => {
                        onChange({ fontKey: f.key });
                        close();
                      }}
                    >
                      <span className="tool-bar-text">{f.label}</span>
                      {on && <Check size={14} strokeWidth={2.25} aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </ToolBarPopover>
      <ToolBarButton
        Icon={Bold}
        label={tm("text.bold")}
        hint={mixed.has("bold") ? tm("text.boldMixed") : tm("text.bold")}
        pressed={bold}
        disabled={disabled}
        onClick={() => onChange({ bold: mixed.has("bold") ? true : !v.bold })}
      />
      <ToolBarPopover label={tm("style.size")} disabled={disabled} face={mixed.has("fontSize") ? mixedTag : <span className="tool-bar-value">{tm("toolBar.px", { n: formatInteger(Math.round(v.fontSize)) })}</span>}>
        <div className="tool-bar-pop-fields">
          <TextSizeField v={v} mixed={mixed} maxFontSize={maxFontSize} onChange={onChange} />
        </div>
      </ToolBarPopover>
      <ToolBarPopover label={tm("text.alignment")} disabled={disabled} face={mixed.has("align") ? mixedTag : <AlignIcon size={16} strokeWidth={2.25} aria-hidden />}>
        <div className="tool-bar-pop-fields">
          <TextAlignField v={v} mixed={mixed} onChange={onChange} />
        </div>
      </ToolBarPopover>
      <ToolBarPopover label={tm("style.color")} disabled={disabled} face={<Swatch color={v.color} mixed={mixed.has("color")} />}>
        <div className="tool-bar-pop-fields">
          <TextColorField v={v} mixed={mixed} onChange={onChange} />
        </div>
      </ToolBarPopover>
      <ToolBarPopover
        label={tm("text.rotation")}
        disabled={disabled}
        face={
          <>
            <RotateCw size={16} strokeWidth={2.25} aria-hidden />
            {mixed.has("rotation") ? mixedTag : <span className="tool-bar-value">{tm("textBar.degrees", { n: formatInteger(Math.round(v.rotation)) })}</span>}
          </>
        }
      >
        <div className="tool-bar-pop-fields">
          <TextRotationField v={v} mixed={mixed} onChange={onChange} />
        </div>
      </ToolBarPopover>
    </>
  );
}

/** The selected texts' folder, home layer and the other layers they show on. */
function TextPlacement({ texts, layers, groups, onUpdate }: { texts: MapTextData[]; layers: MapLayerData[]; groups: MapFolderData[]; onUpdate: (patchOf: (text: MapTextData) => TextPatch) => void }) {
  const tm = useT("maps");
  const [first] = texts;
  const multi = texts.length > 1;
  const mixed = multi ? mixedKeys(texts) : NO_MIXED;
  const oneLayer = !mixed.has("layerId");
  const folderOf = (t: MapTextData) => (t.groupId && groups.some((g) => g.id === t.groupId) ? t.groupId : null);
  const folders = new Set(texts.map(folderOf));
  const folderOptions = oneLayer ? groups.filter((g) => g.layerId === first.layerId).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const group = !multi && first.groupId ? groups.find((g) => g.id === first.groupId) : undefined;
  const layersOf = sharedLayers(texts.map((t) => t.extraLayerIds));
  const setAll = (patch: TextPatch) => onUpdate(() => patch);
  return (
    <ToolSection id="text-layers" title={tm("panel.folderLayers")}>
      <FolderSelect
        value={folderOf(first)}
        mixed={folders.size > 1}
        folders={folderOptions}
        noneLabel={tm("panel.ungrouped")}
        disabled={!oneLayer}
        hint={oneLayer ? undefined : tm("panel.differentLayers")}
        onChange={(groupId) => setAll({ groupId })}
      />
      <LayerSelect value={first.layerId} mixed={!oneLayer} layers={layers} onChange={(layerId) => setAll({ layerId })} />
      {multi ? (
        <LayerChecklist
          layers={layers}
          homeLayerId={oneLayer ? first.layerId : null}
          value={layersOf.all}
          mixedIds={layersOf.some}
          alwaysDrawFlag="textsAlwaysVisible"
          onChange={() => undefined}
          onEdit={(add, remove) => onUpdate((t) => ({ extraLayerIds: editLayers(t.extraLayerIds, add, remove).filter((id) => id !== t.layerId) }))}
        />
      ) : (
        <LayerChecklist
          layers={layers}
          homeLayerId={first.layerId}
          value={first.extraLayerIds ?? []}
          alwaysDrawFlag="textsAlwaysVisible"
          inherited={group ? { ids: group.extraLayerIds, from: group.name } : undefined}
          onChange={(extraLayerIds) => setAll({ extraLayerIds })}
        />
      )}
    </ToolSection>
  );
}
