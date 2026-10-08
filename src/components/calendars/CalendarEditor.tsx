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
import { formatRealDate } from "@/server/settings/date-format";
import { activeSettings } from "@/server/settings/active";
import { worldKey } from "@/components/world-key";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";
import { revisionReason } from "./revision-reason";

const TABS = [{ key: "basics" }, { key: "weekdays" }, { key: "months" }, { key: "year" }, { key: "sync" }] as const;
type Tab = (typeof TABS)[number]["key"];

interface Draft {
  name: string;
  description: string;
  definition: CalendarDefinition;
}

/** A 7-day, 12-month calendar; its default names are written in the active language. */
function starterDefinition(currentDay: number): CalendarDefinition {
  const t = activeT("calendars");
  const weekdays = Array.from({ length: 7 }, (_, i) => ({ id: newId("wd"), name: t("default.weekday", { n: i + 1 }), short: "" }));
  const periods = Array.from({ length: 12 }, (_, i) => ({ id: newId("mo"), name: t("default.month", { n: i + 1 }), short: "", kind: "month" as const, days: 30, inWeek: true, condition: null }));
  const date = { year: 1, periodId: periods[0].id, day: 1 };
  return { weekdays, weekReset: "continuous", weekAnchor: { date, weekdayId: weekdays[0].id }, periods, leapRules: [], year: { hasYearZero: false, suffix: "" }, sync: { date, worldDay: currentDay } };
}

const draftKey = (id: string | null) => worldKey(`calendar-draft:${id ?? "new"}`);

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
  const t = useT("calendars");
  const tc = useT("common");
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
  const others = world.calendars.filter((c) => c.id !== id && !c.trashed);
  const tabIndex = TABS.findIndex((x) => x.key === tab);

  async function save(migration?: MigrationChoice) {
    if (!draft.name.trim()) {
      setTab("basics");
      setError(t("editor.nameRequired"));
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
    setError(data.error ?? t("editor.saveFailed"));
  }

  function close() {
    onClose();
  }

  return (
    <Modal open onClose={close} title={creating ? t("editor.newTitle") : t("editor.editTitle", { name: calendar!.name })} size="wide">
      <div className="cal-editor">
        {showRestored && (
          <div className="cal-banner">
            {t("editor.restored")}
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
              {t("editor.discard")}
            </button>
          </div>
        )}
        <div className="cal-editor-tabs" role="tablist">
          {TABS.map(({ key }) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "cal-tab active" : "cal-tab"} onClick={() => setTab(key)}>
              {t(`editor.tab.${key}`)}
            </button>
          ))}
          <label className="cal-check cal-advanced-toggle">
            <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
            {t("editor.advanced")}
          </label>
        </div>
        <div className="cal-editor-body">
          <div className="cal-editor-form" role="tabpanel">
            {tab === "basics" && (
              <div className="cal-fields">
                <label className="cal-field">
                  <span className="field-label">{tc("name")}</span>
                  <input type="text" value={draft.name} maxLength={80} autoFocus placeholder={t("editor.namePlaceholder")} onChange={(e) => update({ name: e.target.value })} />
                </label>
                <label className="cal-field">
                  <span className="field-label">{t("editor.description")}</span>
                  <textarea rows={4} value={draft.description} maxLength={4000} placeholder={t("editor.descriptionPlaceholder")} onChange={(e) => update({ description: e.target.value })} />
                </label>
                {!creating && (
                  <button type="button" className="btn btn-sm" onClick={() => setRevisionsOpen(true)}>
                    <History size={14} /> {t("revisions.title")}
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
            {tc("cancel")}
          </button>
          <span className="cal-spacer" />
          {creating && tabIndex > 0 && (
            <button type="button" className="btn btn-sm" onClick={() => setTab(TABS[tabIndex - 1].key)}>
              {t("editor.back")}
            </button>
          )}
          {creating && tabIndex < TABS.length - 1 ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setTab(TABS[tabIndex + 1].key)}>
              {t("editor.next")}
            </button>
          ) : (
            <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => save()}>
              {saving ? tc("saving") : creating ? t("editor.create") : t("editor.saveChanges")}
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
  const t = useT("calendars");
  const [refId, setRefId] = useState(others[0]?.id ?? "");
  const ref = others.find((c) => c.id === refId) ?? null;
  const refDate = ref ? localOf(ref.definition, def.sync.worldDay) : null;
  const current = world.chronology.currentDay;

  if (!ref) {
    return (
      <div className="cal-fields">
        <p className="cal-help">{creating ? t("sync.firstHelp") : t("sync.help")}</p>
        <DateInput def={def} label={creating ? t("sync.todayIs") : t("sync.onWorldDay", { n: def.sync.worldDay })} value={def.sync.date} onChange={(date) => onChange({ ...def, sync: { date, worldDay: creating ? current : def.sync.worldDay } })} />
      </div>
    );
  }
  return (
    <div className="cal-fields">
      <p className="cal-help">{t("sync.matchHelp")}</p>
      <DateInput def={def} label={t("sync.thisDate")} value={def.sync.date} onChange={(date) => onChange({ ...def, sync: { ...def.sync, date } })} />
      <label className="cal-field">
        <span className="field-label">{t("sync.sameDayAs")}</span>
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
        {validateDefinition(def).length === 0
          ? t("sync.currentBoth", { date: dayLabel(ref.definition, current), calendar: ref.name, here: dayLabel(def, current) })
          : t("sync.current", { date: dayLabel(ref.definition, current), calendar: ref.name })}
      </p>
    </div>
  );
}

function RevisionsDialog({ calendar, onClose, onRestored }: { calendar: ClientCalendar; onClose: () => void; onRestored: (c: ClientCalendar) => void }) {
  const t = useT("calendars");
  const tc = useT("common");
  const [revisions, setRevisions] = useState<{ id: string; version: number; reason: string; createdAt: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ revisions: { id: string; version: number; reason: string; createdAt: string }[] }>("GET", `/api/calendars/${calendar.id}/revisions`).then((res) => {
      if (cancelled) return;
      if (res.ok) setRevisions(res.data.revisions);
      else setError(res.data.error ?? activeT("calendars")("revisions.loadFailed"));
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
    else setError(res.data.error ?? t("revisions.restoreFailed"));
  }

  return (
    <Modal open onClose={onClose} title={t("revisions.title")}>
      <p className="cal-help">{t("revisions.help")}</p>
      {revisions === null && !error && <SkeletonList rows={3} label={t("revisions.loading")} />}
      {revisions?.length === 0 && <p className="cal-help">{t("revisions.none")}</p>}
      <ul className="cal-revisions">
        {revisions?.map((r) => (
          <li key={r.id}>
            <span>
              {t("revisions.row", { version: r.version, reason: revisionReason(r.reason), date: formatRealDate(r.createdAt, activeSettings().realDateFormat, { withTime: true }) })}
            </span>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => restore(r.id)}>
              {tc("restore")}
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
