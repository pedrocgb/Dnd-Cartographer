"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowDownWideNarrow,
  ChevronDown,
  ChevronRight,
  CircleQuestionMark,
  ExternalLink,
  EyeOff,
  GripVertical,
  Maximize2,
  Plus,
  Search,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  MAX_INFO_TEXT_LENGTH,
  isListField,
  type InfoField,
  type InfoFieldKind,
  type InfoFieldSet,
  type InfoLinkTarget,
  type InfoValue,
  type InfoValues,
} from "@/server/articles/info-fields";
import { TEMPLATE_LABELS } from "@/server/articles/templates";
import InfoPicker, { type PickerOption } from "./InfoPicker";
import type { OpenArticle } from "./types";

/** Articles a link field can point at, by template. */
export type InfoLookups = Partial<Record<InfoLinkTarget, { id: string; name: string }[]>>;

/** Native selects get a search box once they reach this many options. */
const SEARCHABLE_SELECT_MIN = 10;

/** Values longer than this many lines (text) or items (lists) start collapsed. */
const COLLAPSE_AFTER = 3;

const KIND: Record<InfoFieldKind, { Icon: LucideIcon; hint: string }> = {
  text: { Icon: Type, hint: "Text" },
  select: { Icon: ArrowDownWideNarrow, hint: "Dropdown" },
  link: { Icon: ExternalLink, hint: "Link" },
};

const isEmpty = (v: InfoValue | undefined) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

/** Where a linked id lives: the first of the field's target templates that has it. */
export function findLinked(targets: readonly InfoLinkTarget[], lookups: InfoLookups, id: string) {
  for (const target of targets) {
    const item = lookups[target]?.find((x) => x.id === id);
    if (item) return { target, item };
  }
  return null;
}

/** A link field's pickable articles, alphabetical within each target template. */
function linkOptions(targets: readonly InfoLinkTarget[], lookups: InfoLookups): PickerOption[] {
  return targets.flatMap((target) =>
    [...(lookups[target] ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((x) => ({ value: x.id, label: x.name, group: TEMPLATE_LABELS[target] }))
  );
}

/** The set's fields present in `values`, in the values' key order (the user's order). */
function fieldsInOrder(set: InfoFieldSet, values: InfoValues): InfoField[] {
  return Object.keys(values).flatMap((key) => set.fields.find((f) => f.key === key) ?? []);
}

/** `order` with `key` moved to `target`'s position. */
function moveKey(order: string[], key: string, target: string): string[] {
  const rest = order.filter((k) => k !== key);
  const at = order.indexOf(target);
  rest.splice(at, 0, key);
  return rest;
}

/** A read-only Info Bar row, for template-specific lines around the fields. */
export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="info-row">
      <dt title={label}>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The subtle show more / show less toggle under a collapsed value. */
function ExpandToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const label = expanded ? "Show less" : "Show more";
  return (
    <button type="button" className="info-expand" onClick={onToggle} aria-expanded={expanded} aria-label={label} title={label}>
      {expanded ? <EyeOff size={12} strokeWidth={2.25} /> : <Maximize2 size={12} strokeWidth={2.25} />}
    </button>
  );
}

/** Text clamped to COLLAPSE_AFTER lines (with an ellipsis); the toggle appears only when it overflows. */
function ClampedText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    // Re-measured on resize: a narrower Info Bar can push text past the clamp.
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <span className="info-value">
      <span ref={ref} className={expanded ? "info-text" : "info-text clamped"}>
        {text}
      </span>
      {(overflows || expanded) && <ExpandToggle expanded={expanded} onToggle={() => setExpanded((e) => !e)} />}
    </span>
  );
}

/** A list showing its first COLLAPSE_AFTER items (then "…") when it has more than that. */
function CollapsedList({ items }: { items: React.ReactNode[] }) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = items.length > COLLAPSE_AFTER;
  const shown = collapsible && !expanded ? items.slice(0, COLLAPSE_AFTER) : items;
  return (
    <span className="info-value">
      <span className="info-links">
        {shown}
        {collapsible && !expanded && (
          <span className="info-more" aria-label={`${items.length - COLLAPSE_AFTER} more`}>
            …
          </span>
        )}
      </span>
      {collapsible && <ExpandToggle expanded={expanded} onToggle={() => setExpanded((e) => !e)} />}
    </span>
  );
}

/**
 * Read mode: every added field as "Label: value", after any `leading` rows
 * and before any `extra` rows. Link values open their article; long text and
 * long lists start collapsed.
 */
export function InfoView({
  set,
  values,
  lookups,
  onOpenArticle,
  leading,
  extra,
}: {
  set: InfoFieldSet;
  values: InfoValues;
  lookups: InfoLookups;
  onOpenArticle: OpenArticle;
  /** Read-only rows before the fields (e.g. a territory's type and parent). */
  leading?: React.ReactNode;
  /** Read-only rows after the fields (e.g. authorities). */
  extra?: React.ReactNode;
}) {
  const fields = fieldsInOrder(set, values);

  function linkButton(targets: readonly InfoLinkTarget[], id: string) {
    const found = findLinked(targets, lookups, id);
    if (!found) {
      return (
        <span key={id} className="field-label">
          (removed)
        </span>
      );
    }
    return (
      <button key={id} type="button" className="politics-link-button" onClick={() => onOpenArticle(found.target, id)}>
        {found.item.name}
      </button>
    );
  }

  if (fields.length === 0 && !leading && !extra) return <p className="article-card-placeholder">No information yet. Use Edit to add some.</p>;

  return (
    <dl className="info-list">
      {leading}
      {fields.map((field) => {
        const value = values[field.key];
        let shown: React.ReactNode;
        if (isEmpty(value)) shown = <span className="field-label">—</span>;
        else if (field.kind === "link" && field.link) {
          const ids = Array.isArray(value) ? value : [value as string];
          shown = <CollapsedList items={ids.map((id) => linkButton(field.link!.targets, id))} />;
        } else if (Array.isArray(value)) {
          shown = <CollapsedList items={value.map((v, i) => <span key={v}>{i < value.length - 1 ? `${v},` : v}</span>)} />;
        } else shown = <ClampedText text={String(value)} />;
        return (
          <InfoRow key={field.key} label={field.label}>
            {shown}
          </InfoRow>
        );
      })}
      {extra}
    </dl>
  );
}

/**
 * The "Add more information" popover: fields not added yet, in collapsible
 * groups, with a search box. ↑/↓ move, Enter adds, Esc closes.
 */
function InfoFieldMenu({
  set,
  available,
  onPick,
  onClose,
}: {
  set: InfoFieldSet;
  available: InfoField[];
  onPick: (field: InfoField) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const needle = query.trim().toLowerCase();

  const groups = set.groups
    .map((g) => ({
      ...g,
      fields: available.filter((f) => f.group === g.key && (!needle || f.label.toLowerCase().includes(needle))),
    }))
    .filter((g) => g.fields.length > 0);
  // Searching shows every match; otherwise only expanded groups' fields are reachable.
  const isOpen = (key: string) => Boolean(needle) || open.has(key);
  const visible = groups.flatMap((g) => (isOpen(g.key) ? g.fields : []));
  const activeIndex = Math.min(active, Math.max(0, visible.length - 1));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, visible.length]);

  function toggleGroup(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="info-menu" role="dialog" aria-label="Add more information">
      <label className="info-menu-search">
        <Search size={14} strokeWidth={2.25} aria-hidden />
        <input
          type="text"
          placeholder="Search information…"
          aria-label="Search information"
          value={query}
          autoFocus
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive(Math.min(visible.length - 1, activeIndex + 1));
            else if (e.key === "ArrowUp") setActive(Math.max(0, activeIndex - 1));
            else if (e.key === "Enter" && visible[activeIndex]) onPick(visible[activeIndex]);
            else if (e.key === "Escape") onClose();
            else return;
            e.preventDefault();
            e.stopPropagation();
          }}
        />
      </label>
      <div className="info-menu-list" ref={listRef} role="listbox" aria-label="Available information">
        {groups.length === 0 && <p className="field-label info-menu-empty">No information matches &ldquo;{query.trim()}&rdquo;.</p>}
        {groups.map((g) => {
          const expanded = isOpen(g.key);
          return (
            <div key={g.key} className="info-menu-group" role="group" aria-label={g.label}>
              <button type="button" className="info-menu-group-header" aria-expanded={expanded} onClick={() => toggleGroup(g.key)} disabled={Boolean(needle)}>
                {expanded ? <ChevronDown size={13} strokeWidth={2.25} aria-hidden /> : <ChevronRight size={13} strokeWidth={2.25} aria-hidden />}
                <span>{g.label}</span>
                <span className="info-menu-count">{g.fields.length}</span>
              </button>
              {expanded &&
                g.fields.map((field) => {
                  const index = visible.indexOf(field);
                  const { Icon, hint } = KIND[field.kind];
                  return (
                    <button
                      key={field.key}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      data-active={index === activeIndex}
                      className={index === activeIndex ? "info-menu-option active" : "info-menu-option"}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => onPick(field)}
                    >
                      <Icon size={14} strokeWidth={2.25} aria-hidden />
                      <span className="info-menu-option-label">{field.label}</span>
                      <span className="info-menu-option-kind">{hint}</span>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The ? next to a field's remove button: hovering or focusing it shows the field's hint. */
function FieldHint({ field }: { field: InfoField }) {
  const id = `info-hint-${field.key}`;
  return (
    <span className="info-hint">
      <button type="button" className="btn btn-ghost btn-icon" aria-label={`About ${field.label}`} aria-describedby={id}>
        <CircleQuestionMark size={13} strokeWidth={2.25} />
      </button>
      <span role="tooltip" id={id} className="info-hint-bubble">
        {field.hint}
      </span>
    </span>
  );
}

/** Chips of a list value, each removable. */
function Chips({ items, onRemove }: { items: { value: string; label: string }[]; onRemove: (value: string) => void }) {
  return (
    <>
      {items.map((item) => (
        <span key={item.value} className="article-tag">
          {item.label}
          <button type="button" onClick={() => onRemove(item.value)} aria-label={`Remove ${item.label}`} title="Remove">
            <X size={11} strokeWidth={2.5} />
          </button>
        </span>
      ))}
    </>
  );
}

/** A dropdown in the app's own style (never a native select); it gets a search box at SEARCHABLE_SELECT_MIN options. */
function Dropdown({
  options,
  value,
  placeholder,
  clearLabel,
  ariaLabel,
  dataField,
  disabled,
  onChange,
}: {
  options: PickerOption[];
  value: string | null;
  placeholder: string;
  clearLabel?: string;
  ariaLabel: string;
  dataField: string;
  disabled?: boolean;
  onChange: (value: string | null) => void;
}) {
  return (
    <InfoPicker
      options={options}
      value={value}
      placeholder={placeholder}
      clearLabel={clearLabel}
      ariaLabel={ariaLabel}
      dataField={dataField}
      disabled={disabled}
      searchable={options.length >= SEARCHABLE_SELECT_MIN}
      onChange={onChange}
    />
  );
}

function FieldEditor({
  field,
  value,
  lookups,
  onChange,
}: {
  field: InfoField;
  value: InfoValue;
  lookups: InfoLookups;
  onChange: (value: InfoValue) => void;
}) {
  if (field.kind === "text") {
    return (
      <input
        type="text"
        data-field={field.key}
        aria-label={field.label}
        value={(value as string | null) ?? ""}
        maxLength={MAX_INFO_TEXT_LENGTH}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const list = Array.isArray(value) ? value : [];
  const addTo = (item: string | null) => item && onChange([...list, item]);
  const removeFrom = (item: string) => onChange(list.filter((x) => x !== item));

  if (field.kind === "select") {
    const choices = field.options ?? [];
    if (field.multiple) {
      const remaining = choices.filter((o) => !list.includes(o)).map((o) => ({ value: o, label: o }));
      return (
        <div className="info-multi">
          <Chips items={list.map((v) => ({ value: v, label: v }))} onRemove={removeFrom} />
          <Dropdown
            options={remaining}
            value={null}
            placeholder={remaining.length ? "Add…" : "All added"}
            ariaLabel={`Add to ${field.label}`}
            dataField={field.key}
            disabled={remaining.length === 0}
            onChange={addTo}
          />
        </div>
      );
    }
    const current = (value as string | null) ?? null;
    // A stored value outside the options (older data) stays pickable, so saving doesn't drop it.
    const all = current && !choices.includes(current) ? [current, ...choices] : choices;
    return (
      <Dropdown
        options={all.map((o) => ({ value: o, label: o }))}
        value={current}
        placeholder="Select…"
        clearLabel={field.required ? undefined : "None"}
        ariaLabel={field.label}
        dataField={field.key}
        onChange={(v) => (v || !field.required ? onChange(v) : undefined)}
      />
    );
  }

  const options = linkOptions(field.link!.targets, lookups);
  if (!field.link!.multiple) {
    return (
      <InfoPicker
        options={options}
        value={(value as string | null) ?? null}
        placeholder={options.length ? "None" : "Nothing to link yet"}
        clearLabel="None"
        ariaLabel={field.label}
        dataField={field.key}
        onChange={onChange}
      />
    );
  }
  const remaining = options.filter((o) => !list.includes(o.value));
  return (
    <div className="info-multi">
      <Chips items={list.map((id) => ({ value: id, label: options.find((o) => o.value === id)?.label ?? "(removed)" }))} onRemove={removeFrom} />
      <InfoPicker
        options={remaining}
        value={null}
        placeholder={remaining.length ? "Add…" : options.length ? "Nothing more to add" : "Nothing to link yet"}
        ariaLabel={`Add to ${field.label}`}
        dataField={field.key}
        disabled={remaining.length === 0}
        onChange={addTo}
      />
    </div>
  );
}

/** Label cell of an edit row. */
export function InfoEditLabel({ Icon, label, htmlFor, title }: { Icon: LucideIcon; label: string; htmlFor?: string; title?: string }) {
  const content = (
    <>
      <Icon size={12} strokeWidth={2.25} aria-hidden />
      {label}
    </>
  );
  return htmlFor ? (
    <label className="info-edit-label" htmlFor={htmlFor} title={title}>
      {content}
    </label>
  ) : (
    <span className="info-edit-label" title={title}>
      {content}
    </span>
  );
}

/**
 * Edit mode of an Info Bar: the record's name, any template `fixedRows`,
 * then every added field with an editor for its kind (removable unless
 * required), and "Add more information" (hidden once every field is added).
 * `onSave` builds and sends the PATCH, so each template controls its body.
 */
export function InfoForm({
  set,
  name: initialName,
  initialValues,
  lookups,
  fixedRows,
  onSave,
  onSaved,
  onCancel,
}: {
  set: InfoFieldSet;
  name: string;
  initialValues: InfoValues;
  lookups: InfoLookups;
  /** Template-specific rows after the name (use `.info-edit-row`). */
  fixedRows?: React.ReactNode;
  onSave: (name: string, values: InfoValues) => Promise<Response>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const nameId = useId();
  const [name, setName] = useState(initialName);
  const [values, setValues] = useState<InfoValues>(initialValues);
  const [menuOpen, setMenuOpen] = useState(false);
  /** A just-added field's key: focused on the next render. */
  const focusKeyRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLDivElement>(null);

  // Row drag-reordering (grip-armed, like the Layers panel).
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  // `values`' key order is the display order: new fields append, reordering rebuilds it.
  const order = Object.keys(values);
  const added = fieldsInOrder(set, values);
  const required = added.filter((f) => f.required);
  const optional = added.filter((f) => !f.required);
  const available = useMemo(() => set.fields.filter((f) => !f.required && !(f.key in values)), [set, values]);

  const setValue = (key: string, value: InfoValue) => setValues((prev) => ({ ...prev, [key]: value }));

  function reorder(nextOrder: string[]) {
    setValues((prev) => Object.fromEntries(nextOrder.filter((k) => k in prev).map((k) => [k, prev[k]])));
  }

  function endDrag() {
    setArmedKey(null);
    setDragKey(null);
    setOverKey(null);
  }

  useEffect(() => {
    if (!focusKeyRef.current) return;
    formRef.current?.querySelector<HTMLElement>(`[data-field="${focusKeyRef.current}"]`)?.focus();
    focusKeyRef.current = null;
  });

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!addRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  function addField(field: InfoField) {
    setValues((prev) => ({ ...prev, [field.key]: isListField(field) ? [] : null }));
    setMenuOpen(false);
    focusKeyRef.current = field.key;
  }

  function removeField(key: string) {
    setValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function save() {
    if (!name.trim()) {
      setError("A name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await onSave(name, values);
    setSaving(false);
    if (res.ok) onSaved();
    else setError((await res.json().catch(() => ({}))).error ?? "Could not save.");
  }

  return (
    <div className="politics-form info-form" ref={formRef}>
      <div className="info-edit-row info-edit-name">
        <InfoEditLabel Icon={Type} label="Name" htmlFor={nameId} />
        <input id={nameId} type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {fixedRows}

      {required.map((field) => {
        const { Icon, hint } = KIND[field.kind];
        return (
          <div key={field.key} className="info-edit-row info-edit-required">
            <InfoEditLabel Icon={Icon} label={field.label} title={hint} />
            <FieldEditor field={field} value={values[field.key]} lookups={lookups} onChange={(value) => setValue(field.key, value)} />
            <FieldHint field={field} />
          </div>
        );
      })}

      {optional.length > 0 && (
        // The gap between this group and the rows above separates what every article has from what was added.
        <div className="info-edit-added" onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOverKey(null)}>
          {optional.map((field) => {
            const { Icon, hint } = KIND[field.kind];
            const isOver = overKey === field.key && dragKey !== null && dragKey !== field.key;
            const below = isOver && order.indexOf(dragKey!) < order.indexOf(field.key);
            const rowClass = ["info-edit-row", "info-edit-movable", isOver && (below ? "drop-below" : "drop-above"), dragKey === field.key && "dragging"]
              .filter(Boolean)
              .join(" ");
            return (
              // Only draggable while the grip is held, so the editors inside keep working.
              <div
                key={field.key}
                className={rowClass}
                draggable={armedKey === field.key}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", field.key); // Firefox won't start a drag without data
                  setDragKey(field.key);
                }}
                onDragOver={(e) => {
                  if (!dragKey) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overKey !== field.key) setOverKey(field.key);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragKey) reorder(moveKey(order, dragKey, field.key));
                  endDrag();
                }}
                onDragEnd={endDrag}
              >
                <button
                  type="button"
                  className="info-drag-handle"
                  title="Drag to reorder (or focus and use ↑/↓)"
                  aria-label={`Reorder ${field.label}`}
                  onMouseDown={() => setArmedKey(field.key)}
                  onMouseUp={() => setArmedKey(null)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                    e.preventDefault();
                    const target = optional[optional.indexOf(field) + (e.key === "ArrowUp" ? -1 : 1)];
                    if (target) reorder(moveKey(order, field.key, target.key));
                  }}
                >
                  <GripVertical size={14} strokeWidth={2.25} />
                </button>
                <InfoEditLabel Icon={Icon} label={field.label} title={hint} />
                <FieldEditor field={field} value={values[field.key]} lookups={lookups} onChange={(value) => setValue(field.key, value)} />
                <FieldHint field={field} />
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeField(field.key)} aria-label={`Remove ${field.label}`} title={`Remove ${field.label}`}>
                  <X size={13} strokeWidth={2.25} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {available.length > 0 && (
        <div className="info-add" ref={addRef}>
          <button type="button" className="btn btn-sm" aria-expanded={menuOpen} aria-haspopup="dialog" onClick={() => setMenuOpen((o) => !o)}>
            <Plus size={14} strokeWidth={2.25} />
            Add more information
          </button>
          {menuOpen && <InfoFieldMenu set={set} available={available} onPick={addField} onClose={() => setMenuOpen(false)} />}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      <div className="marker-panel-actions">
        <button className="btn btn-sm btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button className="btn btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
