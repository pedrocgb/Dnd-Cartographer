"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

export interface PickerOption {
  value: string;
  label: string;
  /** Heading the option is listed under (only shown when options span several groups). */
  group?: string;
}

/** One pickable row of the list. */
function PickerRow({
  label,
  isClear,
  inFolder,
  active,
  selected,
  onHover,
  onPick,
}: {
  label: string;
  isClear: boolean;
  inFolder: boolean;
  active: boolean;
  selected: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const className = ["info-menu-option", "info-picker-option", inFolder && "in-folder", active && "active"].filter(Boolean).join(" ");
  return (
    <button type="button" role="option" aria-selected={selected} data-active={active} className={className} onMouseEnter={onHover} onClick={onPick}>
      <span className={isClear ? "info-menu-option-label field-label" : "info-menu-option-label"}>{label}</span>
    </button>
  );
}

/**
 * A dropdown with a search box: a select-looking trigger that opens a
 * filterable list. ↑/↓ move, Enter picks, Esc closes; an outside click
 * closes too. `value` null shows `placeholder`; `clearLabel` adds a first
 * row that picks null. `collapsibleGroups` turns the group headings into
 * folders (collapsed until clicked; a search opens every match).
 * `searchable` false drops the search box (short lists) — keys then go to the list.
 */
export default function InfoPicker({
  options,
  value,
  placeholder,
  clearLabel,
  ariaLabel,
  dataField,
  disabled,
  collapsibleGroups = false,
  searchable = true,
  onChange,
}: {
  options: PickerOption[];
  value: string | null;
  placeholder: string;
  clearLabel?: string;
  ariaLabel: string;
  dataField?: string;
  disabled?: boolean;
  collapsibleGroups?: boolean;
  searchable?: boolean;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const triggerId = useId();

  const needle = query.trim().toLowerCase();
  const matches = options.filter((o) => !needle || o.label.toLowerCase().includes(needle));
  const grouped = new Set(options.map((o) => o.group)).size > 1;
  const folders = collapsibleGroups && grouped;
  const groupIsOpen = (group: string | undefined) => !folders || Boolean(needle) || openGroups.has(group ?? "");
  // Rows reachable with ↑/↓: options inside collapsed folders are skipped.
  const visible = matches.filter((o) => groupIsOpen(o.group));
  const rows: (PickerOption | null)[] = clearLabel && !needle ? [null, ...visible] : visible;
  const activeIndex = Math.min(active, Math.max(0, rows.length - 1));
  const selected = options.find((o) => o.value === value);
  // Folder mode: each group that has matches, in first-appearance order.
  const groupList = [...new Set(matches.map((o) => o.group ?? ""))].map((group) => ({
    group,
    options: matches.filter((o) => (o.group ?? "") === group),
  }));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Without a search box, the list itself takes focus so ↑/↓/Enter/Esc still work.
  useEffect(() => {
    if (open && !searchable) listRef.current?.focus();
  }, [open, searchable]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openMenu() {
    setQuery("");
    // Folders start collapsed, except the one holding the current value.
    const initiallyOpen = new Set(folders && selected?.group ? [selected.group] : []);
    setOpenGroups(initiallyOpen);
    // Start on the current value so Enter keeps it.
    const reachable = folders ? options.filter((o) => initiallyOpen.has(o.group ?? "")) : options;
    const unfiltered: (PickerOption | null)[] = clearLabel ? [null, ...reachable] : reachable;
    setActive(Math.max(0, unfiltered.findIndex((r) => (r?.value ?? null) === value)));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    // By id rather than a ref: pick/close are handed to rows during render.
    document.getElementById(triggerId)?.focus();
  }

  function pick(row: PickerOption | null) {
    onChange(row?.value ?? null);
    close();
  }

  function toggleGroup(group: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") setActive(Math.min(rows.length - 1, activeIndex + 1));
    else if (e.key === "ArrowUp") setActive(Math.max(0, activeIndex - 1));
    else if (e.key === "Enter" && rows.length > 0) pick(rows[activeIndex]);
    else if (e.key === "Escape") close();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  function renderOption(row: PickerOption | null) {
    const i = rows.indexOf(row);
    return (
      <PickerRow
        key={row?.value ?? ""}
        label={row?.label ?? clearLabel ?? ""}
        isClear={!row}
        inFolder={folders && Boolean(row)}
        active={i === activeIndex}
        selected={(row?.value ?? null) === value}
        onHover={() => setActive(i)}
        onPick={() => pick(row)}
      />
    );
  }

  return (
    <div className="info-picker" ref={rootRef}>
      <button
        id={triggerId}
        type="button"
        className="info-picker-trigger"
        data-field={dataField}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openMenu();
          }
        }}
      >
        <span className={selected ? "info-picker-value" : "info-picker-value placeholder"}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={14} strokeWidth={2.25} aria-hidden />
      </button>
      {open && (
        <div className="info-menu info-picker-menu">
          {searchable && (
          <label className="info-menu-search">
            <Search size={14} strokeWidth={2.25} aria-hidden />
            <input
              type="text"
              placeholder="Search…"
              aria-label={`Search ${ariaLabel}`}
              aria-controls={listId}
              value={query}
              autoFocus
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
            />
          </label>
          )}
          <div
            className="info-menu-list"
            id={listId}
            ref={listRef}
            role="listbox"
            aria-label={ariaLabel}
            tabIndex={searchable ? undefined : -1}
            onKeyDown={searchable ? undefined : onKeyDown}
          >
            {matches.length === 0 && (
              <p className="field-label info-menu-empty">{needle ? <>Nothing matches &ldquo;{query.trim()}&rdquo;.</> : "Nothing to pick yet."}</p>
            )}
            {folders ? (
              <>
                {clearLabel && !needle && renderOption(null)}
                {groupList.map(({ group, options: groupOptions }) => {
                  const expanded = groupIsOpen(group);
                  return (
                    <div key={group} className="info-menu-group" role="group" aria-label={group}>
                      <button
                        type="button"
                        className="info-menu-group-header"
                        aria-expanded={expanded}
                        disabled={Boolean(needle)}
                        onClick={() => toggleGroup(group)}
                      >
                        {expanded ? <ChevronDown size={13} strokeWidth={2.25} aria-hidden /> : <ChevronRight size={13} strokeWidth={2.25} aria-hidden />}
                        <span>{group}</span>
                        <span className="info-menu-count">{groupOptions.length}</span>
                      </button>
                      {expanded && groupOptions.map((o) => renderOption(o))}
                    </div>
                  );
                })}
              </>
            ) : (
              rows.map((row, i) => {
                const heading = grouped && row?.group && row.group !== rows[i - 1]?.group ? row.group : null;
                return (
                  <div key={row?.value ?? ""}>
                    {heading && <div className="info-picker-heading">{heading}</div>}
                    {renderOption(row)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
