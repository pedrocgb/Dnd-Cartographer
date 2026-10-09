"use client";

import ColorWheel from "./ColorWheel";
import { SliderField } from "./GridPanel";
import { MixedCheckbox, MixedTag, folderTree, type MapFolderData } from "./LayerFolders";
import type { MapLineData } from "./LineLayer";
import { LINE_LIMITS, type LineCap, type LineStyle, type LineStyleKind } from "@/server/lines/line-config";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";

/** A line's settings, shared by the Lines panel (a folder's default style) and the line bar. */

export type LinePatch = Partial<LineStyle & { layerId: string; extraLayerIds: string[]; name: string; visible: boolean; locked: boolean; groupId: string | null; sortOrder: number }>;

const NO_MIXED: ReadonlySet<string> = new Set();

export const STYLE_OPTIONS: LineStyleKind[] = ["solid", "dot", "dashed"];
const CAP_OPTIONS: LineCap[] = ["round", "square"];

/** A line's label in a list or bar: its name, or its place in its folder. */
export const lineLabel = (line: MapLineData, index: number) => line.name || activeT("maps")("lines.placeholderName", { n: index + 1 });

/** A line's label as the Lines panel lists it: unnamed ones are numbered within their folder. */
export function lineLabelIn(line: MapLineData, lines: MapLineData[], groups: MapFolderData[], activeLayerId: string): string {
  const tree = folderTree(lines, groups, activeLayerId);
  const list = line.layerId !== activeLayerId ? tree.shared : tree.itemsOf(tree.folderOf(line));
  return lineLabel(line, Math.max(0, list.findIndex((l) => l.id === line.id)));
}

type FieldsProps = { v: LineStyle; mixed?: ReadonlySet<string>; onChange: (patch: LinePatch) => void };

function Segmented<T extends string>({ label, value, options, mixed = false, onChange }: { label: string; value: T; options: { key: T; label: string }[]; mixed?: boolean; onChange: (v: T) => void }) {
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

/** Color and opacity. */
export function LineColorFields({ v, mixed = NO_MIXED, onChange }: FieldsProps) {
  const t = useT("maps");
  return (
    <>
      <span className="field-label">
        {t("style.color")} <MixedTag show={mixed.has("color")} />
      </span>
      <ColorWheel value={v.color} mixed={mixed.has("color")} onChange={(color) => onChange({ color })} />
      <SliderField label={t("style.opacity")} value={Math.round(v.opacity * 100)} mixed={mixed.has("opacity")} min={0} max={100} defaultValue={100} suffix="%" onChange={(o) => onChange({ opacity: o / 100 })} />
    </>
  );
}

export function LineWidthField({ v, maxWidth, mixed = NO_MIXED, onChange }: FieldsProps & { maxWidth: number }) {
  const t = useT("maps");
  return <SliderField label={t("style.size")} value={v.width} mixed={mixed.has("width")} min={0.5} max={maxWidth} step={0.5} defaultValue={Math.max(1, Math.round(maxWidth / 8))} suffix=" px" onChange={(width) => onChange({ width })} />;
}

/** Solid, dotted or dashed (with its dash and gap), and the cap. */
export function LineStrokeFields({ v, mixed = NO_MIXED, onChange }: FieldsProps) {
  const t = useT("maps");
  const m = (key: keyof LineStyle) => mixed.has(key);
  return (
    <>
      <Segmented label={t("lines.style")} value={v.style} mixed={m("style")} options={STYLE_OPTIONS.map((key) => ({ key, label: t(`lines.style.${key}`) }))} onChange={(style) => onChange({ style })} />
      {(v.style === "dashed" || m("style")) && (
        <SliderField label={t("lines.dashLength")} value={v.dashLength} mixed={m("dashLength")} min={LINE_LIMITS.dashLength[0]} max={LINE_LIMITS.dashLength[1]} step={0.1} defaultValue={3} suffix="×" onChange={(dashLength) => onChange({ dashLength })} />
      )}
      {(v.style !== "solid" || m("style")) && (
        <SliderField label={t("lines.gapLength")} value={v.gapLength} mixed={m("gapLength")} min={LINE_LIMITS.gapLength[0]} max={LINE_LIMITS.gapLength[1]} step={0.1} defaultValue={2} suffix="×" onChange={(gapLength) => onChange({ gapLength })} />
      )}
      <Segmented label={t("lines.cap")} value={v.cap} mixed={m("cap")} options={CAP_OPTIONS.map((key) => ({ key, label: t(`lines.cap.${key}`) }))} onChange={(cap) => onChange({ cap })} />
    </>
  );
}

export function LineShadowFields({ v, mixed = NO_MIXED, onChange }: FieldsProps) {
  const t = useT("maps");
  const m = (key: keyof LineStyle) => mixed.has(key);
  return (
    <>
      <MixedCheckbox checked={v.shadowEnabled} mixed={m("shadowEnabled")} onChange={(shadowEnabled) => onChange({ shadowEnabled })}>
        <span className="field-label">{t("style.shadow")}</span>
      </MixedCheckbox>
      {(v.shadowEnabled || m("shadowEnabled")) && (
        <>
          <span className="field-label">
            {t("style.shadowColor")} <MixedTag show={m("shadowColor")} />
          </span>
          <ColorWheel value={v.shadowColor} mixed={m("shadowColor")} onChange={(shadowColor) => onChange({ shadowColor })} />
          <SliderField label={t("style.shadowOpacity")} value={Math.round(v.shadowOpacity * 100)} mixed={m("shadowOpacity")} min={0} max={100} defaultValue={50} suffix="%" onChange={(o) => onChange({ shadowOpacity: o / 100 })} />
          <SliderField label={t("lines.shadowBlur")} value={v.shadowBlur} mixed={m("shadowBlur")} min={LINE_LIMITS.shadowBlur[0]} max={LINE_LIMITS.shadowBlur[1]} step={0.1} defaultValue={0.5} suffix="×" onChange={(shadowBlur) => onChange({ shadowBlur })} />
          <SliderField label={t("lines.shadowOffset")} value={v.shadowDistance} mixed={m("shadowDistance")} min={LINE_LIMITS.shadowDistance[0]} max={LINE_LIMITS.shadowDistance[1]} step={0.1} defaultValue={0.5} suffix="×" onChange={(shadowDistance) => onChange({ shadowDistance })} />
          <SliderField label={t("lines.shadowPosition")} value={Math.round(v.shadowAngle)} mixed={m("shadowAngle")} min={-180} max={180} defaultValue={45} suffix="°" onChange={(shadowAngle) => onChange({ shadowAngle })} />
        </>
      )}
    </>
  );
}

/** Every style field in one column: a folder's default style for its new lines. */
export function LineStyleFields({ v, maxWidth, onChange }: { v: LineStyle; maxWidth: number; onChange: (patch: LinePatch) => void }) {
  return (
    <>
      <LineColorFields v={v} onChange={onChange} />
      <LineWidthField v={v} maxWidth={maxWidth} onChange={onChange} />
      <LineStrokeFields v={v} onChange={onChange} />
      <LineShadowFields v={v} onChange={onChange} />
    </>
  );
}
