"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowDownWideNarrow,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleQuestionMark,
  ExternalLink,
  EyeOff,
  Palette,
  GripVertical,
  Link2,
  Lock,
  LockOpen,
  Maximize2,
  Plus,
  Search,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  MAX_INFO_TEXT_LENGTH,
  MAX_INFO_URL_LENGTH,
  INFO_NAME_SECRET,
  INFO_SECRETS_KEY,
  encodeWorldDay,
  infoSecrets,
  isListField,
  parseWorldDay,
  sanitizeUrl,
  type InfoField,
  type InfoFieldKind,
  type InfoFieldSet,
  type InfoLinkTarget,
  type InfoValue,
  type InfoValues,
  requiredFields,
} from "@/server/articles/info-fields";
import { COLOR_PRESETS } from "@/server/markers/icon-registry";
import WorldDatePicker from "@/components/calendars/WorldDatePicker";
import { dayLabel } from "@/components/calendars/evaluate";
import { useDefaultCalendarStatus } from "@/components/relations/use-default-calendar";
import { useHideSecrets } from "@/components/relations/relations-context";
import InfoPicker, { type PickerOption } from "./InfoPicker";
import type { OpenArticle } from "./types";
import { useSettings } from "@/components/settings/SettingsProvider";
import { measureExample } from "@/server/settings/units";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";
import { templateOf } from "./templates";
import { optionLabel } from "@/server/articles/info-sets";

/** Articles a link field can point at, by template (season profiles carry their current season as `detail`). */
export type InfoLookups = Partial<Record<InfoLinkTarget, { id: string; name: string; detail?: string }[]>>;

const targetLabel = (target: InfoLinkTarget) => (target === "seasonProfile" ? activeT("articles")("info.seasonProfiles") : templateOf(target).label);

/** Native selects get a search box once they reach this many options. */
const SEARCHABLE_SELECT_MIN = 10;

/** Values longer than this many lines (text) or items (lists) start collapsed. */
const COLLAPSE_AFTER = 3;

/** Each kind's hint is `articles` `info.kind.<kind>`. */
const KIND: Record<InfoFieldKind, { Icon: LucideIcon }> = {
  text: { Icon: Type },
  select: { Icon: ArrowDownWideNarrow },
  link: { Icon: ExternalLink },
  color: { Icon: Palette },
  url: { Icon: Link2 },
  date: { Icon: CalendarDays },
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
      .map((x) => ({ value: x.id, label: x.name, group: targetLabel(target) }))
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
export function InfoRow({ label, secret = false, children }: { label: string; secret?: boolean; children: React.ReactNode }) {
  const ta = useT("articles");
  return (
    <div className={secret ? "info-row info-row-secret" : "info-row"}>
      <dt data-tooltip={secret ? `${label} · ${ta("info.secretMark")}` : label}>
        {secret && <Lock size={11} strokeWidth={2.5} className="info-secret-mark" aria-label={ta("info.secretMark")} />}
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The subtle show more / show less toggle under a collapsed value. */
function ExpandToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const ta = useT("articles");
  const label = expanded ? ta("info.showLess") : ta("info.showMore");
  return (
    <button type="button" className="info-expand" onClick={onToggle} aria-expanded={expanded} aria-label={label} data-tooltip={label}>
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
/** Where a read-only copy (a share link, no session) takes link names and date labels from instead of lookups and the calendar API. */
export interface InfoResolver {
  link: (id: string) => { name: string; href: string | null } | null;
  date: (day: number) => string | null;
}

export function InfoView({
  set,
  values,
  lookups,
  onOpenArticle,
  resolve,
  leading,
  extra,
}: {
  set: InfoFieldSet;
  values: InfoValues;
  lookups: InfoLookups;
  onOpenArticle?: OpenArticle;
  resolve?: InfoResolver;
  /** Read-only rows before the fields (e.g. a territory's type and parent). */
  leading?: React.ReactNode;
  /** Read-only rows after the fields (e.g. authorities). */
  extra?: React.ReactNode;
}) {
  const ta = useT("articles");
  // Secret fields carry a padlock; "hide secrets" (for screen sharing) hides them like secret ties.
  const [hideSecrets] = useHideSecrets();
  const secrets = infoSecrets(values);
  const fields = fieldsInOrder(set, values).filter((f) => !(hideSecrets && secrets.includes(f.key)));
  // Dates are world days, shown in the world's default calendar.
  const { calendar, loading } = useDefaultCalendarStatus(!resolve && fields.some((f) => f.kind === "date"));

  function linkButton(targets: readonly InfoLinkTarget[], id: string) {
    if (resolve) {
      const linked = resolve.link(id);
      if (!linked) return <span key={id} className="field-label">{ta("info.removed")}</span>;
      return linked.href ? (
        <a key={id} className="politics-link-button" href={linked.href}>
          {linked.name}
        </a>
      ) : (
        <span key={id}>{linked.name}</span>
      );
    }
    const found = findLinked(targets, lookups, id);
    if (!found) {
      return (
        <span key={id} className="field-label">
          {ta("info.removed")}
        </span>
      );
    }
    const target = found.target;
    if (target === "seasonProfile") {
      return (
        <span key={id} className="info-season-profile">
          <Link className="politics-link-button" href={`/calendars?profile=${encodeURIComponent(id)}`}>
            {found.item.name}
          </Link>
          {found.item.detail && <span className="field-label">{found.item.detail}</span>}
        </span>
      );
    }
    return (
      <button key={id} type="button" className="politics-link-button" onClick={() => onOpenArticle?.(target, id)}>
        {found.item.name}
      </button>
    );
  }

  if (fields.length === 0 && !leading && !extra) return <p className="article-card-placeholder">{ta("info.empty")}</p>;

  return (
    <dl className="info-list">
      {leading}
      {fields.map((field) => {
        const value = values[field.key];
        let shown: React.ReactNode;
        if (isEmpty(value)) shown = <span className="field-label">—</span>;
        else if (field.kind === "color") {
          shown = (
            <span className="info-color">
              <span className="info-color-swatch" style={{ background: String(value) }} aria-hidden />
              {String(value)}
            </span>
          );
        } else if (field.kind === "date" && parseWorldDay(value) !== null) {
          const day = parseWorldDay(value)!;
          const resolved = resolve?.date(day);
          shown = resolve ? (
            resolved ? <span className="info-value">{resolved}</span> : <span className="field-label">—</span>
          ) : calendar ? (
            <span className="info-value">
              <Link className="politics-link-button" href={`/calendars?day=${day}`} data-tooltip={ta("info.openDay")}>
                {dayLabel(calendar.def, day, { weekday: false })}
              </Link>
            </span>
          ) : (
            <span className="field-label">{loading ? "…" : ta("info.needsCalendar")}</span>
          );
        } else if (field.kind === "url") {
          shown = (
            <a className="info-url" href={String(value)} target="_blank" rel="noopener noreferrer">
              {String(value)}
            </a>
          );
        } else if (field.kind === "link" && field.link) {
          const ids = Array.isArray(value) ? value : [value as string];
          shown = <CollapsedList items={ids.map((id) => linkButton(field.link!.targets, id))} />;
        } else if (Array.isArray(value)) {
          const word = (v: string) => (field.kind === "select" ? optionLabel(v) : v);
          shown = <CollapsedList items={value.map((v, i) => <span key={v}>{i < value.length - 1 ? `${word(v)},` : word(v)}</span>)} />;
        } else shown = <ClampedText text={field.kind === "select" ? optionLabel(String(value)) : String(value)} />;
        return (
          <InfoRow key={field.key} label={field.label} secret={secrets.includes(field.key)}>
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
  const ta = useT("articles");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const needle = query.trim().toLowerCase();

  const groups = set.groups
    .map((g) => ({
      ...g,
      // Alphabetical in the user's language (the data files sort by the English label).
      fields: available.filter((f) => f.group === g.key && (!needle || f.label.toLowerCase().includes(needle))).sort((a, b) => a.label.localeCompare(b.label)),
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
    <div className="info-menu" role="dialog" aria-label={ta("info.addMore")}>
      <label className="info-menu-search">
        <Search size={14} strokeWidth={2.25} aria-hidden />
        <input
          type="text"
          placeholder={ta("info.search")}
          aria-label={ta("info.searchLabel")}
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
      <div className="info-menu-list" ref={listRef} role="listbox" aria-label={ta("info.available")}>
        {groups.length === 0 && <p className="field-label info-menu-empty">{ta("info.noMatch", { query: query.trim() })}</p>}
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
                  const { Icon } = KIND[field.kind];
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
                      <span className="info-menu-option-kind">{ta(`info.kind.${field.kind}`)}</span>
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
  const ta = useT("articles");
  const id = `info-hint-${field.key}`;
  return (
    <span className="info-hint">
      <button type="button" className="btn btn-ghost btn-icon" aria-label={ta("info.about", { field: field.label })} aria-describedby={id}>
        <CircleQuestionMark size={13} strokeWidth={2.25} />
      </button>
      <span role="tooltip" id={id} className="info-hint-bubble">
        {field.hint}
      </span>
    </span>
  );
}

/** The padlock beside a field's hint: a secret field (or name) is left out of share links. */
function SecretToggle({ label, secret, onToggle }: { label: string; secret: boolean; onToggle: () => void }) {
  const ta = useT("articles");
  const text = ta(secret ? "info.unsetSecret" : "info.setSecret", { field: label });
  return (
    <button type="button" className={secret ? "btn btn-ghost btn-icon info-secret-toggle on" : "btn btn-ghost btn-icon info-secret-toggle"} aria-pressed={secret} aria-label={text} data-tooltip={text} onClick={onToggle}>
      {secret ? <Lock size={13} strokeWidth={2.25} /> : <LockOpen size={13} strokeWidth={2.25} />}
    </button>
  );
}

/** Chips of a list value, each removable. */
function Chips({ items, onRemove }: { items: { value: string; label: string }[]; onRemove: (value: string) => void }) {
  const ta = useT("articles");
  return (
    <>
      {items.map((item) => (
        <span key={item.value} className="article-tag">
          {item.label}
          <button type="button" onClick={() => onRemove(item.value)} aria-label={ta("info.removeItem", { item: item.label })} data-tooltip={ta("info.remove")}>
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

/**
 * A "date" field: the world's default calendar's date picker. Free text
 * written before the field was a date is shown until a date replaces it.
 */
function DateFieldEditor({ field, value, onChange }: { field: InfoField; value: InfoValue; onChange: (value: InfoValue) => void }) {
  const ta = useT("articles");
  const { calendar, loading } = useDefaultCalendarStatus();
  const day = parseWorldDay(value);
  const oldText = day === null && typeof value === "string" && value.trim() ? value : null;
  return (
    <div className="info-date-editor" data-field={field.key}>
      {calendar ? (
        <WorldDatePicker
          def={calendar.def}
          label={field.label}
          value={day}
          currentDay={calendar.currentDay}
          onChange={(d) => onChange(encodeWorldDay(d))}
          onClear={field.required ? undefined : () => onChange(null)}
        />
      ) : (
        <span className="field-label">{loading ? ta("info.loadingCalendar") : ta("info.createCalendar")}</span>
      )}
      {oldText && (
        <span className="field-label info-date-old">
          {ta("info.writtenAs", { text: oldText })} {calendar ? ta("info.pickToReplace") : ""}
        </span>
      )}
    </div>
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
  const ta = useT("articles");
  const { settings } = useSettings();
  if (field.kind === "text") {
    return (
      <input
        type="text"
        data-field={field.key}
        aria-label={field.label}
        value={(value as string | null) ?? ""}
        placeholder={field.measure ? measureExample(field.measure, settings) : undefined}
        maxLength={MAX_INFO_TEXT_LENGTH}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.kind === "date") return <DateFieldEditor field={field} value={value} onChange={onChange} />;

  if (field.kind === "url") {
    const text = (value as string | null) ?? "";
    const invalid = text.trim() !== "" && !sanitizeUrl(text);
    return (
      <input
        type="url"
        data-field={field.key}
        aria-label={field.label}
        aria-invalid={invalid || undefined}
        placeholder="https://"
        value={text}
        maxLength={MAX_INFO_URL_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        data-tooltip={invalid ? ta("info.urlInvalid") : undefined}
      />
    );
  }

  if (field.kind === "color") {
    const current = typeof value === "string" ? value : null;
    return (
      <div className="info-color-editor" data-field={field.key}>
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            className={c === current ? "color-swatch active" : "color-swatch"}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={ta("info.colorPreset", { field: field.label, color: c })}
            data-tooltip={c}
          />
        ))}
        <input type="color" aria-label={ta("info.customColor", { field: field.label.toLowerCase() })} value={current ?? "#808080"} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        {current && !field.required && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>
            {ta("info.none")}
          </button>
        )}
      </div>
    );
  }

  const list = Array.isArray(value) ? value : [];
  const addTo = (item: string | null) => item && onChange([...list, item]);
  const removeFrom = (item: string) => onChange(list.filter((x) => x !== item));

  if (field.kind === "select") {
    const choices = field.options ?? [];
    if (field.multiple) {
      const remaining = choices.filter((o) => !list.includes(o)).map((o) => ({ value: o, label: optionLabel(o) }));
      return (
        <div className="info-multi">
          <Chips items={list.map((v) => ({ value: v, label: optionLabel(v) }))} onRemove={removeFrom} />
          <Dropdown
            options={remaining}
            value={null}
            placeholder={remaining.length ? ta("info.add") : ta("info.allAdded")}
            ariaLabel={ta("info.addTo", { field: field.label })}
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
        options={all.map((o) => ({ value: o, label: optionLabel(o) }))}
        value={current}
        placeholder={ta("select")}
        clearLabel={field.required ? undefined : ta("info.none")}
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
        placeholder={options.length ? ta("info.none") : ta("info.nothingToLink")}
        clearLabel={ta("info.none")}
        ariaLabel={field.label}
        dataField={field.key}
        onChange={onChange}
      />
    );
  }
  const remaining = options.filter((o) => !list.includes(o.value));
  return (
    <div className="info-multi">
      <Chips items={list.map((id) => ({ value: id, label: options.find((o) => o.value === id)?.label ?? ta("info.removed") }))} onRemove={removeFrom} />
      <InfoPicker
        options={remaining}
        value={null}
        placeholder={remaining.length ? ta("info.add") : options.length ? ta("info.nothingMore") : ta("info.nothingToLink")}
        ariaLabel={ta("info.addTo", { field: field.label })}
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
    <label className="info-edit-label" htmlFor={htmlFor} data-tooltip={title}>
      {content}
    </label>
  ) : (
    <span className="info-edit-label" data-tooltip={title}>
      {content}
    </span>
  );
}

/**
 * Edit mode of an Info Bar: the record's name, any template `fixedRows`,
 * the required fields, any `fixedRowsAfter`, then every added field with an editor for its kind (removable unless
 * required), and "Add more information" (hidden once every field is added).
 * `onSave` builds and sends the PATCH, so each template controls its body.
 */
export function InfoForm({
  set,
  name: initialName,
  initialValues,
  lookups,
  fixedRows,
  fixedRowsAfter,
  editorFor,
  saveLabel,
  savingLabel,
  allowAdding = true,
  onBack,
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
  /** Template-specific rows after the required fields (still above the gap). */
  fixedRowsAfter?: React.ReactNode;
  /** A template's own editor for a field (e.g. Parent Territory's hierarchy-filtered picker); undefined uses the default. */
  editorFor?: (field: InfoField) => React.ReactNode | undefined;
  saveLabel?: string;
  savingLabel?: string;
  /** False hides "Add more information" (a create form shows the required fields only). */
  allowAdding?: boolean;
  /** Adds a Back button before Save (the create modal's step back to the template chooser). */
  onBack?: () => void;
  onSave: (name: string, values: InfoValues) => Promise<Response>;
  /** Gets the successful response (a create form reads the new id from it). */
  onSaved: (res: Response) => void;
  onCancel: () => void;
}) {
  const ta = useT("articles");
  const tc = useT("common");
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
  const required = requiredFields(set);
  const optional = added.filter((f) => !f.required);
  const available = useMemo(() => set.fields.filter((f) => !f.required && !(f.key in values)), [set, values]);

  const setValue = (key: string, value: InfoValue) => setValues((prev) => ({ ...prev, [key]: value }));
  const secrets = infoSecrets(values);
  const toggleSecret = (key: string) =>
    setValues((prev) => {
      const current = infoSecrets(prev);
      return { ...prev, [INFO_SECRETS_KEY]: current.includes(key) ? current.filter((k) => k !== key) : [...current, key] };
    });
  const secretToggle = (key: string, label: string) => <SecretToggle label={label} secret={secrets.includes(key)} onToggle={() => toggleSecret(key)} />;
  const editor = (field: InfoField) =>
    editorFor?.(field) ?? <FieldEditor field={field} value={values[field.key]} lookups={lookups} onChange={(value) => setValue(field.key, value)} />;

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
      setError(ta("info.nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    const res = await onSave(name, values);
    setSaving(false);
    if (res.ok) onSaved(res);
    else setError((await res.json().catch(() => ({}))).error ?? ta("info.saveFailed"));
  }

  return (
    <div className="politics-form info-form" ref={formRef}>
      <div className="info-edit-row info-edit-name">
        <InfoEditLabel Icon={Type} label={tc("name")} htmlFor={nameId} />
        <input id={nameId} type="text" value={name} autoFocus={!initialName} onChange={(e) => setName(e.target.value)} />
        {secretToggle(INFO_NAME_SECRET, tc("name"))}
      </div>

      {fixedRows}

      {required.map((field) => {
        const { Icon } = KIND[field.kind];
        const hint = ta(`info.kind.${field.kind}`);
        return (
          <div key={field.key} className="info-edit-row info-edit-required">
            <InfoEditLabel Icon={Icon} label={field.label} title={hint} />
            {editor(field)}
            {secretToggle(field.key, field.label)}
            <FieldHint field={field} />
          </div>
        );
      })}

      {fixedRowsAfter}

      {optional.length > 0 && (
        // The gap between this group and the rows above separates what every article has from what was added.
        <div className="info-edit-added" onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOverKey(null)}>
          {optional.map((field) => {
            const { Icon } = KIND[field.kind];
        const hint = ta(`info.kind.${field.kind}`);
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
                  data-tooltip={ta("info.reorderHint")}
                  aria-label={ta("info.reorder", { field: field.label })}
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
                {editor(field)}
                {secretToggle(field.key, field.label)}
                <FieldHint field={field} />
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeField(field.key)} aria-label={ta("info.removeField", { field: field.label })} data-tooltip={ta("info.removeField", { field: field.label })}>
                  <X size={13} strokeWidth={2.25} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {allowAdding && available.length > 0 && (
        <div className="info-add" ref={addRef}>
          <button type="button" className="btn btn-sm" aria-expanded={menuOpen} aria-haspopup="dialog" onClick={() => setMenuOpen((o) => !o)}>
            <Plus size={14} strokeWidth={2.25} />
            {ta("info.addMore")}
          </button>
          {menuOpen && <InfoFieldMenu set={set} available={available} onPick={addField} onClose={() => setMenuOpen(false)} />}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      <div className="marker-panel-actions">
        {onBack && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={onBack} disabled={saving}>
            <ArrowLeft size={13} strokeWidth={2.25} />
            {ta("info.back")}
          </button>
        )}
        <button className="btn btn-sm btn-primary" onClick={save} disabled={saving}>
          {saving ? (savingLabel ?? tc("saving")) : (saveLabel ?? tc("save"))}
        </button>
        <button className="btn btn-sm" onClick={onCancel}>
          {tc("cancel")}
        </button>
      </div>
    </div>
  );
}
