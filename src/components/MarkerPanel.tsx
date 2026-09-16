"use client";

import Link from "next/link";
import { useState } from "react";
import { X, Lock, Unlock, Copy, Check, ExternalLink, Trash2, Pencil, ChevronLeft } from "lucide-react";
import { RawIcon } from "./MarkerIcon";
import DescriptionSection from "./DescriptionSection";
import { ICONS, COLOR_PRESETS, BACKGROUND_SHAPES } from "@/server/markers/icon-registry";
import type { Marker } from "./MarkerLayer";

interface MapOption {
  id: string;
  name: string;
}

export default function MarkerPanel({
  marker,
  maps,
  autoFocusName,
  startInEdit,
  onUpdate,
  onDuplicate,
  onDelete,
  onClose,
}: {
  marker: Marker;
  maps: MapOption[];
  autoFocusName: boolean;
  startInEdit: boolean;
  onUpdate: (
    patch: Partial<
      Pick<
        Marker,
        | "name"
        | "iconKey"
        | "color"
        | "backgroundColor"
        | "outlineColor"
        | "backgroundShape"
        | "locked"
        | "linkedMapId"
        | "descriptionDocumentId"
      >
    >
  ) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  // Seeded once per marker — the parent remounts this component (via key={marker.id})
  // whenever the selected marker changes, so neither of these go stale across selections.
  const [name, setName] = useState(() => marker.name);
  const [editing, setEditing] = useState(startInEdit);
  const [copied, setCopied] = useState(false);

  // A right-click on an already-selected marker (see MarkerLayer's
  // contextmenu handler) asks for edit mode without changing which marker is
  // selected, so this component doesn't remount via its `key` — the initial
  // useState above only runs once, so a later startInEdit flip to true needs
  // to be caught here. Adjusting state during render (guarded by the
  // prevStartInEdit comparison) rather than in an effect, per React's own
  // guidance for deriving state from a changed prop.
  const [prevStartInEdit, setPrevStartInEdit] = useState(startInEdit);
  if (startInEdit !== prevStartInEdit) {
    setPrevStartInEdit(startInEdit);
    if (startInEdit) setEditing(true);
  }
  const category = ICONS.find((i) => i.key === marker.iconKey)?.group ?? "Adventure";
  const linkedMap = marker.linkedMapId ? maps.find((m) => m.id === marker.linkedMapId) : null;

  function copyLink() {
    const target = `${window.location.origin}${window.location.pathname}?marker=${marker.id}`;
    navigator.clipboard.writeText(target).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="marker-side-panel">
      <div className="marker-side-panel-header">
        {editing ? (
          <input
            type="text"
            value={name}
            aria-label="Marker name"
            autoFocus={autoFocusName}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== marker.name && onUpdate({ name })}
          />
        ) : (
          <h2>{marker.name}</h2>
        )}
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close marker panel">
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>

      <span className="field-label">Category: {category}</span>

      {editing && <h3 className="marker-section-title">Description</h3>}
      <DescriptionSection
        documentId={marker.descriptionDocumentId}
        editable={editing}
        onDocumentCreated={(id) => onUpdate({ descriptionDocumentId: id })}
      />

      {!editing && (
        <button className="btn btn-primary" onClick={() => setEditing(true)}>
          <Pencil size={14} strokeWidth={2.25} />
          Edit
        </button>
      )}

      {editing && (
        <>
          <h3 className="marker-section-title">Icons</h3>
          <div className="icon-grid">
            {ICONS.map((icon) => (
              <button
                key={icon.key}
                className={icon.key === marker.iconKey ? "active" : ""}
                title={icon.label}
                aria-label={icon.label}
                aria-pressed={icon.key === marker.iconKey}
                onClick={() => onUpdate({ iconKey: icon.key })}
              >
                <RawIcon iconKey={icon.key} size={16} />
              </button>
            ))}
          </div>

          <span className="field-label">Icon Color</span>
          <div className="color-swatch-row">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                className={color === marker.color ? "color-swatch active" : "color-swatch"}
                style={{ background: color }}
                onClick={() => onUpdate({ color })}
                aria-label={`Icon color ${color}`}
                aria-pressed={color === marker.color}
              />
            ))}
          </div>

          <label className="field-label" htmlFor="marker-background-shape">
            Background shape
          </label>
          <select
            id="marker-background-shape"
            value={marker.backgroundShape}
            onChange={(e) => onUpdate({ backgroundShape: e.target.value })}
          >
            {BACKGROUND_SHAPES.map((shape) => (
              <option key={shape.key} value={shape.key}>
                {shape.label}
              </option>
            ))}
          </select>

          {marker.backgroundShape !== "none" && (
            <>
              <span className="field-label">Background color</span>
              <div className="color-swatch-row">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    className={color === marker.backgroundColor ? "color-swatch active" : "color-swatch"}
                    style={{ background: color }}
                    onClick={() => onUpdate({ backgroundColor: color })}
                    aria-label={`Background color ${color}`}
                    aria-pressed={color === marker.backgroundColor}
                  />
                ))}
              </div>

              <span className="field-label">Outline color</span>
              <div className="color-swatch-row">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    className={color === marker.outlineColor ? "color-swatch active" : "color-swatch"}
                    style={{ background: color }}
                    onClick={() => onUpdate({ outlineColor: color })}
                    aria-label={`Outline color ${color}`}
                    aria-pressed={color === marker.outlineColor}
                  />
                ))}
              </div>
            </>
          )}

          <label className="field-label" htmlFor="marker-linked-map">
            Linked map
          </label>
          <select
            id="marker-linked-map"
            value={marker.linkedMapId ?? ""}
            onChange={(e) => onUpdate({ linkedMapId: e.target.value || null })}
          >
            <option value="">No linked map</option>
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <h3 className="marker-section-title">Actions</h3>
          <div className="marker-panel-actions">
            <button className="btn btn-sm" onClick={() => onUpdate({ locked: !marker.locked })}>
              {marker.locked ? <Unlock size={14} strokeWidth={2.25} /> : <Lock size={14} strokeWidth={2.25} />}
              {marker.locked ? "Unlock" : "Lock"}
            </button>
            <button className="btn btn-sm" onClick={onDuplicate}>
              <Copy size={14} strokeWidth={2.25} />
              Duplicate
            </button>
            <button className="btn btn-sm" onClick={copyLink}>
              {copied ? <Check size={14} strokeWidth={2.25} /> : <Copy size={14} strokeWidth={2.25} />}
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button className="btn btn-sm btn-danger" onClick={onDelete}>
              <Trash2 size={14} strokeWidth={2.25} />
              Delete
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => setEditing(false)}>
              <ChevronLeft size={14} strokeWidth={2.25} />
              Done
            </button>
          </div>
        </>
      )}

      {!editing && linkedMap && (
        <Link href={`/maps/${linkedMap.id}`} className="btn">
          <ExternalLink size={15} strokeWidth={2.25} />
          Open {linkedMap.name}
        </Link>
      )}
    </div>
  );
}
