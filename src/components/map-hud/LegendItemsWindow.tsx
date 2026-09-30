"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Bold, ChevronLeft, ChevronRight, GripVertical, ImageUp, Italic, LayoutList, Plus, Strikethrough, Trash2 } from "lucide-react";
import IconPicker from "@/components/IconPicker";
import SegmentedControl from "@/components/marker-panel/SegmentedControl";
import { newId } from "@/components/calendars/api";
import { isAcceptedImage, uploadArticleImage } from "@/components/rich-editor/images";
import { COLOR_PRESETS } from "@/server/markers/icon-registry";
import { DEFAULT_ITEM_ICON, LEGEND_LIMITS, type LegendImage, type LegendItem } from "@/server/legends/legend-config";
import { LegendSwatch, LegendText, moveItem } from "./MapLegend";

type IconImage = Extract<LegendImage, { kind: "icon" }>;

function ColorSwatches({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <div className="legend-field">
      <span className="field-label">{label}</span>
      <div className="legend-colors-row" role="radiogroup" aria-label={label}>
        {COLOR_PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={hex.toUpperCase() === value.toUpperCase()}
            aria-label={hex}
            data-tooltip={hex}
            className={hex.toUpperCase() === value.toUpperCase() ? "legend-color active" : "legend-color"}
            style={{ background: hex }}
            onClick={() => onChange(hex)}
          />
        ))}
      </div>
    </div>
  );
}

/** Click or drop a PNG/JPEG/WebP; it becomes the item's rectangle, cropped to fill it. */
function UploadField({ image, onChange }: { image: LegendImage; onChange: (image: LegendImage) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!isAcceptedImage(file)) return setError("Use a PNG, JPEG or WebP image.");
    setUploading(true);
    setError(null);
    try {
      onChange({ kind: "upload", src: await uploadArticleImage(file) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={over ? "legend-dropzone over" : "legend-dropzone"}
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void upload(file);
        }}
      >
        {image.kind === "upload" ? <LegendSwatch image={image} size="large" /> : <ImageUp size={22} strokeWidth={1.75} aria-hidden />}
        <span>{uploading ? "Uploading…" : image.kind === "upload" ? "Replace the image" : "Click or drop an image"}</span>
        <span className="field-label">PNG, JPEG or WebP · cropped to a small rectangle</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      {error && <p className="form-error">{error}</p>}
    </>
  );
}

/** One item's editor: live preview, label with its text style, and its image (icon or upload). */
function ItemEditor({
  item,
  index,
  count,
  onChange,
  onDelete,
  onBack,
  onStep,
}: {
  item: LegendItem;
  index: number;
  count: number;
  onChange: (patch: Partial<LegendItem>) => void;
  onDelete: () => void;
  onBack: () => void;
  onStep: (delta: -1 | 1) => void;
}) {
  // The icon kept while trying an upload, so switching back restores it.
  const [lastIcon, setLastIcon] = useState<IconImage>(item.image.kind === "icon" ? item.image : (DEFAULT_ITEM_ICON as IconImage));
  const [source, setSource] = useState<"icon" | "upload">(item.image.kind);
  const icon = item.image.kind === "icon" ? item.image : lastIcon;
  const setIcon = (next: IconImage) => {
    setLastIcon(next);
    onChange({ image: next });
  };
  const styleButton = (key: "bold" | "italic" | "strike", label: string, Icon: typeof Bold) => (
    <button type="button" className={item[key] ? "active" : ""} aria-label={label} aria-pressed={item[key]} data-tooltip={label} onClick={() => onChange({ [key]: !item[key] })}>
      <Icon size={14} strokeWidth={2.5} />
    </button>
  );

  return (
    <div className="legend-editor">
      <div className="legend-editor-nav">
        <button type="button" className="btn btn-sm btn-ghost" onClick={onBack}>
          <ArrowLeft size={14} strokeWidth={2.25} />
          All items
        </button>
        <span className="legend-editor-count">
          <button type="button" className="btn btn-ghost btn-icon-xs" disabled={index === 0} aria-label="Previous item" data-tooltip="Previous item" onClick={() => onStep(-1)}>
            <ChevronLeft size={14} strokeWidth={2.25} />
          </button>
          {index + 1} / {count}
          <button type="button" className="btn btn-ghost btn-icon-xs" disabled={index === count - 1} aria-label="Next item" data-tooltip="Next item" onClick={() => onStep(1)}>
            <ChevronRight size={14} strokeWidth={2.25} />
          </button>
        </span>
      </div>

      <div className="legend-preview" aria-label="Preview">
        <LegendSwatch image={item.image} size="large" />
        {item.text ? <LegendText item={item} /> : <span className="field-label">Your label</span>}
      </div>

      <div className="legend-field">
        <label className="field-label" htmlFor={`legend-text-${item.id}`}>
          Label
        </label>
        <div className="legend-label-row">
          <input
            id={`legend-text-${item.id}`}
            type="text"
            autoFocus
            placeholder="e.g. Capital city"
            value={item.text}
            maxLength={LEGEND_LIMITS.text}
            onChange={(e) => onChange({ text: e.target.value })}
          />
          <div className="legend-format" role="group" aria-label="Text style">
            {styleButton("bold", "Bold", Bold)}
            {styleButton("italic", "Italic", Italic)}
            {styleButton("strike", "Strikethrough", Strikethrough)}
          </div>
        </div>
      </div>

      <div className="legend-field">
        <span className="field-label">Image</span>
        <SegmentedControl
          ariaLabel="Image source"
          value={source}
          segments={[
            { key: "icon", label: "Icon" },
            { key: "upload", label: "Upload image" },
          ]}
          onChange={(key) => {
            setSource(key);
            if (key === "icon" && item.image.kind !== "icon") onChange({ image: lastIcon });
          }}
        />
      </div>
      {source === "icon" ? (
        <>
          <ColorSwatches label="Background" value={icon.fill} onChange={(fill) => setIcon({ ...icon, fill })} />
          <ColorSwatches label="Icon color" value={icon.color} onChange={(color) => setIcon({ ...icon, color })} />
          <div className="legend-field legend-icon-picker">
            <span className="field-label">Icon</span>
            <IconPicker value={icon.key} onChange={(key) => setIcon({ ...icon, key })} />
          </div>
        </>
      ) : (
        <UploadField image={item.image} onChange={(image) => onChange({ image })} />
      )}

      <button type="button" className="btn btn-sm btn-ghost legend-delete" onClick={onDelete}>
        <Trash2 size={14} strokeWidth={2.25} />
        Delete this item
      </button>
    </div>
  );
}

/**
 * The Legend tool's Items window (right of its settings): the list of
 * items — drag the grip (or Alt+↑/↓) to reorder, click one to edit it —
 * and, once picked, that item's editor.
 */
export default function LegendItemsWindow({
  items,
  selectedItemId,
  onSelectItem,
  onChangeItems,
}: {
  items: LegendItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onChangeItems: (items: LegendItem[]) => void;
}) {
  const [drag, setDrag] = useState<{ id: string; overId: string | null; after: boolean } | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const selectedIndex = items.findIndex((i) => i.id === selectedItemId);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;
  const full = items.length >= LEGEND_LIMITS.items;

  function addItem() {
    const item: LegendItem = { id: newId("item"), image: DEFAULT_ITEM_ICON, text: "", bold: false, italic: false, strike: false };
    onChangeItems([...items, item]);
    onSelectItem(item.id);
  }

  if (selected) {
    return (
      <ItemEditor
        key={selected.id}
        item={selected}
        index={selectedIndex}
        count={items.length}
        onChange={(patch) => onChangeItems(items.map((i) => (i.id === selected.id ? { ...i, ...patch } : i)))}
        onDelete={() => {
          onChangeItems(items.filter((i) => i.id !== selected.id));
          onSelectItem(null);
        }}
        onBack={() => onSelectItem(null)}
        onStep={(delta) => onSelectItem(items[selectedIndex + delta]?.id ?? selected.id)}
      />
    );
  }

  return (
    <div className="legend-items">
      <div className="legend-items-header">
        <h3>
          Items <span className="legend-items-count">{items.length}</span>
        </h3>
        <button type="button" className="btn btn-sm btn-primary" disabled={full} onClick={addItem}>
          <Plus size={14} strokeWidth={2.25} />
          Add item
        </button>
      </div>

      {items.length === 0 ? (
        <div className="legend-items-empty">
          <LayoutList size={28} strokeWidth={1.5} aria-hidden />
          <p>No items yet</p>
          <p className="field-label">Each item pairs a small image (an icon or your own picture) with a short label, e.g. a castle for &ldquo;Capital&rdquo;.</p>
          <button type="button" className="btn btn-sm" onClick={addItem}>
            <Plus size={14} strokeWidth={2.25} />
            Add the first item
          </button>
        </div>
      ) : (
        <>
          <p className="field-label">Click an item to edit it. Drag the grip — here or on the map — to reorder.</p>
          <ul className="legend-item-list">
            {items.map((item, index) => {
              const drop = drag?.overId === item.id && drag.id !== item.id ? (drag.after ? " drop-below" : " drop-above") : "";
              return (
                <li
                  key={item.id}
                  className={`legend-item-card${drag?.id === item.id ? " dragged" : ""}${drop}`}
                  draggable={armedId === item.id}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", item.id);
                    setDrag({ id: item.id, overId: null, after: false });
                  }}
                  onDragOver={(e) => {
                    if (!drag) return;
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const after = e.clientY > rect.top + rect.height / 2;
                    if (drag.overId !== item.id || drag.after !== after) setDrag({ ...drag, overId: item.id, after });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (drag?.overId) onChangeItems(moveItem(items, drag.id, drag.overId, drag.after));
                    setDrag(null);
                  }}
                  onDragEnd={() => {
                    setDrag(null);
                    setArmedId(null);
                  }}
                >
                  <span
                    className="legend-item-grip"
                    aria-hidden
                    data-tooltip="Drag to reorder"
                    onPointerDown={() => setArmedId(item.id)}
                    onPointerUp={() => setArmedId(null)}
                  >
                    <GripVertical size={14} strokeWidth={2.25} />
                  </span>
                  <button
                    type="button"
                    className="legend-item-open"
                    aria-label={`Edit ${item.text || "untitled item"} (Alt+↑/↓ to reorder)`}
                    onClick={() => onSelectItem(item.id)}
                    onKeyDown={(e) => {
                      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                      e.preventDefault();
                      const target = items[index + (e.key === "ArrowUp" ? -1 : 1)];
                      if (target) onChangeItems(moveItem(items, item.id, target.id, e.key === "ArrowDown"));
                    }}
                  >
                    <LegendSwatch image={item.image} size="medium" />
                    {item.text ? <LegendText item={item} /> : <span className="legend-item-untitled">No label</span>}
                    <ChevronRight size={14} strokeWidth={2.25} aria-hidden className="legend-item-chevron" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
