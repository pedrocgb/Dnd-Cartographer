"use client";

import { useEffect, useRef, useState } from "react";
import { History } from "lucide-react";
import Modal from "@/components/Modal";
import { toWorldDay, validateDefinition, type CalendarDefinition, type LocalDate } from "@/server/calendars/engine";
import { api, newId } from "./api";
import { dayLabel, localOf, safe } from "./evaluate";
import DateInput from "./DateInput";
import DefinitionPreview from "./DefinitionPreview";
import ImpactDialog, { type MigrationChoice } from "./ImpactDialog";
import { MonthsFields, WeekdaysFields, YearFields } from "./DefinitionFields";
import type { ClientCalendar, Impact, WorldCalendars } from "./types";
import { SkeletonList } from "@/components/Skeleton";

const TABS = [
  { key: "basics", label: "Name" },
  { key: "weekdays", label: "Weekdays" },
  { key: "months", label: "Months" },
  { key: "year", label: "Years & leap days" },
  { key: "sync", label: "Date" },
] as const;
type Tab = (typeof TABS)[number]["key"];

interface Draft {
  name: string;
  description: string;
  definition: CalendarDefinition;
}

function starterDefinition(currentDay: number): CalendarDefinition {
  const weekdays = Array.from({ length: 7 }, (_, i) => ({ id: newId("wd"), name: `Weekday ${i + 1}`, short: "" }));
  const periods = Array.from({ length: 12 }, (_, i) => ({ id: newId("mo"), name: `Month ${i + 1}`, short: "", kind: "month" as const, days: 30, inWeek: true, condition: null }));
  const date = { year: 1, periodId: periods[0].id, day: 1 };
  return { weekdays, weekReset: "continuous", weekAnchor: { date, weekdayId: weekdays[0].id }, periods, leapRules: [], year: { hasYearZero: false, suffix: "" }, sync: { date, worldDay: currentDay } };
}

const draftKey = (id: string | null) => `calendar-draft:${id ?? "new"}`;

function readDraft(id: string | null): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(id: string | null, draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(draftKey(id), JSON.stringify(draft));
    else localStorage.removeItem(draftKey(id));
  } catch {
    /* storage unavailable: drafts just aren't kept */
  }
}

/** Keeps the week anchor / sync date pointing at existing periods after edits. */
function repairAnchors(def: CalendarDefinition): CalendarDefinition {
  const first = def.periods[0]?.id ?? "";
  const fix = (d: LocalDate) => (def.periods.some((p) => p.id === d.periodId) ? d : { ...d, periodId: first, day: 1 });
  return { ...def, weekAnchor: { ...def.weekAnchor, date: fix(def.weekAnchor.date) }, sync: { ...def.sync, date: fix(def.sync.date) } };
}

/**
 * Creates (a short guided flow: name, weekdays, months, date, preview) or
 * edits a calendar (the same sections, with advanced options shown). The
 * draft lives in one state object, so switching sections never loses it,
 * and it's kept in this browser until saved or discarded.
 */
export default function CalendarEditor({
  world,
  calendar,
  onSaved,
  onClose,
}: {
  world: WorldCalendars;
  /** Null creates a new calendar. */
  calendar: ClientCalendar | null;
  onSaved: (calendar: ClientCalendar) => void;
  onClose: () => void;
}) {
  const creating = calendar === null;
  const id = calendar?.id ?? null;
  const [restored] = useState(() => readDraft(id));
  const [draft, setDraft] = useState<Draft>(
    () => restored ?? (calendar ? { name: calendar.name, description: calendar.description, definition: calendar.definition } : { name: "", description: "", definition: starterDefinition(world.chronology.currentDay) })
  );
  const [showRestored, setShowRestored] = useState(Boolean(restored));
  const [tab, setTab] = useState<Tab>("basics");
  const [advanced, setAdvanced] = useState(!creating);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (dirty.current) writeDraft(id, draft);
  }, [draft, id]);

  const update = (patch: Partial<Draft>) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, ...patch, definition: patch.definition ? repairAnchors(patch.definition) : d.definition }));
  };
  const def = draft.definition;
  const issues = validateDefinition(def);
  const others = world.calendars.filter((c) => c.id !== id && !c.archived);
  const tabIndex = TABS.findIndex((t) => t.key === tab);

  async function save(migration?: MigrationChoice) {
    if (!draft.name.trim()) {
      setTab("basics");
      setError("Give the calendar a name.");
      return;
    }
    if (issues.length) {
      setError(issues[0].message);
      return;
    }
    setSaving(true);
    setError(null);
    const res = creating
      ? await api<{ calendar: ClientCalendar }>("POST", "/api/calendars", draft)
      : await api<{ calendar: ClientCalendar; impact?: Impact; needsReview?: boolean; stale?: boolean }>("PATCH", `/api/calendars/${id}`, { ...draft, expectedVersion: calendar!.version, migration });
    setSaving(false);
    if (res.ok) {
      writeDraft(id, null);
      setImpact(null);
      onSaved(res.data.calendar);
      return;
    }
    const data = res.data as { impact?: Impact; needsReview?: boolean; error?: string };
    if (data.needsReview && data.impact) {
      setImpact(data.impact);
      if (migration) setError(data.error ?? null);
      return;
    }
    setError(data.error ?? "Could not save the calendar.");
  }

  function close() {
    onClose();
  }

  return (
    <Modal open onClose={close} title={creating ? "New Calendar" : `Edit ${calendar!.name}`} size="wide">
      <div className="cal-editor">
        {showRestored && (
          <div className="cal-banner">
            Restored your unsaved changes.
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                writeDraft(id, null);
                dirty.current = false;
                setDraft(calendar ? { name: calendar.name, description: calendar.description, definition: calendar.definition } : { name: "", description: "", definition: starterDefinition(world.chronology.currentDay) });
                setShowRestored(false);
              }}
            >
              Discard them
            </button>
          </div>
        )}
        <div className="cal-editor-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "cal-tab active" : "cal-tab"} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
          <label className="cal-check cal-advanced-toggle">
            <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
            Advanced options
          </label>
        </div>
        <div className="cal-editor-body">
          <div className="cal-editor-form" role="tabpanel">
            {tab === "basics" && (
              <div className="cal-fields">
                <label className="cal-field">
                  <span className="field-label">Name</span>
                  <input type="text" value={draft.name} maxLength={80} autoFocus placeholder="e.g. Imperial Reckoning" onChange={(e) => update({ name: e.target.value })} />
                </label>
                <label className="cal-field">
                  <span className="field-label">Description</span>
                  <textarea rows={4} value={draft.description} maxLength={4000} placeholder="Who uses this calendar, and since when?" onChange={(e) => update({ description: e.target.value })} />
                </label>
                {!creating && (
                  <button type="button" className="btn btn-sm" onClick={() => setRevisionsOpen(true)}>
                    <History size={14} /> Earlier versions
                  </button>
                )}
              </div>
            )}
            {tab === "weekdays" && <WeekdaysFields def={def} advanced={advanced} onChange={(definition) => update({ definition })} />}
            {tab === "months" && <MonthsFields def={def} advanced={advanced} onChange={(definition) => update({ definition })} />}
            {tab === "year" && <YearFields def={def} advanced={advanced} onChange={(definition) => update({ definition })} />}
            {tab === "sync" && <SyncFields def={def} world={world} others={others} creating={creating} onChange={(definition) => update({ definition })} />}
          </div>
          <DefinitionPreview def={def} />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="cal-editor-actions">
          <button type="button" className="btn btn-sm" onClick={close}>
            Cancel
          </button>
          <span className="cal-spacer" />
          {creating && tabIndex > 0 && (
            <button type="button" className="btn btn-sm" onClick={() => setTab(TABS[tabIndex - 1].key)}>
              Back
            </button>
          )}
          {creating && tabIndex < TABS.length - 1 ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setTab(TABS[tabIndex + 1].key)}>
              Next
            </button>
          ) : (
            <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => save()}>
              {saving ? "Saving…" : creating ? "Create calendar" : "Save changes"}
            </button>
          )}
        </div>
      </div>
      {impact && <ImpactDialog impact={impact} busy={saving} error={error} onCancel={() => setImpact(null)} onApply={(choice) => save(choice)} />}
      {revisionsOpen && calendar && (
        <RevisionsDialog
          calendar={calendar}
          onClose={() => setRevisionsOpen(false)}
          onRestored={(c) => {
            writeDraft(id, null);
            setRevisionsOpen(false);
            onSaved(c);
          }}
        />
      )}
    </Modal>
  );
}

/**
 * The calendar's anchor to shared time. The first calendar just picks
 * "today's" date; any other matches one of its dates to a date in an
 * existing calendar (so both show the same physical day).
 */
function SyncFields({
  def,
  world,
  others,
  creating,
  onChange,
}: {
  def: CalendarDefinition;
  world: WorldCalendars;
  others: ClientCalendar[];
  creating: boolean;
  onChange: (def: CalendarDefinition) => void;
}) {
  const [refId, setRefId] = useState(others[0]?.id ?? "");
  const ref = others.find((c) => c.id === refId) ?? null;
  const refDate = ref ? localOf(ref.definition, def.sync.worldDay) : null;
  const current = world.chronology.currentDay;

  if (!ref) {
    return (
      <div className="cal-fields">
        <p className="cal-help">{creating ? "What is today's date in this calendar? It becomes the world's current date." : "This calendar's date on the shared world day it's anchored to."}</p>
        <DateInput def={def} label={creating ? "Today is" : `On world day ${def.sync.worldDay}`} value={def.sync.date} onChange={(date) => onChange({ ...def, sync: { date, worldDay: creating ? current : def.sync.worldDay } })} />
      </div>
    );
  }
  return (
    <div className="cal-fields">
      <p className="cal-help">Match one date of this calendar to the same day in another calendar. Both then show every day in step.</p>
      <DateInput def={def} label="This calendar's date" value={def.sync.date} onChange={(date) => onChange({ ...def, sync: { ...def.sync, date } })} />
      <label className="cal-field">
        <span className="field-label">…is the same day as, in</span>
        <select value={refId} onChange={(e) => setRefId(e.target.value)}>
          {others.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {refDate && (
        <DateInput
          def={ref.definition}
          label={ref.name}
          value={refDate}
          onChange={(date) => {
            const worldDay = safe(() => toWorldDay(ref.definition, date), null);
            if (worldDay !== null) onChange({ ...def, sync: { ...def.sync, worldDay } });
          }}
        />
      )}
      <p className="cal-help">
        The world&apos;s current date: {dayLabel(ref.definition, current)} in {ref.name}
        {validateDefinition(def).length === 0 ? `, ${dayLabel(def, current)} in this calendar.` : "."}
      </p>
    </div>
  );
}

function RevisionsDialog({ calendar, onClose, onRestored }: { calendar: ClientCalendar; onClose: () => void; onRestored: (c: ClientCalendar) => void }) {
  const [revisions, setRevisions] = useState<{ id: string; version: number; reason: string; createdAt: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ revisions: { id: string; version: number; reason: string; createdAt: string }[] }>("GET", `/api/calendars/${calendar.id}/revisions`).then((res) => {
      if (cancelled) return;
      if (res.ok) setRevisions(res.data.revisions);
      else setError(res.data.error ?? "Could not load the versions.");
    });
    return () => {
      cancelled = true;
    };
  }, [calendar.id]);

  async function restore(revisionId: string) {
    setBusy(true);
    const res = await api<{ calendar: ClientCalendar }>("POST", `/api/calendars/${calendar.id}/revisions`, { revisionId, expectedVersion: calendar.version });
    setBusy(false);
    if (res.ok) onRestored(res.data.calendar);
    else setError(res.data.error ?? "Could not restore that version.");
  }

  return (
    <Modal open onClose={onClose} title="Earlier versions">
      <p className="cal-help">Restoring brings back that definition and moves any records its change had moved back to their days. The current version is saved first.</p>
      {revisions === null && !error && <SkeletonList rows={3} label="Loading versions…" />}
      {revisions?.length === 0 && <p className="cal-help">No earlier versions yet. One is saved every time the definition changes.</p>}
      <ul className="cal-revisions">
        {revisions?.map((r) => (
          <li key={r.id}>
            <span>
              Version {r.version} · {r.reason} · {new Date(r.createdAt).toLocaleString()}
            </span>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => restore(r.id)}>
              Restore
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
