"use client";

import Link from "next/link";
import { useState } from "react";
import { X, Lock, Unlock, Copy, Check, ExternalLink, Trash2, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { RawIcon } from "./MarkerIcon";
import DescriptionSection from "./DescriptionSection";
import { ICONS, COLOR_PRESETS, BACKGROUND_SHAPES, MARKER_CATEGORIES, DEFAULT_MARKER_CATEGORY } from "@/server/markers/icon-registry";
import { STATUS_TAGS, ENVIRONMENT_TAGS, OWNERSHIP_TAGS } from "@/server/markers/tag-registry";
import type { Marker } from "./MarkerLayer";
import PoliticalReferencesPanel from "./PoliticalReferencesPanel";
import MarkerLinksPanel from "./MarkerLinksPanel";

export type MarkerSection = "basic" | "politics" | "links";

interface MapOption {
  id: string;
  name: string;
}

/** A collapsible settings block — collapsed by default, expanding on click
 * with the arrow rotating from pointing right to pointing down. Used for
 * every editable marker setting except the name (always shown, no arrow).
 *
 * The body is always mounted and merely hidden via CSS when collapsed
 * (never conditionally rendered) — conditionally rendering it would
 * unmount/remount its children (e.g. Description's RichEditor) every time
 * the section toggles, which for a stateful child means: a fresh mount
 * refetches from scratch, briefly shows empty content, and can race with
 * autosave into overwriting real data with that empty draft. Confirmed as
 * a real, reported bug — not a theoretical concern.
 *
 * `forceOpen`, when set, pins the section open/closed and hides the
 * header entirely (used for Description in view mode, which must always
 * be visible with no arrow at all, while still reusing the exact same
 * wrapper/child position as the editable, collapsible version). */
function CollapsibleSection({
  title,
  children,
  forceOpen,
}: {
  title: string;
  children: React.ReactNode;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen ?? open;
  return (
    <div className={forceOpen !== undefined ? "marker-collapsible marker-collapsible-noheader" : "marker-collapsible"}>
      {forceOpen === undefined && (
        <button
          type="button"
          className="marker-collapsible-header"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <ChevronRight size={14} strokeWidth={2.25} className={isOpen ? "marker-collapsible-chevron open" : "marker-collapsible-chevron"} />
          <span className="field-label">{title}</span>
        </button>
      )}
      <div
        className={[
          "marker-collapsible-body",
          forceOpen !== undefined && "marker-collapsible-body-noheader",
          !isOpen && "marker-collapsible-body-hidden",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

export default function MarkerPanel({
  marker,
  maps,
  section,
  autoFocusName,
  startInEdit,
  onUpdate,
  onDuplicate,
  onDelete,
  onClose,
}: {
  marker: Marker;
  maps: MapOption[];
  section: MarkerSection;
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
        | "category"
        | "locked"
        | "linkedMapId"
        | "descriptionDocumentId"
        | "statusTags"
        | "environment"
        | "ownership"
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
  const category = marker.category ?? DEFAULT_MARKER_CATEGORY;
  const linkedMap = marker.linkedMapId ? maps.find((m) => m.id === marker.linkedMapId) : null;

  function toggleStatus(tag: string) {
    const next = marker.statusTags.includes(tag)
      ? marker.statusTags.filter((t) => t !== tag)
      : [...marker.statusTags, tag];
    onUpdate({ statusTags: next });
  }

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

      {/* All three sections stay mounted and are only hidden via CSS when
          inactive — never conditionally rendered — for the same reason
          CollapsibleSection's body does: an unmount/remount would drop
          Basic Information's in-progress edits (name draft, editing mode)
          and would refetch Politics/Links from scratch on every switch. */}
      <div className={section === "basic" ? "marker-section-body" : "marker-section-body marker-section-body-hidden"}>
      <div className="marker-tag-summary">
        <span>Category: {category}</span>
        {marker.environment && <span>Environment: {marker.environment}</span>}
        {marker.ownership && <span>Ownership: {marker.ownership}</span>}
        {marker.statusTags.length > 0 && <span>Status: {marker.statusTags.join(", ")}</span>}
      </div>

      <CollapsibleSection title="Description" forceOpen={editing ? undefined : true}>
        <DescriptionSection
          documentId={marker.descriptionDocumentId}
          editable={editing}
          onDocumentCreated={(id) => onUpdate({ descriptionDocumentId: id })}
        />
      </CollapsibleSection>

      {editing && (
        <>
          <CollapsibleSection title="Icons">
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
          </CollapsibleSection>

          <CollapsibleSection title="Icon Color">
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
          </CollapsibleSection>

          <CollapsibleSection title="Background shape">
            <select
              aria-label="Background shape"
              value={marker.backgroundShape}
              onChange={(e) => onUpdate({ backgroundShape: e.target.value })}
            >
              {BACKGROUND_SHAPES.map((shape) => (
                <option key={shape.key} value={shape.key}>
                  {shape.label}
                </option>
              ))}
            </select>
          </CollapsibleSection>

          {marker.backgroundShape !== "none" && (
            <>
              <CollapsibleSection title="Background color">
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
              </CollapsibleSection>

              <CollapsibleSection title="Outline color">
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
              </CollapsibleSection>
            </>
          )}

          <CollapsibleSection title="Category">
            <select aria-label="Category" value={category} onChange={(e) => onUpdate({ category: e.target.value })}>
              {/* Covers a category value saved under an older category list —
                  shown as-is instead of silently jumping to some other option. */}
              {!(MARKER_CATEGORIES as readonly string[]).includes(category) && (
                <option value={category}>{category}</option>
              )}
              {MARKER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </CollapsibleSection>

          <CollapsibleSection title="Status">
            <div className="tag-toggle-grid">
              {STATUS_TAGS.map((tag) => (
                <button
                  key={tag}
                  className={marker.statusTags.includes(tag) ? "tag-toggle active" : "tag-toggle"}
                  aria-pressed={marker.statusTags.includes(tag)}
                  onClick={() => toggleStatus(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Environment">
            <select
              aria-label="Environment"
              value={marker.environment ?? ""}
              onChange={(e) => onUpdate({ environment: e.target.value || null })}
            >
              <option value="">None</option>
              {ENVIRONMENT_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </CollapsibleSection>

          <CollapsibleSection title="Ownership">
            <select
              aria-label="Ownership"
              value={marker.ownership ?? ""}
              onChange={(e) => onUpdate({ ownership: e.target.value || null })}
            >
              <option value="">None</option>
              {OWNERSHIP_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </CollapsibleSection>

          <CollapsibleSection title="Linked map">
            <select
              aria-label="Linked map"
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
          </CollapsibleSection>

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

      {!editing && (
        <button className="btn btn-primary marker-edit-fab" onClick={() => setEditing(true)}>
          <Pencil size={14} strokeWidth={2.25} />
          Edit
        </button>
      )}
      </div>

      <div className={section === "politics" ? "marker-section-body" : "marker-section-body marker-section-body-hidden"}>
        <PoliticalReferencesPanel markerId={marker.id} active={section === "politics"} />
      </div>

      <div className={section === "links" ? "marker-section-body" : "marker-section-body marker-section-body-hidden"}>
        <MarkerLinksPanel markerId={marker.id} active={section === "links"} />
      </div>
    </div>
  );
}
