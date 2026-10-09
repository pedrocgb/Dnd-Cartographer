"use client";

import { useEffect, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold } from "lucide-react";
import ColorWheel from "./ColorWheel";
import FontPicker from "./FontPicker";
import { SliderField } from "./SliderField";
import { MixedCheckbox, MixedTag } from "./LayerFolders";
import type { MapTextData } from "./TextLayer";
import { LIMITS, type TextAlign, type TextStyle } from "@/server/texts/text-config";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";

/** A text's settings, shared by the Text panel (a folder's default style) and the text bar. */

export type TextDraft = TextStyle & { text: string };
export type TextPatch = Partial<TextDraft & { layerId: string; extraLayerIds: string[]; visible: boolean; locked: boolean; groupId: string | null; sortOrder: number }>;

const LABEL_MAX = 40;
const NO_MIXED: ReadonlySet<string> = new Set();

/** A text's label in a list or bar: its first line, shortened. */
export const textLabel = (t: MapTextData) => {
  const first = t.text.split("\n")[0].trim() || activeT("maps")("panel.text");
  return first.length > LABEL_MAX ? `${first.slice(0, LABEL_MAX - 1)}…` : first;
};

export const ALIGNS: { key: TextAlign; Icon: typeof AlignLeft }[] = [
  { key: "left", Icon: AlignLeft },
  { key: "center", Icon: AlignCenter },
  { key: "right", Icon: AlignRight },
];

type FieldsProps = { v: TextStyle; mixed?: ReadonlySet<string>; onChange: (patch: TextPatch) => void };

/**
 * The text's content. Kept locally: an empty text is never saved (the
 * server rejects it), but the field can still be cleared while typing.
 */
export function TextContentField({ sourceKey, value, mixed = false, autoFocus, onChange }: { sourceKey: string; value: string; /** Several texts that say different things: typing replaces them all. */ mixed?: boolean; autoFocus?: boolean; onChange: (text: string) => void }) {
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
        autoFocus={autoFocus}
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

export function TextSizeField({ v, maxFontSize, mixed = NO_MIXED, onChange }: FieldsProps & { maxFontSize: number }) {
  const tm = useT("maps");
  return <SliderField label={tm("style.size")} value={Math.round(v.fontSize)} mixed={mixed.has("fontSize")} min={4} max={maxFontSize} defaultValue={Math.round(maxFontSize / 10)} suffix=" px" onChange={(fontSize) => onChange({ fontSize })} />;
}

export function TextRotationField({ v, mixed = NO_MIXED, onChange }: FieldsProps) {
  const tm = useT("maps");
  return <SliderField label={tm("text.rotation")} value={Math.round(v.rotation)} mixed={mixed.has("rotation")} min={-180} max={180} defaultValue={0} suffix="°" onChange={(rotation) => onChange({ rotation })} />;
}

export function TextAlignField({ v, mixed = NO_MIXED, onChange }: FieldsProps) {
  const tm = useT("maps");
  const m = mixed.has("align");
  return (
    <div className="grid-field">
      <span className="field-label">
        {tm("text.alignment")} <MixedTag show={m} />
      </span>
      <div className="text-panel-align" role="group" aria-label={tm("text.alignment")}>
        {ALIGNS.map(({ key, Icon }) => (
          <button key={key} type="button" className={!m && v.align === key ? "btn btn-sm active" : "btn btn-sm"} aria-pressed={!m && v.align === key} onClick={() => onChange({ align: key })}>
            <Icon size={14} strokeWidth={2.25} />
            {tm(`text.align.${key}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TextColorField({ v, mixed = NO_MIXED, onChange }: FieldsProps) {
  const tm = useT("maps");
  return (
    <>
      <span className="field-label">
        {tm("style.color")} <MixedTag show={mixed.has("color")} />
      </span>
      <ColorWheel value={v.color} mixed={mixed.has("color")} onChange={(color) => onChange({ color })} />
    </>
  );
}

/** Curve and letter spacing. */
export function TextLayoutFields({ v, mixed = NO_MIXED, onChange }: FieldsProps) {
  const tm = useT("maps");
  return (
    <>
      <SliderField label={tm("text.curve")} value={v.curve} mixed={mixed.has("curve")} min={LIMITS.curve[0]} max={LIMITS.curve[1]} defaultValue={0} onChange={(curve) => onChange({ curve })} />
      <SliderField
        label={tm("text.letterSpacing")}
        value={v.letterSpacing}
        mixed={mixed.has("letterSpacing")}
        min={LIMITS.letterSpacing[0]}
        max={LIMITS.letterSpacing[1]}
        step={0.01}
        defaultValue={0}
        suffix=" em"
        onChange={(letterSpacing) => onChange({ letterSpacing })}
      />
    </>
  );
}

export function TextOutlineFields({ v, mixed = NO_MIXED, onChange }: FieldsProps) {
  const tm = useT("maps");
  const m = (key: keyof TextStyle) => mixed.has(key);
  return (
    <>
      <MixedCheckbox checked={v.outlineEnabled} mixed={m("outlineEnabled")} onChange={(outlineEnabled) => onChange({ outlineEnabled })}>
        <span className="field-label">{tm("zones.outline")}</span>
      </MixedCheckbox>
      {(v.outlineEnabled || m("outlineEnabled")) && (
        <>
          <span className="field-label">
            {tm("zones.outlineColor")} <MixedTag show={m("outlineColor")} />
          </span>
          <ColorWheel value={v.outlineColor} mixed={m("outlineColor")} onChange={(outlineColor) => onChange({ outlineColor })} />
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
    </>
  );
}

export function TextShadowFields({ v, mixed = NO_MIXED, onChange }: FieldsProps) {
  const tm = useT("maps");
  const m = (key: keyof TextStyle) => mixed.has(key);
  return (
    <>
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
          <ColorWheel value={v.shadowColor} mixed={m("shadowColor")} onChange={(shadowColor) => onChange({ shadowColor })} />
          <SliderField label={tm("style.shadowOpacity")} value={Math.round(v.shadowOpacity * 100)} mixed={m("shadowOpacity")} min={0} max={100} defaultValue={60} suffix="%" onChange={(o) => onChange({ shadowOpacity: o / 100 })} />
        </>
      )}
    </>
  );
}

/** Font (a dropdown) and bold. */
function TextFontField({ v, mixed = NO_MIXED, onChange }: FieldsProps) {
  const tm = useT("maps");
  const m = (key: keyof TextStyle) => mixed.has(key);
  return (
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
  );
}

/** Every style field in one column: a folder's default style for its new texts. */
export function TextStyleFields({ v, maxFontSize, onChange }: { v: TextStyle; maxFontSize: number; onChange: (patch: TextPatch) => void }) {
  return (
    <>
      <TextFontField v={v} onChange={onChange} />
      <TextSizeField v={v} maxFontSize={maxFontSize} onChange={onChange} />
      <TextRotationField v={v} onChange={onChange} />
      <TextLayoutFields v={v} onChange={onChange} />
      <TextAlignField v={v} onChange={onChange} />
      <TextColorField v={v} onChange={onChange} />
      <TextOutlineFields v={v} onChange={onChange} />
      <TextShadowFields v={v} onChange={onChange} />
    </>
  );
}
