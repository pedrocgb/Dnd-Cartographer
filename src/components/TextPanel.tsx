"use client";

import { useEffect, useRef, useState } from "react";
import { X, Type, Bold, Check, Trash2, AlignLeft, AlignCenter, AlignRight, MousePointerClick, Plus, ChevronRight, ChevronDown, FolderOpen, Lock } from "lucide-react";
import ColorWheel from "./ColorWheel";
import FontPicker from "./FontPicker";
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
import { clickMods, editLayers, mixedKeys, sharedLayers, type ClickMods } from "./multi-select";
import type { MapTextData } from "./TextLayer";
import ToolSection from "./ToolSection";
import { useListDrag } from "./use-list-drag";
import { LIMITS, type TextAlign, type TextStyle } from "@/server/texts/text-config";
import { COLOR_PRESETS, normalizeColor } from "@/server/markers/icon-registry";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";

export type TextDraft = TextStyle & { text: string };
export type TextPatch = Partial<TextDraft & { layerId: string; extraLayerIds: string[]; visible: boolean; locked: boolean; groupId: string | null; sortOrder: number }>;

const LABEL_MAX = 40;
const NO_MIXED: ReadonlySet<string> = new Set();

/** A text's label in the list: its first line, shortened. */
const textLabel = (t: MapTextData) => {
  const first = t.text.split("\n")[0].trim() || activeT("maps")("panel.text");
  return first.length > LABEL_MAX ? `${first.slice(0, LABEL_MAX - 1)}…` : first;
};
function Swatches({ value, mixed = false, onChange, label }: { value: string; mixed?: boolean; onChange: (c: string) => void; label: string }) {
  return (
    <div className="color-swatch-row">
      {COLOR_PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          className={!mixed && normalizeColor(c) === value ? "color-swatch active" : "color-swatch"}
          style={{ background: c }}
          onClick={() => onChange(normalizeColor(c))}
          aria-label={`${label} ${c}`}
        />
      ))}
    </div>
  );
}

const ALIGNS: { key: TextAlign; Icon: typeof AlignLeft }[] = [
  { key: "left", Icon: AlignLeft },
  { key: "center", Icon: AlignCenter },
  { key: "right", Icon: AlignRight },
];

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
 * The text's content. Kept locally: an empty text is never saved (the
 * server rejects it), but the field can still be cleared while typing.
 */
function TextContentField({ sourceKey, value, mixed = false, onChange }: { sourceKey: string; value: string; /** Several texts that say different things: typing replaces them all. */ mixed?: boolean; onChange: (text: string) => void }) {
  const tm = useT("maps");
  const [textValue, setTextValue] = useState(mixed ? "" : value);
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setTextValue(mixed ? "" : value);
  }, [sourceKey, value, mixed]);
  return (
    <label className="grid-field">
      <span className="field-label">
        {tm("panel.text")} <MixedTag show={mixed} />
      </span>
      <textarea
        className="text-panel-textarea"
        rows={3}
        value={textValue}
        placeholder={mixed ? tm("text.mixedPlaceholder") : undefined}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          setTextValue(mixed ? "" : value);
        }}
        onChange={(e) => {
          setTextValue(e.target.value);
          if (e.target.value.trim()) onChange(e.target.value);
        }}
      />
    </label>
  );
}

/** Font, size, layout, color, outline and shadow: for a text, the next one, or a folder's default. */
function TextStyleFields({
  v,
  maxFontSize,
  sectioned = true,
  mixed = NO_MIXED,
  onChange,
}: {
  v: TextStyle;
  maxFontSize: number;
  sectioned?: boolean;
  /** Fields that differ between several texts. */
  mixed?: ReadonlySet<string>;
  onChange: (patch: TextPatch) => void;
}) {
  const tm = useT("maps");
  const m = (key: keyof TextStyle) => mixed.has(key);
  return (
    <>
      <Group id="text-font" title={tm("text.fontSize")} sectioned={sectioned}>
        <div className="grid-field">
          <span className="field-label">
            {tm("text.font")} <MixedTag show={m("fontKey") || m("bold")} />
          </span>
          <div className="text-panel-font-row">
            <FontPicker value={v.fontKey} bold={v.bold} mixed={m("fontKey")} onChange={(fontKey) => onChange({ fontKey })} />
            <button
              type="button"
              className={v.bold && !m("bold") ? "btn btn-icon active" : "btn btn-icon"}
              aria-pressed={m("bold") ? "mixed" : v.bold}
              aria-label={tm("text.bold")}
              data-tooltip={m("bold") ? tm("text.boldMixed") : tm("text.bold")}
              onClick={() => onChange({ bold: m("bold") ? true : !v.bold })}
            >
              <Bold size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        <SliderField label={tm("style.size")} value={Math.round(v.fontSize)} mixed={m("fontSize")} min={4} max={maxFontSize} defaultValue={Math.round(maxFontSize / 10)} suffix=" px" onChange={(fontSize) => onChange({ fontSize })} />
        <SliderField label={tm("text.rotation")} value={Math.round(v.rotation)} mixed={m("rotation")} min={-180} max={180} defaultValue={0} suffix="°" onChange={(rotation) => onChange({ rotation })} />
      </Group>

      <Group id="text-layout" title={tm("text.layout")} sectioned={sectioned}>
        <SliderField label={tm("text.curve")} value={v.curve} mixed={m("curve")} min={LIMITS.curve[0]} max={LIMITS.curve[1]} defaultValue={0} onChange={(curve) => onChange({ curve })} />
        <SliderField
          label={tm("text.letterSpacing")}
          value={v.letterSpacing}
          mixed={m("letterSpacing")}
          min={LIMITS.letterSpacing[0]}
          max={LIMITS.letterSpacing[1]}
          step={0.01}
          defaultValue={0}
          suffix=" em"
          onChange={(letterSpacing) => onChange({ letterSpacing })}
        />
        <div className="grid-field">
          <span className="field-label">
            {tm("text.alignment")} <MixedTag show={m("align")} />
          </span>
          <div className="text-panel-align" role="group" aria-label={tm("text.alignment")}>
            {ALIGNS.map(({ key, Icon }) => (
              <button key={key} type="button" className={!m("align") && v.align === key ? "btn btn-sm active" : "btn btn-sm"} aria-pressed={!m("align") && v.align === key} onClick={() => onChange({ align: key })}>
                <Icon size={14} strokeWidth={2.25} />
                {tm(`text.align.${key}`)}
              </button>
            ))}
          </div>
        </div>
      </Group>

      <Group id="text-color" title={tm("style.color")} sectioned={sectioned}>
        {m("color") && (
          <span className="field-label">
            {tm("style.color")} <MixedTag show />
          </span>
        )}
        <ColorWheel value={v.color} mixed={m("color")} onChange={(color) => onChange({ color })} />
      </Group>

      <Group id="text-outline" title={tm("zones.outline")} sectioned={sectioned}>
        <MixedCheckbox checked={v.outlineEnabled} mixed={m("outlineEnabled")} onChange={(outlineEnabled) => onChange({ outlineEnabled })}>
          <span className="field-label">{tm("zones.outline")}</span>
        </MixedCheckbox>
        {(v.outlineEnabled || m("outlineEnabled")) && (
          <>
            <span className="field-label">
              {tm("zones.outlineColor")} <MixedTag show={m("outlineColor")} />
            </span>
            <Swatches label={tm("zones.outlineColor")} value={v.outlineColor} mixed={m("outlineColor")} onChange={(outlineColor) => onChange({ outlineColor })} />
            <SliderField label={tm("zones.outlineOpacity")} value={Math.round(v.outlineOpacity * 100)} mixed={m("outlineOpacity")} min={0} max={100} defaultValue={80} suffix="%" onChange={(o) => onChange({ outlineOpacity: o / 100 })} />
            <SliderField
              label={tm("zones.outlineWidth")}
              value={v.outlineWidth}
              mixed={m("outlineWidth")}
              min={LIMITS.outlineWidth[0]}
              max={LIMITS.outlineWidth[1]}
              step={0.01}
              defaultValue={0.08}
              suffix=" em"
              onChange={(outlineWidth) => onChange({ outlineWidth })}
            />
          </>
        )}
      </Group>

      <Group id="text-shadow" title={tm("style.shadow")} sectioned={sectioned}>
        <MixedCheckbox checked={v.shadowEnabled} mixed={m("shadowEnabled")} onChange={(shadowEnabled) => onChange({ shadowEnabled })}>
          <span className="field-label">{tm("style.shadow")}</span>
        </MixedCheckbox>
        {(v.shadowEnabled || m("shadowEnabled")) && (
          <>
            <SliderField label={tm("text.shadowDirection")} value={Math.round(v.shadowAngle)} mixed={m("shadowAngle")} min={-180} max={180} defaultValue={45} suffix="°" onChange={(shadowAngle) => onChange({ shadowAngle })} />
            <SliderField
              label={tm("text.shadowDistance")}
              value={v.shadowDistance}
              mixed={m("shadowDistance")}
              min={LIMITS.shadowDistance[0]}
              max={LIMITS.shadowDistance[1]}
              step={0.01}
              defaultValue={0.08}
              suffix=" em"
              onChange={(shadowDistance) => onChange({ shadowDistance })}
            />
            <span className="field-label">
              {tm("style.shadowColor")} <MixedTag show={m("shadowColor")} />
            </span>
            <Swatches label={tm("style.shadowColor")} value={v.shadowColor} mixed={m("shadowColor")} onChange={(shadowColor) => onChange({ shadowColor })} />
            <SliderField label={tm("style.shadowOpacity")} value={Math.round(v.shadowOpacity * 100)} mixed={m("shadowOpacity")} min={0} max={100} defaultValue={60} suffix="%" onChange={(o) => onChange({ shadowOpacity: o / 100 })} />
          </>
        )}
      </Group>
    </>
  );
}

/**
 * The Text tool: placing, the active layer's folders of texts, and in the
 * right column the selected text's settings, a clicked folder's settings,
 * or the style of the next text.
 */
export default function TextPanel({
  layerName,
  selected,
  selectedLocked,
  draft,
  layers,
  placing,
  maxFontSize,
  texts,
  groups,
  activeLayerId,
  activeGroupId,
  onTogglePlacing,
  onChange,
  onDelete,
  onDone,
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
  onDeleteMany,
}: {
  /** Name of the active layer this tool edits. */
  layerName: string;
  selected: MapTextData | null;
  /** The selected text or its folder is locked. */
  selectedLocked: boolean;
  draft: TextDraft;
  layers: MapLayerData[];
  placing: boolean;
  maxFontSize: number;
  /** Texts on the active layer (home or shown here). */
  texts: MapTextData[];
  /** Every text folder of the map. */
  groups: MapFolderData[];
  activeLayerId: string;
  /** Where new texts go; null = Ungrouped. */
  activeGroupId: string | null;
  onTogglePlacing: () => void;
  onChange: (patch: TextPatch) => void;
  onDelete: () => void;
  onDone: () => void;
  onClose: () => void;
  onSetActiveGroup: (id: string | null) => void;
  onSelectText: (id: string | null) => void;
  onUpdateText: (id: string, patch: TextPatch) => void;
  onDeleteText: (id: string) => void;
  onCreateGroup: (name: string) => void;
  onUpdateGroup: (id: string, patch: FolderPatch) => void;
  onDeleteGroup: (id: string, cascade: boolean) => void;
  /** Every selected text (several: they're edited together). */
  selectedIds: string[];
  /** A click on a text in the list (Ctrl/Shift pick several); `order` is the list as shown. */
  onPick: (id: string, mods: ClickMods, order: string[]) => void;
  /** One edit of several texts (locked ones are skipped unless `includeLocked`). */
  onUpdateMany: (ids: string[], patchOf: (text: MapTextData) => TextPatch, opts?: { includeLocked?: boolean }) => void;
  onDeleteMany: (ids: string[]) => void;
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
  const multi = selectedIds.length > 1 ? texts.filter((t) => picked.has(t.id)) : [];
  const layerNameOf = (id: string | null) => layers.find((l) => l.id === id)?.name ?? tm("panel.anotherLayer");
  const groupOf = (t: MapTextData) => (t.groupId ? groups.find((g) => g.id === t.groupId) : undefined);
  const openFolder = ownGroups.find((g) => g.id === openFolderId) ?? null;

  const selectedFolderKey = selected ? (selected.layerId !== activeLayerId ? SHARED : (tree.folderOf(selected) ?? UNGROUPED)) : null;
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  if ((selected?.id ?? null) !== lastSelectedId) {
    setLastSelectedId(selected?.id ?? null);
    if (selectedFolderKey && !expanded.has(selectedFolderKey)) setExpanded((prev) => new Set(prev).add(selectedFolderKey));
  }

  const target = ownGroups.find((g) => g.id === activeGroupId) ?? null;
  const placeBlocked = Boolean(target && (target.locked || !target.visible));
  const [targetBefore, targetAfter] = tm("text.target").split("{folder}");
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
  const selectedFolderOptions = selected ? groups.filter((g) => g.layerId === selected.layerId).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const selectedGroup = selected ? groupOf(selected) : undefined;
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
    <div className="zones-panel zones-panel-editing text-panel">
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

        <button type="button" className={placing ? "btn btn-primary" : "btn"} onClick={onTogglePlacing} disabled={placeBlocked && !placing} data-tooltip={placeBlocked ? tm("panel.folderBlocked") : undefined}>
          <MousePointerClick size={15} strokeWidth={2.25} />
          {placing ? tm("text.placing") : tm("text.place")}
        </button>
        <p className="field-label zone-tool-hint">
          {selected
            ? tm("text.editingHint")
            : tm("text.idleHint")}
        </p>
        <p className="field-label line-panel-target">
          <FolderOpen size={13} strokeWidth={2.25} aria-hidden />
          {targetBefore}
          <strong>{target ? target.name : tm("panel.ungrouped")}</strong>
          {targetAfter}
          {target?.locked && tm("panel.targetLocked")}
          {target && !target.visible && tm("panel.targetHidden")}
        </p>

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
      </div>

      <div className="zones-panel-editor">
        {multi.length > 1 ? (
          <MultiTextEditor
            texts={multi}
            layers={layers}
            groups={groups}
            maxFontSize={maxFontSize}
            folderOf={(t) => (t.groupId && groups.some((g) => g.id === t.groupId) ? t.groupId : null)}
            isLocked={isLocked}
            onUpdateMany={(patchOf, opts) => onUpdateMany(selectedIds, patchOf, opts)}
            onDelete={() => onDeleteMany(selectedIds)}
            onDone={() => onSelectText(null)}
          />
        ) : selected ? (
          <>
            <div className="zone-editor-header">
              <Type size={14} strokeWidth={2.25} />
              <span className="line-panel-name">{textLabel(selected)}</span>
              <button type="button" className="btn btn-sm btn-primary zone-editor-done" onClick={onDone}>
                <Check size={13} strokeWidth={2.25} />
                {tc("done")}
              </button>
            </div>
            {selectedLocked && (
              <p className="field-label line-panel-locked">
                <Lock size={12} strokeWidth={2.25} aria-hidden /> {selectedGroup?.locked ? tm("text.lockedByFolder") : tm("text.locked")}
              </p>
            )}
            <fieldset className="line-panel-fieldset" disabled={selectedLocked}>
              <ToolSection id="text-content" title={tm("panel.text")}>
                <TextContentField sourceKey={selected.id} value={selected.text} onChange={(text) => onChange({ text })} />
              </ToolSection>
              <TextStyleFields v={selected} maxFontSize={maxFontSize} onChange={onChange} />
              <ToolSection id="text-layers" title={tm("panel.folderLayers")}>
                <FolderSelect
                  value={selectedGroup && selectedFolderOptions.includes(selectedGroup) ? selectedGroup.id : null}
                  folders={selectedFolderOptions}
                  noneLabel={tm("panel.ungrouped")}
                  onChange={(groupId) => onChange({ groupId })}
                />
                <LayerSelect value={selected.layerId} layers={layers} onChange={(layerId) => onChange({ layerId })} />
                <LayerChecklist
                  layers={layers}
                  homeLayerId={selected.layerId}
                  value={selected.extraLayerIds ?? []}
                  alwaysDrawFlag="textsAlwaysVisible"
                  inherited={selectedGroup ? { ids: selectedGroup.extraLayerIds, from: selectedGroup.name } : undefined}
                  onChange={(extraLayerIds) => onChange({ extraLayerIds })}
                />
              </ToolSection>
            </fieldset>
            <button type="button" className="btn btn-danger" onClick={onDelete} disabled={selectedLocked}>
              <Trash2 size={14} strokeWidth={2.25} />
              {tm("text.delete")}
            </button>
          </>
        ) : openFolder ? (
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
            renderStyle={(style, change) => <TextStyleFields v={{ ...draft, ...style } as TextStyle} maxFontSize={maxFontSize} sectioned={false} onChange={change} />}
            onUpdate={(patch) => onUpdateGroup(openFolder.id, patch)}
            onDelete={() => requestDelete(openFolder)}
            onDone={() => setOpenFolderId(null)}
          />
        ) : (
          <>
            <div className="zone-editor-header">
              <Type size={14} strokeWidth={2.25} />
              <span className="line-panel-name">{tm("text.next")}</span>
            </div>
            <p className="field-label zone-tool-hint">{tm("text.nextHint")}</p>
            <ToolSection id="text-content" title={tm("panel.text")}>
              <TextContentField sourceKey="draft" value={draft.text} onChange={(text) => onChange({ text })} />
            </ToolSection>
            {target?.defaultStyle ? (
              <>
                <p className="field-label zone-tool-hint">{tm("text.folderStyle", { name: target.name })}</p>
                <button type="button" className="btn btn-sm" onClick={() => setOpenFolderId(target.id)}>
                  <FolderOpen size={13} strokeWidth={2.25} />
                  {tm("panel.editFolderStyle")}
                </button>
              </>
            ) : (
              <TextStyleFields v={draft} maxFontSize={maxFontSize} onChange={onChange} />
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

/** Several texts' settings at once: a field shows its value when they agree, "Mixed" when not. */
function MultiTextEditor({
  texts,
  layers,
  groups,
  maxFontSize,
  folderOf,
  isLocked,
  onUpdateMany,
  onDelete,
  onDone,
}: {
  texts: MapTextData[];
  layers: MapLayerData[];
  groups: MapFolderData[];
  maxFontSize: number;
  folderOf: (text: MapTextData) => string | null;
  isLocked: (text: MapTextData) => boolean;
  onUpdateMany: (patchOf: (text: MapTextData) => TextPatch, opts?: { includeLocked?: boolean }) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const tm = useT("maps");
  const [first] = texts;
  const mixed = mixedKeys(texts);
  const layersOf = sharedLayers(texts.map((t) => t.extraLayerIds));
  const folders = new Set(texts.map(folderOf));
  const oneLayer = !mixed.has("layerId");
  const folderOptions = oneLayer ? groups.filter((g) => g.layerId === first.layerId).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const allVisible = texts.every((t) => t.visible);
  const allLocked = texts.every((t) => t.locked);
  const setAll = (patch: TextPatch) => onUpdateMany(() => patch);
  return (
    <>
      <MultiHeader
        Icon={Type}
        count={texts.length}
        noun="text"
        lockedCount={texts.filter(isLocked).length}
        allVisible={allVisible}
        allLocked={allLocked}
        onToggleVisible={() => onUpdateMany(() => ({ visible: !allVisible }), { includeLocked: true })}
        onToggleLocked={() => onUpdateMany(() => ({ locked: !allLocked }), { includeLocked: true })}
        onDelete={onDelete}
        onDone={onDone}
      />
      <ToolSection id="text-content" title={tm("panel.text")}>
        <TextContentField sourceKey={texts.map((t) => t.id).join(",")} value={first.text} mixed={mixed.has("text")} onChange={(text) => setAll({ text })} />
      </ToolSection>
      <TextStyleFields v={first} maxFontSize={maxFontSize} mixed={mixed} onChange={setAll} />
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
        <LayerChecklist
          layers={layers}
          homeLayerId={oneLayer ? first.layerId : null}
          value={layersOf.all}
          mixedIds={layersOf.some}
          alwaysDrawFlag="textsAlwaysVisible"
          onChange={() => undefined}
          onEdit={(add, remove) => onUpdateMany((t) => ({ extraLayerIds: editLayers(t.extraLayerIds, add, remove).filter((id) => id !== t.layerId) }))}
        />
      </ToolSection>
    </>
  );
}
