"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { TERRITORY_TYPE_CATALOG } from "@/server/politics/hierarchy-config";

export async function json<T>(res: Response): Promise<T> {
  return res.json();
}

export function sortByName<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

/** PATCHes a JSON body onto a record URL. */
export function patchRecord(recordUrl: string, body: Record<string, unknown>) {
  return fetch(recordUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Edit/view toggle for a detail component that stays mounted (same tree
 * position) when the user selects a different record — so its editors never
 * remount. Without the reset, switching selection while `editing` was true
 * kept the edit FORM open, now pointed at the newly selected record; with a
 * form whose local state was seeded from the PREVIOUS record, a save could
 * persist stale fields onto the wrong record. Selecting anything new always
 * lands on its read view. `pickCount` (bumped on every list click) also
 * resets when the click re-picks the record already being edited.
 */
export function useEditingResetOnSelect(id: string, pickCount = 0) {
  const [editing, setEditing] = useState(false);
  const selectionKey = `${id}#${pickCount}`;
  const [trackedKey, setTrackedKey] = useState(selectionKey);
  if (selectionKey !== trackedKey) {
    setTrackedKey(selectionKey);
    if (editing) setEditing(false);
  }
  return [editing, setEditing] as const;
}

/** Toggles one id in a Set held in state. */
export function toggleInSet(prev: Set<string>, id: string): Set<string> {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** An expand/collapse Set in state, with a toggle. */
export function useExpandedSet(initial?: Iterable<string>) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initial));
  return [expanded, (id: string) => setExpanded((prev) => toggleInSet(prev, id)), setExpanded] as const;
}

/** A collapsed-by-default section with a small arrow toggle — keeps a
 * record's card from being overwhelming when its lists grow long. */
export function CollapsibleBlock({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="politics-collapsible">
      <button type="button" className="politics-collapsible-header" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ChevronRight size={14} strokeWidth={2.25} className={open ? "politics-collapsible-chevron open" : "politics-collapsible-chevron"} />
        <span className="marker-section-title">{title}</span>
      </button>
      {open && <div className="politics-collapsible-body">{children}</div>}
    </div>
  );
}

export function PickRow({
  item,
  selectedId,
  onSelect,
  depth = 0,
  children,
}: {
  item: { id: string; name: string };
  selectedId?: string | null;
  onSelect: (id: string) => void;
  /** Indent level (0 = top of the folder). */
  depth?: number;
  /** Extra label content after the name. */
  children?: React.ReactNode;
}) {
  return (
    <li className="politics-list-row politics-tree-row" style={depth ? { paddingLeft: depth * 18 } : undefined}>
      <span className="politics-tree-spacer" />
      <button className={item.id === selectedId ? "politics-list-pick selected" : "politics-list-pick"} onClick={() => onSelect(item.id)}>
        {item.name}
        {children}
      </button>
    </li>
  );
}

/** A collapsed-by-default group of entries (characters by house or status,
 * organizations by kind) — same arrow-toggle convention as the territory tree. */
export function PickGroupRow({
  groupId,
  label,
  members,
  expanded,
  onToggleExpand,
  onSelect,
  selectedId,
}: {
  groupId: string;
  label: string;
  members: { id: string; name: string }[];
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId?: string | null;
}) {
  const isExpanded = expanded.has(groupId);
  return (
    <>
      <li className="politics-list-row politics-tree-row">
        <button
          type="button"
          className="politics-tree-toggle"
          onClick={() => onToggleExpand(groupId)}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          aria-expanded={isExpanded}
        >
          {isExpanded ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
        </button>
        <button type="button" className="politics-list-pick" onClick={() => onToggleExpand(groupId)}>
          {label}
        </button>
      </li>
      {isExpanded && members.map((p) => <PickRow key={p.id} item={p} selectedId={selectedId} onSelect={onSelect} depth={1} />)}
    </>
  );
}

/**
 * A plain `<select>` listing every catalog territory type in a fixed order
 * (a `<datalist>` looked and behaved differently from every other dropdown
 * here, and Chrome reorders its options). Defaults to no type selected.
 * "Custom…" reveals a free-text field for a type outside the catalog.
 */
const CUSTOM_TYPE_VALUE = "__custom__";

export function TypeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const isCatalogType = TERRITORY_TYPE_CATALOG.some((c) => c.type === value);
  const [customMode, setCustomMode] = useState(value !== "" && !isCatalogType);

  return (
    <>
      <select
        value={customMode ? CUSTOM_TYPE_VALUE : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM_TYPE_VALUE) {
            setCustomMode(true);
            onChange("");
          } else {
            setCustomMode(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">Select a type…</option>
        {TERRITORY_TYPE_CATALOG.map((c) => (
          <option key={c.type} value={c.type}>
            {c.type}
          </option>
        ))}
        <option value={CUSTOM_TYPE_VALUE}>Custom…</option>
      </select>
      {customMode && <input type="text" placeholder="Custom type name" value={value} onChange={(e) => onChange(e.target.value)} />}
    </>
  );
}
