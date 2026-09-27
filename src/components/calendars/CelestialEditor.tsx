"use client";

import { useState } from "react";
import { Archive, ArrowLeft, Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import ColorWheel from "@/components/ColorWheel";
import type { CalendarDefinition } from "@/server/calendars/engine";
import { celestialIssues, EIGHT_PHASES, normalizeSchedule, type CelestialConfig, type CelestialType } from "@/server/calendars/celestial";
import { api, newId } from "./api";
import { AppearanceSection, ExceptionsSection, PhasesSection, presetPhases } from "./CelestialSections";
import RevisionsList from "./RevisionsList";
import ArticleLinksSection from "./ArticleLinksSection";
import { CELESTIAL_TYPES, type CelestialTypeInfo } from "./celestial-types";
import type { ArticleRef, ClientCalendar, ClientCelestial } from "./types";

type TypeInfo = CelestialTypeInfo;
const TYPES = CELESTIAL_TYPES;

const SYMBOLS = ["☾", "○", "●", "◐", "☀", "★", "✦", "✧", "✶", "☄", "♁", "♃", "♄", "◈", "❂", "✺"];

type Tab = "general" | "behavior" | "exceptions" | "articles";

/** A sensible starting config for each type, so a new object does something right away. */
function starterConfig(type: CelestialType, today: number, calendars: ClientCalendar[]): CelestialConfig {
  if (type === "moon") {
    const phases = presetPhases(EIGHT_PHASES, 28) ?? [];
    return { phases, anchor: { worldDay: today, phaseId: phases[0]?.id ?? "" } };
  }
  if (type === "sun") return {};
  const visible = { id: newId("st"), name: "Visible", icon: TYPES.find((t) => t.type === type)!.symbol };
  if (type === "comet") return { states: [visible], schedules: [{ id: newId("sch"), stateId: visible.id, kind: "once", startWorldDay: today, duration: 14, repeatEvery: null }] };
  if (type === "constellation" && calendars[0]) {
    const month = calendars[0].definition.periods.find((p) => !p.condition)?.id ?? "";
    return { states: [visible], schedules: [{ id: newId("sch"), stateId: visible.id, kind: "annual", calendarId: calendars[0].id, start: { periodId: month, day: 1 }, end: { periodId: month, day: 1 } }] };
  }
  if (type === "custom") return {};
  return { states: [visible] };
}

/** Which calendars show the object: All (new ones included) or a chosen few. Ids of archived calendars are kept. */
function CalendarsSection({ calendars, value, onChange }: { calendars: ClientCalendar[]; value: string[] | null; onChange: (ids: string[] | null) => void }) {
  const all = value === null;
  const toggle = (id: string, on: boolean) => onChange(on ? [...(value ?? []), id] : (value ?? []).filter((x) => x !== id));
  return (
    <div className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>Shown in calendars</h3>
          <p className="cal-help">Its sky only appears in these calendars.</p>
        </div>
      </header>
      <label className="cel-toggle">
        <input type="checkbox" role="switch" checked={all} onChange={(e) => onChange(e.target.checked ? null : calendars.map((c) => c.id))} />
        <span className="cel-toggle-track" aria-hidden>
          <span className="cel-toggle-thumb" />
        </span>
        <span>
          <strong>All</strong>
          <span className="cal-help">Every calendar, including ones created later.</span>
        </span>
      </label>
      {!all && (
        <ul className="cel-calendar-list">
          {calendars.map((c) => (
            <li key={c.id}>
              <label className="cal-check">
                <input type="checkbox" checked={value.includes(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} />
                <span>{c.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {!all && value.length === 0 && (
        <p className="form-error" role="alert">
          Pick at least one calendar, or All.
        </p>
      )}
    </div>
  );
}

function TypeChooser({ calendarName, onPick }: { calendarName: string; onPick: (t: TypeInfo) => void }) {
  return (
    <div className="cel-types">
      <p className="cal-help">What kind of object is it? It&apos;s added to {calendarName}; you can show it in other calendars too.</p>
      <div className="cel-type-grid">
        {TYPES.map((t) => (
          <button key={t.type} type="button" className="cel-type-card" onClick={() => onPick(t)}>
            <span className="cel-type-icon" style={{ color: t.color }}>
              <t.Icon size={22} strokeWidth={1.75} />
            </span>
            <strong>{t.label}</strong>
            <span className="cal-help">{t.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Create or edit a celestial object. A new one belongs to the active calendar
 * (it can be shown in others, or all); dates are entered in the active one. Creating starts with a type chooser; the
 * form is split into tabs so each part stays short.
 */
export default function CelestialEditor({
  object,
  def,
  calendarId,
  today,
  calendars,
  onSaved,
  onClose,
}: {
  object: ClientCelestial | null;
  def: CalendarDefinition;
  /** The active calendar: a new object starts shown only there. */
  calendarId: string;
  today: number;
  calendars: ClientCalendar[];
  onSaved: (o: ClientCelestial) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<CelestialType | null>(object?.type ?? null);
  const [name, setName] = useState(object?.name ?? "");
  const [color, setColor] = useState(object?.color ?? "#E8E3D5");
  const [icon, setIcon] = useState(object?.icon ?? "");
  const [description, setDescription] = useState(object?.description ?? "");
  // Old "repeats on a cycle" rules open as the equivalent "On a date" rule (same days).
  const [config, setConfig] = useState<CelestialConfig>(() => (object?.config.schedules ? { ...object.config, schedules: object.config.schedules.map(normalizeSchedule) } : (object?.config ?? {})));
  const [links, setLinks] = useState<ArticleRef[]>(object?.articleLinks ?? []);
  const [showDayIcon, setShowDayIcon] = useState(object?.showDayIcon ?? true);
  const [prioritizeDayIcon, setPrioritizeDayIcon] = useState(object?.prioritizeDayIcon ?? false);
  const [calendarIds, setCalendarIds] = useState<string[] | null>(object ? object.calendarIds : [calendarId]);
  const [tab, setTab] = useState<Tab>("general");
  const [colorOpen, setColorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const info = TYPES.find((t) => t.type === type) ?? null;
  const title = object ? `Edit ${object.name}` : info ? `New ${info.label}` : "New Celestial Object";

  if (!type || !info) {
    return (
      <Modal open onClose={onClose} title={title} size="wide">
        <TypeChooser
          calendarName={calendars.find((c) => c.id === calendarId)?.name ?? "this calendar"}
          onPick={(t) => {
            setType(t.type);
            setIcon(t.symbol);
            setColor(t.color);
            setConfig(starterConfig(t.type, today, calendars));
          }}
        />
      </Modal>
    );
  }

  const isMoon = type === "moon";
  const issues = celestialIssues(type, config);
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "general", label: "General" },
    { key: "behavior", label: isMoon ? "Phases" : "Appearance" },
    { key: "exceptions", label: "Special dates", count: (config.overrides?.length ?? 0) + (config.segments?.length ?? 0) },
    { key: "articles", label: "Articles", count: links.length },
  ];

  async function remove() {
    if (!object) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await api("DELETE", `/api/celestial/${object.id}`);
    setDeleting(false);
    if (res.ok) {
      setConfirmDelete(false);
      onClose();
    } else setDeleteError(res.data.error ?? "Could not delete it.");
  }

  async function archive() {
    if (!object) return;
    const res = await api("PATCH", `/api/celestial/${object.id}`, { expectedVersion: object.version, archived: true });
    if (res.ok) {
      setConfirmDelete(false);
      onClose();
    } else setDeleteError(res.data.error ?? "Could not archive it.");
  }

  async function save() {
    if (!name.trim()) {
      setTab("general");
      setError("Give it a name.");
      return;
    }
    if (calendarIds !== null && calendarIds.length === 0) {
      setTab("general");
      setError("Pick at least one calendar to show it in, or All.");
      return;
    }
    setSaving(true);
    setError(null);
    const body = { name, color, icon, description, config, articleLinks: links, showDayIcon, prioritizeDayIcon, calendarIds };
    const res = object
      ? await api<{ object: ClientCelestial }>("PATCH", `/api/celestial/${object.id}`, { ...body, expectedVersion: object.version })
      : await api<{ object: ClientCelestial }>("POST", "/api/celestial", { ...body, type });
    setSaving(false);
    if (res.ok) onSaved(res.data.object);
    else setError(res.data.error ?? "Could not save.");
  }

  return (
    <Modal open onClose={onClose} title={title} size="wide">
      <div className="cel-editor">
        <div className="cel-hero">
          <button type="button" className="cel-badge" style={{ color, borderColor: color }} aria-label="Change color" onClick={() => {
              setTab("general");
              setColorOpen(true);
            }}>
            {icon || info.symbol}
          </button>
          <div className="cel-hero-text">
            <input type="text" className="cel-name-input" value={name} maxLength={80} autoFocus placeholder={`Name this ${info.label.toLowerCase()}`} aria-label="Name" onChange={(e) => setName(e.target.value)} />
            <span className="cel-type-pill">
              <info.Icon size={12} aria-hidden /> {info.label}
              {!object && (
                <button type="button" className="cel-change-type" onClick={() => setType(null)}>
                  <ArrowLeft size={12} aria-hidden /> change
                </button>
              )}
            </span>
          </div>
        </div>

        <nav className="cal-editor-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "cal-tab active" : "cal-tab"} onClick={() => setTab(t.key)}>
              {t.label}
              {t.count ? <span className="cel-tab-count">{t.count}</span> : null}
            </button>
          ))}
        </nav>

        <div className="cel-body" role="tabpanel">
          {tab === "general" && (
            <>
              <div className="cel-section">
                <header className="cel-section-head">
                  <div>
                    <h3>Symbol</h3>
                    <p className="cal-help">Shown on calendar days and in the sky list. Pick one or type your own.</p>
                  </div>
                </header>
                <div className="cel-symbols">
                  {SYMBOLS.map((s) => (
                    <button key={s} type="button" className={s === icon ? "cel-symbol active" : "cel-symbol"} style={s === icon ? { color } : undefined} aria-pressed={s === icon} onClick={() => setIcon(s)}>
                      {s}
                    </button>
                  ))}
                  <input type="text" className="cel-symbol-input" maxLength={4} value={icon} aria-label="Custom symbol" onChange={(e) => setIcon(e.target.value)} />
                </div>
                <label className="cel-toggle">
                  <input type="checkbox" role="switch" checked={showDayIcon} onChange={(e) => setShowDayIcon(e.target.checked)} />
                  <span className="cel-toggle-track" aria-hidden>
                    <span className="cel-toggle-thumb" />
                  </span>
                  <span>
                    <strong>Show mini-icon on calendar days</strong>
                    <span className="cal-help">Turn it off for something that&apos;s always there, like the sun. It still appears in each day&apos;s details.</span>
                  </span>
                </label>
                {showDayIcon && (
                  <label className="cel-toggle">
                    <input type="checkbox" role="switch" checked={prioritizeDayIcon} onChange={(e) => setPrioritizeDayIcon(e.target.checked)} />
                    <span className="cel-toggle-track" aria-hidden>
                      <span className="cel-toggle-thumb" />
                    </span>
                    <span>
                      <strong>Prioritize mini-icon</strong>
                      <span className="cal-help">Drawn first on calendar days, so it stays visible when a day is crowded. Several prioritized objects go in alphabetical order.</span>
                    </span>
                  </label>
                )}
              </div>
              <div className="cel-section">
                <header className="cel-section-head">
                  <div>
                    <h3>Color</h3>
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => setColorOpen(!colorOpen)}>
                    <span className="cal-swatch" style={{ background: color }} aria-hidden /> {colorOpen ? "Close color wheel" : "Change color"}
                  </button>
                </header>
                {colorOpen && (
                  <div className="cel-color-pop">
                    <ColorWheel value={color} onChange={setColor} />
                  </div>
                )}
              </div>
              <CalendarsSection calendars={calendars} value={calendarIds} onChange={setCalendarIds} />
              <label className="cel-section">
                <h3>Description</h3>
                <textarea rows={4} maxLength={4000} value={description} placeholder="What people know and believe about it." onChange={(e) => setDescription(e.target.value)} />
              </label>
              {object && <RevisionsList subjectType="celestial" subjectId={object.id} version={object.version} onRestored={() => onClose()} />}
            </>
          )}
          {tab === "behavior" && (isMoon ? <PhasesSection config={config} setConfig={setConfig} def={def} today={today} /> : <AppearanceSection config={config} setConfig={setConfig} def={def} calendarId={calendars.find((c) => c.definition === def)?.id ?? calendars[0]?.id ?? ""} today={today} calendars={calendars} />)}
          {tab === "exceptions" && <ExceptionsSection config={config} setConfig={setConfig} def={def} today={today} isMoon={isMoon} />}
          {tab === "articles" && <ArticleLinksSection links={links} onChange={setLinks} hint="Articles about this object: its myths, the gods tied to it, the cult that watches it…" />}
        </div>

        {issues.length > 0 && (
          <ul className="cal-issues" role="alert">
            {issues.map((i, n) => (
              <li key={n}>{i}</li>
            ))}
          </ul>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="cel-footer">
          {object && (
            <button type="button" className="btn btn-sm btn-danger cel-footer-delete" onClick={() => setConfirmDelete(true)} disabled={saving}>
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-sm btn-primary" disabled={saving || issues.length > 0} onClick={save}>
            {saving ? "Saving…" : object ? "Save" : `Create ${info.label.toLowerCase()}`}
          </button>
        </div>
      </div>
      {object && (
        <ConfirmDialog
          open={confirmDelete}
          title={`Delete ${object.name}?`}
          confirmLabel="Delete"
          busyLabel="Deleting…"
          busy={deleting}
          error={deleteError}
          onConfirm={remove}
          onCancel={() => {
            setConfirmDelete(false);
            setDeleteError(null);
          }}
        >
          <p>It disappears from every calendar of the world, with its phases, special dates and linked articles (the articles themselves stay).</p>
          <p>If an event repeats on its phases it can&apos;t be deleted; archive it instead to hide it everywhere and keep its history.</p>
          {deleteError && (
            <button type="button" className="btn btn-sm" onClick={archive}>
              <Archive size={14} /> Archive instead
            </button>
          )}
        </ConfirmDialog>
      )}
    </Modal>
  );
}
