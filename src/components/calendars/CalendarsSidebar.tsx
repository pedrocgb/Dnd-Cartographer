"use client";

import { useState } from "react";
import { Archive, CalendarDays, CalendarPlus, ChevronDown, ChevronRight, Copy, Eye, EyeOff, Leaf, Moon, Pencil, Plus, Search, Star } from "lucide-react";
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

export default function CalendarsSidebar({
  world,
  activeId,
  def,
  showArchived,
  hiddenObjects,
  filters,
  categories,
  previewProfile,
  onShowArchived,
  onSelectCalendar,
  onNewCalendar,
  onEditCalendar,
  onDuplicate,
  onMakeDefault,
  onArchive,
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
  showArchived: boolean;
  hiddenObjects: Set<string>;
  filters: Filters;
  categories: string[];
  previewProfile: ClientProfile | null;
  onShowArchived: (v: boolean) => void;
  onSelectCalendar: (id: string) => void;
  onNewCalendar: () => void;
  onEditCalendar: (c: ClientCalendar) => void;
  onDuplicate: (c: ClientCalendar) => void;
  onMakeDefault: (c: ClientCalendar) => void;
  onArchive: (c: ClientCalendar) => void;
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
  const calendars = world.calendars.filter((c) => showArchived || !c.archived);
  const archivedCount = world.calendars.filter((c) => c.archived).length;

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
        <h2 className="field-label">Calendars</h2>
        <ul className="cal-side-list">
          {calendars.map((c) => (
            <li key={c.id} className="cal-side-item">
              <button type="button" className={c.id === activeId ? "articles-folder active" : "articles-folder"} aria-current={c.id === activeId} onClick={() => onSelectCalendar(c.id)}>
                <CalendarDays size={16} />
                <span className="articles-folder-name">{c.name}</span>
                {world.chronology.defaultCalendarId === c.id && (
                  <span className="cal-default-badge" data-tooltip="The world's default calendar">
                    <Star size={11} aria-hidden /> Default
                  </span>
                )}
                {c.archived && <span className="articles-folder-count">archived</span>}
              </button>
              {c.id === activeId && (
                <div className="cal-side-toolbar" role="group" aria-label={`${c.name} actions`}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEditCalendar(c)}>
                    <Pencil size={13} /> Edit
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDuplicate(c)}>
                    <Copy size={13} /> Duplicate
                  </button>
                  {world.chronology.defaultCalendarId !== c.id && !c.archived && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMakeDefault(c)}>
                      <Star size={13} /> Make default
                    </button>
                  )}
                  {world.chronology.defaultCalendarId !== c.id && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onArchive(c)}>
                      <Archive size={13} /> {c.archived ? "Unarchive" : "Archive"}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {archivedCount > 0 && (
          <label className="cal-check cal-help">
            <input type="checkbox" checked={showArchived} onChange={(e) => onShowArchived(e.target.checked)} /> Show archived ({archivedCount})
          </label>
        )}
        <button type="button" className="articles-folder articles-create" onClick={onNewCalendar}>
          <CalendarPlus size={16} />
          <span className="articles-folder-name">New calendar</span>
        </button>
      </section>

      {def && (
        <>
          <section className="cal-side-section">
            <h2 className="field-label">Show</h2>
            {(Object.keys(KIND_LABELS) as EntryKind[]).map((k) => (
              <label key={k} className="cal-check">
                <input
                  type="checkbox"
                  checked={filters.kinds.has(k)}
                  onChange={(e) => {
                    const kinds = new Set(filters.kinds);
                    if (e.target.checked) kinds.add(k);
                    else kinds.delete(k);
                    onFilters({ ...filters, kinds });
                  }}
                />
                {KIND_LABELS[k]}
              </label>
            ))}
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
          </section>

          <section className="cal-side-section">
            <h2 className="field-label">Seasons preview</h2>
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
            <button type="button" className="articles-folder" onClick={onOpenSeasons}>
              <Leaf size={16} />
              <span className="articles-folder-name">Seasons &amp; profiles</span>
            </button>
          </section>

          <section className="cal-side-section">
            <h2 className="field-label">Sky</h2>
            {CELESTIAL_TYPES.map((t) => {
              const objects = world.celestial.filter((o) => !o.archived && o.type === t.type && activeId !== null && inCalendar(o, activeId));
              if (objects.length === 0) return null;
              const open = !closedFolders.has(t.type);
              return (
                <div key={t.type} className="cal-sky-folder">
                  <button type="button" className="articles-folder cal-sky-folder-head" aria-expanded={open} onClick={() => toggleFolder(t.type)}>
                    {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                    <t.Icon size={16} aria-hidden />
                    <span className="articles-folder-name">
                      {t.plural} ({objects.length})
                    </span>
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
                          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={hiddenObjects.has(o.id) ? `Show ${o.name} on this calendar` : `Hide ${o.name} on this calendar`} data-tooltip={hiddenObjects.has(o.id) ? "Hidden here" : "Shown here"} onClick={() => onToggleObject(o.id)}>
                            {hiddenObjects.has(o.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            <button type="button" className="articles-folder articles-create" onClick={onNewObject}>
              {world.celestial.length ? <Plus size={16} /> : <Moon size={16} />}
              <span className="articles-folder-name">New celestial object</span>
            </button>
          </section>
        </>
      )}
    </aside>
  );
}
