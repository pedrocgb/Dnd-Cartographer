"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight, Copy, Ellipsis, Eye, EyeOff, Leaf, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import type { CalendarDefinition } from "@/server/calendars/engine";
import { api } from "./api";
import { dayLabel, inCalendar } from "./evaluate";
import { CELESTIAL_TYPES } from "./celestial-types";
import type { ClientCalendar, ClientCelestial, ClientEntry, ClientProfile, EntryKind, WorldCalendars } from "./types";

export interface Filters {
  kinds: Set<EntryKind>;
  category: string;
}

const KIND_LABELS: Record<EntryKind, string> = { note: "Notes", event: "Events", link: "Article links" };

/** A sidebar section's title, with an optional icon action at its right. */
function SideHead({ title, action }: { title: string; action?: { label: string; Icon: typeof Plus; onClick: () => void } }) {
  return (
    <div className="cal-side-head">
      <h2 className="field-label">{title}</h2>
      {action && (
        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={action.label} data-tooltip={action.label} onClick={action.onClick}>
          <action.Icon size={15} />
        </button>
      )}
    </div>
  );
}

/** A calendar's actions behind one "…" button; a pick, Esc or a click elsewhere closes it. */
function CalendarMenu({
  calendar,
  isDefault,
  onEdit,
  onDuplicate,
  onMakeDefault,
  onDelete,
}: {
  calendar: ClientCalendar;
  isDefault: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onMakeDefault: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div ref={ref} className={open ? "cal-row-menu open" : "cal-row-menu"}>
      <button
        type="button"
        className="btn btn-ghost btn-icon btn-sm"
        aria-label={`${calendar.name} actions`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-tooltip={open ? undefined : "Actions"}
        onClick={() => setOpen(!open)}
      >
        <Ellipsis size={15} />
      </button>
      {open && (
        <div className="cal-row-menu-pop" role="menu">
          <button type="button" role="menuitem" onClick={pick(onEdit)}>
            <Pencil size={14} /> Edit
          </button>
          <button type="button" role="menuitem" onClick={pick(onDuplicate)}>
            <Copy size={14} /> Duplicate
          </button>
          {!isDefault && (
            <>
              <button type="button" role="menuitem" onClick={pick(onMakeDefault)}>
                <Star size={14} /> Make default
              </button>
              <button type="button" role="menuitem" className="danger" onClick={pick(onDelete)}>
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function CalendarsSidebar({
  world,
  activeId,
  def,
  hiddenObjects,
  filters,
  categories,
  previewProfile,
  onSelectCalendar,
  onNewCalendar,
  onEditCalendar,
  onDuplicate,
  onMakeDefault,
  onDelete,
  onToggleObject,
  onEditObject,
  onNewObject,
  onOpenSeasons,
  onPreviewProfile,
  onFilters,
  onJump,
}: {
  world: WorldCalendars;
  activeId: string | null;
  def: CalendarDefinition | null;
  hiddenObjects: Set<string>;
  filters: Filters;
  categories: string[];
  previewProfile: ClientProfile | null;
  onSelectCalendar: (id: string) => void;
  onNewCalendar: () => void;
  onEditCalendar: (c: ClientCalendar) => void;
  onDuplicate: (c: ClientCalendar) => void;
  onMakeDefault: (c: ClientCalendar) => void;
  onDelete: (c: ClientCalendar) => void;
  onToggleObject: (id: string) => void;
  onEditObject: (o: ClientCelestial) => void;
  onNewObject: () => void;
  onOpenSeasons: () => void;
  onPreviewProfile: (id: string | null) => void;
  onFilters: (f: Filters) => void;
  onJump: (worldDay: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientEntry[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  // Sky folders start open; closing one only lasts for this visit.
  const [closedFolders, setClosedFolders] = useState<Set<string>>(new Set());
  const toggleFolder = (type: string) =>
    setClosedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  const calendars = world.calendars.filter((c) => !c.trashed);
  const skyHere = world.celestial.filter((o) => !o.archived && activeId !== null && inCalendar(o, activeId));

  async function search(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setResults(null);
      return;
    }
    const res = await api<{ entries: ClientEntry[]; articleNames: Record<string, string> }>("GET", `/api/calendar-entries?q=${encodeURIComponent(q.trim())}`);
    if (res.ok) {
      setResults(res.data.entries);
      setNames(res.data.articleNames);
    }
  }

  return (
    <aside className="articles-sidebar cal-sidebar" aria-label="Calendars">
      <section className="cal-side-section">
        <SideHead title="Calendars" action={{ label: "New calendar", Icon: Plus, onClick: onNewCalendar }} />
        <ul className="cal-side-list">
          {calendars.map((c) => {
            const isDefault = world.chronology.defaultCalendarId === c.id;
            return (
              <li key={c.id} className="cal-side-row cal-calendar-row">
                <button type="button" className={c.id === activeId ? "articles-folder active" : "articles-folder"} aria-current={c.id === activeId} onClick={() => onSelectCalendar(c.id)}>
                  <CalendarDays size={16} />
                  <span className="articles-folder-name">{c.name}</span>
                  {isDefault && (
                    <span className="cal-default-star" data-tooltip="The world's default calendar">
                      <Star size={13} fill="currentColor" aria-label="Default" />
                    </span>
                  )}
                </button>
                <CalendarMenu calendar={c} isDefault={isDefault} onEdit={() => onEditCalendar(c)} onDuplicate={() => onDuplicate(c)} onMakeDefault={() => onMakeDefault(c)} onDelete={() => onDelete(c)} />
              </li>
            );
          })}
        </ul>
        {calendars.length === 0 && <p className="cal-help">No calendars yet.</p>}
      </section>

      {def && (
        <>
          <section className="cal-side-section">
            <SideHead title="Filter" />
            <label className="cal-search">
              <Search size={14} aria-hidden />
              <input type="search" placeholder="Search notes and events" value={query} onChange={(e) => search(e.target.value)} aria-label="Search notes and events" />
            </label>
            {results && (
              <ul className="cal-search-results">
                {results.length === 0 && <li className="cal-help">No matches.</li>}
                {results.map((e) => (
                  <li key={e.id}>
                    <button type="button" className="cal-search-result" onClick={() => onJump(e.worldDay)}>
                      <span>{e.title || (e.kind === "link" ? (names[e.articleId ?? ""] ?? "(removed)") : "Note")}</span>
                      <span className="cal-help">{dayLabel(def, e.worldDay, { weekday: false })}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="cal-kind-toggles" role="group" aria-label="Show on the calendar">
              {(Object.keys(KIND_LABELS) as EntryKind[]).map((k) => {
                const on = filters.kinds.has(k);
                return (
                  <button
                    key={k}
                    type="button"
                    className={`cal-kind-toggle ${k}`}
                    aria-pressed={on}
                    onClick={() => {
                      const kinds = new Set(filters.kinds);
                      if (on) kinds.delete(k);
                      else kinds.add(k);
                      onFilters({ ...filters, kinds });
                    }}
                  >
                    <span className="cal-kind-dot" aria-hidden />
                    {KIND_LABELS[k]}
                  </button>
                );
              })}
            </div>
            {categories.length > 0 && (
              <select aria-label="Category filter" value={filters.category} onChange={(e) => onFilters({ ...filters, category: e.target.value })}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </section>

          <section className="cal-side-section">
            <SideHead title="Seasons preview" action={{ label: "Seasons & profiles", Icon: Leaf, onClick: onOpenSeasons }} />
            <select aria-label="Season profile to preview" value={previewProfile?.id ?? ""} onChange={(e) => onPreviewProfile(e.target.value || null)}>
              <option value="">None</option>
              {world.profiles
                .filter((p) => !p.archived)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </section>

          <section className="cal-side-section">
            <SideHead title="Sky" action={{ label: "New celestial object", Icon: Plus, onClick: onNewObject }} />
            {skyHere.length === 0 && <p className="cal-help">No suns, moons or stars in this calendar yet.</p>}
            {CELESTIAL_TYPES.map((t) => {
              const objects = skyHere.filter((o) => o.type === t.type);
              if (objects.length === 0) return null;
              const open = !closedFolders.has(t.type);
              return (
                <div key={t.type} className="cal-sky-folder">
                  <button type="button" className="articles-folder cal-sky-folder-head" aria-expanded={open} onClick={() => toggleFolder(t.type)}>
                    {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                    <t.Icon size={16} aria-hidden />
                    <span className="articles-folder-name">{t.plural}</span>
                    <span className="articles-folder-count">{objects.length}</span>
                  </button>
                  {open && (
                    <ul className="cal-side-list cal-sky-items">
                      {objects.map((o) => (
                        <li key={o.id} className="cal-side-item cal-side-row">
                          <button type="button" className="articles-folder" onClick={() => onEditObject(o)}>
                            <span style={{ color: o.color }} aria-hidden>
                              {o.icon || t.symbol}
                            </span>
                            <span className="articles-folder-name">{o.name}</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon btn-sm"
                            aria-label={hiddenObjects.has(o.id) ? `Show ${o.name} on this calendar` : `Hide ${o.name} on this calendar`}
                            data-tooltip={hiddenObjects.has(o.id) ? "Hidden here" : "Shown here"}
                            onClick={() => onToggleObject(o.id)}
                          >
                            {hiddenObjects.has(o.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}
    </aside>
  );
}
