"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageSkeleton } from "@/components/Skeleton";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSearchParams } from "next/navigation";
import { CalendarPlus, ChevronLeft, ChevronRight, LocateFixed, Sun, Undo2 } from "lucide-react";
import { toWorldDay, weekLength, type LocalDate } from "@/server/calendars/engine";
import { api, notifyWorldDateChanged } from "./api";
import { byDay, dayLabel, evalContext, inCalendar, localOf, occurrencesIn, periodRange, periodsOf, safe, stepPeriod, stepYear, yearRange } from "./evaluate";
import { AgendaView, MonthView, YearView } from "./CalendarViews";
import CalendarsSidebar, { type Filters } from "./CalendarsSidebar";
import CalendarEditor from "./CalendarEditor";
import CelestialEditor from "./CelestialEditor";
import CelestialView from "./CelestialView";
import SeasonView from "./SeasonView";
import type { BriefSession } from "@/components/sessions/types";
import { questsOnDay } from "@/server/quests/logic";
import type { BriefQuest } from "@/server/quests/types";
import DateInput from "./DateInput";
import DayDetails from "./DayDetails";
import EntryEditor, { type EntryEditorMode } from "./EntryEditor";
import SeasonsEditor from "./SeasonsEditor";
import ProfilesEditor from "./ProfilesEditor";
import type { CalendarView, Chronology, ClientCalendar, ClientCelestial, ClientEntry, WorldCalendars } from "./types";

const ACTIVE_KEY = "calendars:active";
const VIEW_KEY = "calendars:view";
const hiddenKey = (calendarId: string) => `calendars:hidden:${calendarId}`;

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* per-browser convenience only */
  }
}

interface Undo {
  toDay: number;
  /** The chronology revision our change produced: undo only applies while nothing else has changed it. */
  revision: number;
  label: string;
}

/**
 * The Calendars page: calendar list and filters (left), the viewed period
 * (center), the selected day (right). The viewed period, the selected day
 * and the shared current date are independent — only the explicit
 * current-date actions change world time.
 */
export default function CalendarsManager() {
  // Deep links: ?day=<worldDay> opens that day, ?profile=<id> previews that season profile (from article backlinks / Season Profile fields).
  const searchParams = useSearchParams();
  const linkedDay = Number.isSafeInteger(Number(searchParams.get("day"))) && searchParams.get("day") !== null ? Number(searchParams.get("day")) : null;
  const linkedProfile = searchParams.get("profile");
  const [world, setWorld] = useState<WorldCalendars | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("month");
  const [viewed, setViewed] = useState<{ year: number; periodId: string } | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(linkedDay);
  const [previewProfileId, setPreviewProfileId] = useState<string | null | undefined>(linkedProfile ?? undefined);
  const [filters, setFilters] = useState<Filters>({ kinds: new Set(["note", "event", "link"]), category: "" });
  const [deleting, setDeleting] = useState<{ calendar: ClientCalendar; busy: boolean; error: string | null } | null>(null);
  const [hiddenObjects, setHiddenObjects] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<ClientEntry[]>([]);
  const [articleNames, setArticleNames] = useState<Record<string, string>>({});
  const [undo, setUndo] = useState<Undo[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [advanceBy, setAdvanceBy] = useState(10);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpDate, setJumpDate] = useState<LocalDate | null>(null);
  const [calendarEditor, setCalendarEditor] = useState<ClientCalendar | "new" | null>(null);
  const [celestialEditor, setCelestialEditor] = useState<ClientCelestial | "new" | null>(null);
  const [celestialView, setCelestialView] = useState<string | null>(null);
  const [seasonView, setSeasonView] = useState<string | null>(null);
  // Seasons and Season profiles open from each other, so they stack: the last one opened is on top.
  // Asking for the one already open underneath goes back to it (the one above closes).
  const [seasonModals, setSeasonModals] = useState<{ kind: "seasons" | "profiles"; calendarId: string | null; seasonId?: string }[]>([]);
  const openSeasonModal = (kind: "seasons" | "profiles", calendarId: string | null, seasonId?: string) =>
    setSeasonModals((list) => {
      const at = list.findIndex((m) => m.kind === kind);
      return at >= 0 ? list.slice(0, at + 1) : [...list, { kind, calendarId, seasonId }];
    });
  const closeSeasonModal = (kind: "seasons" | "profiles") => setSeasonModals((list) => list.filter((m) => m.kind !== kind));
  const [entryEditor, setEntryEditor] = useState<EntryEditorMode | null>(null);
  const [entriesVersion, setEntriesVersion] = useState(0);

  const reload = useCallback(async () => {
    const res = await api<WorldCalendars>("GET", "/api/calendars");
    if (res.ok) {
      setWorld(res.data);
      notifyWorldDateChanged();
    } else setLoadError(res.data.error ?? "Could not load the calendars.");
    return res.ok ? res.data : null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<WorldCalendars>("GET", "/api/calendars").then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setLoadError(res.data.error ?? "Could not load the calendars.");
        return;
      }
      setWorld(res.data);
      const saved = stored(ACTIVE_KEY);
      const live = res.data.calendars.filter((c) => !c.trashed);
      setActiveId(live.find((c) => c.id === saved)?.id ?? res.data.chronology.defaultCalendarId ?? live[0]?.id ?? null);
      const v = stored(VIEW_KEY);
      if (v === "month" || v === "year" || v === "agenda") setView(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const calendar = world?.calendars.find((c) => c.id === activeId) ?? null;
  const def = calendar?.definition ?? null;
  const ctx = useMemo(() => (world ? evalContext(world) : null), [world]);
  const currentDay = world?.chronology.currentDay ?? 0;

  // Viewed period: starts on the current date's month; follows the active calendar when it changes.
  const [viewedFor, setViewedFor] = useState<string | null>(null);
  if (def && calendar && viewedFor !== calendar.id) {
    const anchor = localOf(def, selectedDay ?? currentDay) ?? def.sync.date;
    // Switching calendars (not the first load, which may carry a linked profile) goes back to that calendar's profile.
    if (viewedFor !== null) setPreviewProfileId(undefined);
    setViewedFor(calendar.id);
    setViewed({ year: anchor.year, periodId: anchor.periodId });
    try {
      setHiddenObjects(new Set(JSON.parse(stored(hiddenKey(calendar.id)) ?? "[]") as string[]));
    } catch {
      setHiddenObjects(new Set());
    }
  }

  // No explicit pick: the active calendar's own profile (the default one if it's read in this calendar), else the world default.
  const calendarProfile = () => {
    const live = world?.profiles.filter((p) => !p.archived) ?? [];
    const own = live.filter((p) => p.data.calendarId === activeId);
    return own.find((p) => p.isDefault) ?? own[0] ?? live.find((p) => p.isDefault) ?? null;
  };
  const previewProfile = world ? (previewProfileId === undefined ? calendarProfile() : (world.profiles.find((p) => p.id === previewProfileId) ?? null)) : null;

  const range = useMemo<[number, number] | null>(() => {
    if (!def || !viewed) return null;
    return view === "month" ? periodRange(def, viewed.year, viewed.periodId) : yearRange(def, viewed.year);
  }, [def, viewed, view]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    api<{ entries: ClientEntry[]; articleNames: Record<string, string> }>("GET", `/api/calendar-entries?from=${range[0]}&to=${range[1]}`).then((res) => {
      if (cancelled || !res.ok) return;
      setEntries(res.data.entries);
      setArticleNames(res.data.articleNames);
    });
    return () => {
      cancelled = true;
    };
  }, [range, entriesVersion]);

  // Game sessions overlapping the viewed range (their chips and the day panel's Sessions section).
  const [rangeSessions, setRangeSessions] = useState<BriefSession[]>([]);
  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    api<{ sessions: BriefSession[] }>("GET", `/api/sessions?from=${range[0]}&to=${range[1]}`).then((res) => {
      if (!cancelled && res.ok) setRangeSessions(res.data.sessions);
    });
    return () => {
      cancelled = true;
    };
  }, [range]);
  const sessionsOn = (d: number) => rangeSessions.filter((s) => s.startDay !== null && s.endDay !== null && s.startDay <= d && d <= s.endDay);

  // Quests starting, due or ending in the viewed range (deadline chips and the day panel's Quests section).
  const [rangeQuests, setRangeQuests] = useState<BriefQuest[]>([]);
  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    api<{ quests: BriefQuest[] }>("GET", `/api/quests?from=${range[0]}&to=${range[1]}`).then((res) => {
      if (!cancelled && res.ok) setRangeQuests(res.data.quests);
    });
    return () => {
      cancelled = true;
    };
  }, [range]);
  const questsOn = (d: number) => questsOnDay(rangeQuests, d);

  const categories = useMemo(() => [...new Set(entries.map((e) => e.category).filter(Boolean))].sort(), [entries]);
  const visibleEntries = useMemo(
    () =>
      entries
        .filter((e) => filters.kinds.has(e.kind) && (!filters.category || e.category === filters.category))
        .map((e) => (e.kind === "link" && !e.title ? { ...e, title: articleNames[e.articleId ?? ""] ?? "(removed)" } : e)),
    [entries, filters, articleNames]
  );
  const occurrences = useMemo(() => (range && ctx ? occurrencesIn(visibleEntries, range[0], range[1], ctx) : []), [visibleEntries, range, ctx]);
  const perDay = useMemo(() => (range ? byDay(occurrences, range[0], range[1]) : new Map()), [occurrences, range]);
  const visibleObjects = useMemo(() => (world && activeId ? world.celestial.filter((o) => !o.archived && inCalendar(o, activeId) && !hiddenObjects.has(o.id)) : []), [world, activeId, hiddenObjects]);
  const selectedItems = useMemo(() => {
    if (selectedDay === null || !ctx) return [];
    if (range && selectedDay >= range[0] && selectedDay <= range[1]) return perDay.get(selectedDay) ?? [];
    return occurrencesIn(visibleEntries, selectedDay, selectedDay, ctx);
  }, [selectedDay, ctx, range, perDay, visibleEntries]);

  if (loadError) return <div className="articles-main">{loadError}</div>;
  if (!world || !ctx) return <PageSkeleton label="Loading calendars…" main="grid" />;

  function selectCalendar(id: string) {
    setActiveId(id);
    store(ACTIVE_KEY, id);
  }

  function changeView(v: CalendarView) {
    setView(v);
    store(VIEW_KEY, v);
  }

  function showDay(worldDay: number) {
    if (!def) return;
    const date = localOf(def, worldDay);
    if (date) setViewed({ year: date.year, periodId: date.periodId });
    setSelectedDay(worldDay);
  }

  function applyChronology(chronology: Chronology) {
    setWorld((w) => (w ? { ...w, chronology } : w));
    notifyWorldDateChanged();
  }

  /** Changes the shared date (compare-and-set on the revision); records an undo step. */
  async function changeDay(body: { currentDay?: number; advanceDays?: number }, label: string) {
    if (!world) return;
    setBusy(true);
    setNotice(null);
    const res = await api<{ chronology: Chronology; previousDay: number; stale?: boolean }>("PATCH", "/api/chronology", { ...body, expectedRevision: world.chronology.revision });
    setBusy(false);
    if (res.ok) {
      applyChronology(res.data.chronology);
      setUndo((u) => [...u.slice(-19), { toDay: res.data.previousDay, revision: res.data.chronology.revision, label }]);
      showDay(res.data.chronology.currentDay);
      return;
    }
    const data = res.data as { chronology?: Chronology; error?: string };
    if (data.chronology) applyChronology(data.chronology);
    setNotice(data.error ?? "Could not change the date.");
  }

  async function undoLast() {
    const last = undo.at(-1);
    if (!last || !world) return;
    if (last.revision !== world.chronology.revision) {
      setUndo([]);
      setNotice("The world date was changed since, so that step can't be undone.");
      return;
    }
    setBusy(true);
    const res = await api<{ chronology: Chronology }>("PATCH", "/api/chronology", { currentDay: last.toDay, expectedRevision: last.revision });
    setBusy(false);
    if (res.ok) {
      applyChronology(res.data.chronology);
      // The date is back where the previous step left it, so that step stays undoable at the new revision.
      const revision = res.data.chronology.revision;
      setUndo((u) => u.slice(0, -1).map((x, i, all) => (i === all.length - 1 ? { ...x, revision } : x)));
      showDay(res.data.chronology.currentDay);
    } else {
      const data = res.data as { chronology?: Chronology; error?: string };
      if (data.chronology) applyChronology(data.chronology);
      setUndo([]);
      setNotice(data.error ?? "Could not undo.");
    }
  }

  /** Moves the calendar to the Trash; the default calendar takes over the view when it was open. */
  async function deleteCalendar() {
    if (!deleting) return;
    const { calendar: target } = deleting;
    setDeleting({ ...deleting, busy: true, error: null });
    const res = await api<{ ok: true }>("DELETE", `/api/calendars/${target.id}`);
    if (!res.ok) {
      setDeleting({ calendar: target, busy: false, error: res.data.error ?? "Could not delete the calendar." });
      return;
    }
    setDeleting(null);
    const next = await reload();
    if (next && activeId === target.id) {
      const live = next.calendars.filter((c) => !c.trashed);
      const fallback = live.find((c) => c.id === next.chronology.defaultCalendarId) ?? live[0];
      if (fallback) selectCalendar(fallback.id);
      else setActiveId(null);
    }
  }

  async function makeDefault(c: ClientCalendar) {
    if (!world) return;
    const res = await api<{ chronology: Chronology }>("PATCH", "/api/chronology", { defaultCalendarId: c.id, expectedRevision: world.chronology.revision });
    if (res.ok) applyChronology(res.data.chronology);
    else setNotice(res.data.error ?? "Could not change the default calendar.");
  }

  async function duplicate(c: ClientCalendar) {
    const res = await api<{ calendar: ClientCalendar }>("POST", `/api/calendars/${c.id}/duplicate`);
    if (res.ok) {
      await reload();
      selectCalendar(res.data.calendar.id);
    } else setNotice(res.data.error ?? "Could not duplicate the calendar.");
  }

  function toggleObject(id: string) {
    if (!calendar) return;
    const next = new Set(hiddenObjects);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setHiddenObjects(next);
    store(hiddenKey(calendar.id), JSON.stringify([...next]));
  }

  const sidebar = (
    <CalendarsSidebar
      world={world}
      activeId={activeId}
      def={def}
      hiddenObjects={hiddenObjects}
      filters={filters}
      categories={categories}
      previewProfile={previewProfile}
      onSelectCalendar={selectCalendar}
      onNewCalendar={() => setCalendarEditor("new")}
      onEditCalendar={setCalendarEditor}
      onDuplicate={duplicate}
      onMakeDefault={makeDefault}
      onDelete={(c) => setDeleting({ calendar: c, busy: false, error: null })}
      onToggleObject={toggleObject}
      onEditObject={setCelestialEditor}
      onNewObject={() => setCelestialEditor("new")}
      onOpenSeasons={() => openSeasonModal("seasons", activeId)}
      onOpenProfiles={() => openSeasonModal("profiles", activeId)}
      onPreviewProfile={setPreviewProfileId}
      onFilters={setFilters}
      onJump={showDay}
    />
  );

  // Looked up by id so the view shows fresh data after a reload.
  const viewedObject = world?.celestial.find((o) => o.id === celestialView) ?? null;
  const viewedSeason = world?.seasons.find((x) => x.id === seasonView) ?? null;

  const editors = (
    <>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete calendar?"
        confirmLabel="Move to Trash"
        busyLabel="Deleting…"
        busy={deleting?.busy}
        error={deleting?.error}
        onConfirm={deleteCalendar}
        onCancel={() => setDeleting(null)}
      >
        <p>
          <strong>{deleting?.calendar.name}</strong> goes to the Trash (Settings → Trash), where you can restore it. Its entries stay on the world&apos;s timeline, and campaigns or season profiles that use it keep their dates.
        </p>
      </ConfirmDialog>
      {calendarEditor && (
        <CalendarEditor
          world={world}
          calendar={calendarEditor === "new" ? null : calendarEditor}
          onClose={() => setCalendarEditor(null)}
          onSaved={async (c) => {
            setCalendarEditor(null);
            await reload();
            selectCalendar(c.id);
            setViewedFor(null);
            setEntriesVersion((v) => v + 1);
          }}
        />
      )}
      {celestialEditor && def && calendar && (
        <CelestialEditor
          object={celestialEditor === "new" ? null : celestialEditor}
          def={def}
          calendarId={calendar.id}
          today={selectedDay ?? currentDay}
          calendars={world.calendars.filter((c) => !c.trashed)}
          onClose={() => {
            setCelestialEditor(null);
            void reload();
          }}
          onSaved={() => {
            setCelestialEditor(null);
            void reload();
          }}
        />
      )}
      {viewedObject && def && (
        <CelestialView
          object={viewedObject}
          def={def}
          day={selectedDay ?? currentDay}
          calendars={world.calendars.filter((c) => !c.trashed)}
          onClose={() => setCelestialView(null)}
          onEdit={() => {
            setCelestialView(null);
            setCelestialEditor(viewedObject);
          }}
        />
      )}
      {viewedSeason && def && (
        <SeasonView
          season={viewedSeason}
          world={world}
          def={def}
          day={selectedDay ?? currentDay}
          previewProfile={previewProfile}
          onClose={() => setSeasonView(null)}
          onEdit={() => {
            setSeasonView(null);
            openSeasonModal("seasons", viewedSeason.calendarId ?? activeId, viewedSeason.id);
          }}
        />
      )}
      {seasonModals.map((m) =>
        m.kind === "seasons" ? (
          <SeasonsEditor key="seasons" world={world} calendarId={m.calendarId} seasonId={m.seasonId} onChanged={() => void reload()} onClose={() => closeSeasonModal("seasons")} onOpenProfiles={(id) => openSeasonModal("profiles", id)} />
        ) : (
          <ProfilesEditor key="profiles" world={world} calendarId={m.calendarId} onChanged={() => void reload()} onClose={() => closeSeasonModal("profiles")} onOpenSeasons={(id) => openSeasonModal("seasons", id)} />
        )
      )}
      {entryEditor && def && calendar && (
        <EntryEditor
          mode={entryEditor}
          world={world}
          def={def}
          calendarId={calendar.id}
          ctx={ctx}
          categories={categories}
          onClose={() => setEntryEditor(null)}
          onSaved={(entry, names) => {
            setEntryEditor(null);
            setArticleNames((n) => ({ ...n, ...names }));
            setEntriesVersion((v) => v + 1);
            showDay(entry.recurrence.kind === "none" ? entry.worldDay : (selectedDay ?? entry.worldDay));
          }}
        />
      )}
    </>
  );

  if (!calendar || !def || !viewed) {
    return (
      <div className="articles-page">
        {sidebar}
        <main className="articles-main">
          <div className="articles-landing">
            <CalendarPlus size={40} strokeWidth={1.5} aria-hidden />
            <h1>Calendars</h1>
            <p className="cal-help">Create your world&apos;s first calendar: its weekdays, months and today&apos;s date. Seasons, moons and other calendars can come later.</p>
            <button type="button" className="btn btn-primary" onClick={() => setCalendarEditor("new")}>
              New calendar
            </button>
          </div>
        </main>
        {editors}
      </div>
    );
  }

  const periods = periodsOf(def, viewed.year);
  const period = periods.find((p) => p.period.id === viewed.periodId);
  const title = view === "month" ? `${period?.period.name ?? ""} ${viewed.year}${def.year.suffix ? ` ${def.year.suffix}` : ""}` : `Year ${viewed.year}${def.year.suffix ? ` ${def.year.suffix}` : ""}`;
  const step = (delta: 1 | -1) => setViewed(view === "month" ? stepPeriod(def, viewed.year, viewed.periodId, delta) : { year: stepYear(def, viewed.year, delta), periodId: viewed.periodId });
  const seasonOf = (d: number) => (previewProfile ? ctx.seasonsOn(previewProfile.id, d).flatMap((id) => world.seasons.find((s) => s.id === id) ?? []) : []);
  const week = weekLength(def);
  const viewProps = { def, year: viewed.year, currentDay, selectedDay, onSelect: setSelectedDay, occurrences: perDay, objects: visibleObjects, ctx, seasonOf, sessionsOn, questsOn };

  return (
    <div className="articles-page cal-page">
      {sidebar}
      <main className="articles-main cal-main">
        <header className="cal-header">
          <section className="cal-now" aria-label="Current date">
            <button type="button" className="cal-now-date" onClick={() => showDay(currentDay)} data-tooltip="Show this day">
              <span className="cal-now-icon" aria-hidden>
                <Sun size={20} strokeWidth={2} />
              </span>
              <span className="cal-now-text">
                <span className="cal-now-label">Current date</span>
                <strong aria-live="polite">{dayLabel(def, currentDay)}</strong>
              </span>
            </button>
            <div className="cal-now-advance" role="group" aria-label="Advance time">
              <span className="cal-now-label">Advance</span>
              <div className="cal-now-steps">
                <button type="button" disabled={busy} onClick={() => changeDay({ advanceDays: 1 }, "Advance 1 day")}>
                  +1 day
                </button>
                <button type="button" disabled={busy} onClick={() => changeDay({ advanceDays: week }, `Advance 1 week`)} data-tooltip={`One week of this calendar is ${week} days`}>
                  +1 week
                </button>
                <span className="cal-now-custom">
                  <input type="number" aria-label="Days to advance (negative goes back)" value={advanceBy} onChange={(e) => setAdvanceBy(Math.trunc(Number(e.target.value)) || 0)} />
                  <button type="button" disabled={busy || advanceBy === 0} onClick={() => changeDay({ advanceDays: advanceBy }, `Advance ${advanceBy} days`)}>
                    {advanceBy < 0 ? "days back" : "days"}
                  </button>
                </span>
              </div>
              {undo.length > 0 && (
                <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={undoLast} data-tooltip={`Undo: ${undo.at(-1)!.label}`}>
                  <Undo2 size={14} /> Undo
                </button>
              )}
            </div>
          </section>
          {notice && (
            <p className="form-error" role="alert">
              {notice}
            </p>
          )}
          <div className="cal-nav">
            <button type="button" className="btn btn-ghost btn-icon" aria-label={view === "month" ? "Previous month" : "Previous year"} onClick={() => step(-1)}>
              <ChevronLeft size={16} />
            </button>
            <h1 className="cal-title">{title}</h1>
            <button type="button" className="btn btn-ghost btn-icon" aria-label={view === "month" ? "Next month" : "Next year"} onClick={() => step(1)}>
              <ChevronRight size={16} />
            </button>
            {view === "month" && (
              <select aria-label="Month" value={viewed.periodId} onChange={(e) => setViewed({ ...viewed, periodId: e.target.value })}>
                {periods.map((p) => (
                  <option key={p.period.id} value={p.period.id}>
                    {p.period.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="number"
              className="cal-year-input"
              aria-label="Year"
              value={viewed.year}
              onChange={(e) => {
                const year = Math.trunc(Number(e.target.value));
                if (!Number.isInteger(year) || (year === 0 && !def.year.hasYearZero)) return;
                const list = periodsOf(def, year);
                setViewed({ year, periodId: list.some((p) => p.period.id === viewed.periodId) ? viewed.periodId : (list[0]?.period.id ?? viewed.periodId) });
              }}
            />
            <button type="button" className="btn btn-sm" onClick={() => showDay(currentDay)}>
              <LocateFixed size={14} /> Today
            </button>
            <div className="cal-jump">
              <button type="button" className="btn btn-sm" aria-expanded={jumpOpen} onClick={() => { setJumpDate(localOf(def, selectedDay ?? currentDay)); setJumpOpen(!jumpOpen); }}>
                Jump to date
              </button>
              {jumpOpen && jumpDate && (
                <div className="cal-jump-pop">
                  <DateInput def={def} label="Go to" value={jumpDate} onChange={setJumpDate} />
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      const d = safe(() => toWorldDay(def, jumpDate), null);
                      if (d !== null) {
                        showDay(d);
                        setJumpOpen(false);
                      }
                    }}
                  >
                    Go
                  </button>
                </div>
              )}
            </div>
            <span className="cal-spacer" />
            <div className="cal-view-switch" role="group" aria-label="View">
              {(["month", "year", "agenda"] as const).map((v) => (
                <button key={v} type="button" className={view === v ? "btn btn-sm active" : "btn btn-sm"} aria-pressed={view === v} onClick={() => changeView(v)}>
                  {v === "month" ? "Month" : v === "year" ? "Year" : "Agenda"}
                </button>
              ))}
            </div>
          </div>
        </header>
        <div className="cal-body">
          {view === "month" && <MonthView {...viewProps} periodId={viewed.periodId} />}
          {view === "year" && (
            <YearView
              {...viewProps}
              onOpenMonth={(periodId) => {
                setViewed({ ...viewed, periodId });
                changeView("month");
              }}
            />
          )}
          {view === "agenda" && <AgendaView def={def} items={occurrences} selectedDay={selectedDay} onSelect={setSelectedDay} rangeLabel={`year ${viewed.year}`} />}
        </div>
      </main>
      {selectedDay !== null && (
        <DayDetails
          worldDay={selectedDay}
          currentDay={currentDay}
          calendar={calendar}
          profile={previewProfile}
          seasons={world.seasons}
          objects={visibleObjects}
          sessions={sessionsOn(selectedDay)}
          quests={questsOn(selectedDay)}
          items={selectedItems}
          articleNames={articleNames}
          ctx={ctx}
          busy={busy}
          onSetCurrent={() => changeDay({ currentDay: selectedDay }, "Set current date")}
          onEdit={setEntryEditor}
          onViewObject={(o) => setCelestialView(o.id)}
          onViewSeason={(x) => setSeasonView(x.id)}
          onChanged={() => setEntriesVersion((v) => v + 1)}
          onClose={() => setSelectedDay(null)}
        />
      )}
      {editors}
    </div>
  );
}
