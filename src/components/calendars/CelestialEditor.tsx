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
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";
import { problemText } from "@/server/calendars/engine";

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
  const visible = { id: newId("st"), name: activeT("calendars")("default.visible"), icon: TYPES.find((t) => t.type === type)!.symbol };
  if (type === "comet") return { states: [visible], schedules: [{ id: newId("sch"), stateId: visible.id, kind: "once", startWorldDay: today, duration: 14, repeatEvery: null }] };
  if (type === "constellation" && calendars[0]) {
    const month = calendars[0].definition.periods.find((p) => !p.condition)?.id ?? "";
    return { states: [visible], schedules: [{ id: newId("sch"), stateId: visible.id, kind: "annual", calendarId: calendars[0].id, start: { periodId: month, day: 1 }, end: { periodId: month, day: 1 } }] };
  }
  if (type === "custom") return {};
  return { states: [visible] };
}

/** Which calendars show the object: All (new ones included) or a chosen few. Ids of trashed calendars are kept. */
function CalendarsSection({ calendars, value, onChange }: { calendars: ClientCalendar[]; value: string[] | null; onChange: (ids: string[] | null) => void }) {
  const t = useT("calendars");
  const all = value === null;
  const toggle = (id: string, on: boolean) => onChange(on ? [...(value ?? []), id] : (value ?? []).filter((x) => x !== id));
  return (
    <div className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>{t("cel.shownIn")}</h3>
          <p className="cal-help">{t("cel.shownInHelp")}</p>
        </div>
      </header>
      <label className="cel-toggle">
        <input type="checkbox" role="switch" checked={all} onChange={(e) => onChange(e.target.checked ? null : calendars.map((c) => c.id))} />
        <span className="cel-toggle-track" aria-hidden>
          <span className="cel-toggle-thumb" />
        </span>
        <span>
          <strong>{t("cel.all")}</strong>
          <span className="cal-help">{t("cel.allHelp")}</span>
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
          {t("cel.pickCalendars")}
        </p>
      )}
    </div>
  );
}

function TypeChooser({ calendarName, onPick }: { calendarName: string; onPick: (t: TypeInfo) => void }) {
  const t = useT("calendars");
  return (
    <div className="cel-types">
      <p className="cal-help">{t("cel.whatKind", { calendar: calendarName })}</p>
      <div className="cel-type-grid">
        {TYPES.map((x) => (
          <button key={x.type} type="button" className="cel-type-card" onClick={() => onPick(x)}>
            <span className="cel-type-icon" style={{ color: x.color }}>
              <x.Icon size={22} strokeWidth={1.75} />
            </span>
            <strong>{x.label}</strong>
            <span className="cal-help">{x.detail}</span>
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
  const t = useT("calendars");
  const tc = useT("common");
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

  const info = TYPES.find((x) => x.type === type) ?? null;
  const title = object ? t("cel.editTitle", { name: object.name }) : info ? t("cel.newTitle", { type: info.label }) : t("cel.newObject");

  if (!type || !info) {
    return (
      <Modal open onClose={onClose} title={title} size="wide">
        <TypeChooser
          calendarName={calendars.find((c) => c.id === calendarId)?.name ?? t("cel.thisCalendar")}
          onPick={(x) => {
            setType(x.type);
            setIcon(x.symbol);
            setColor(x.color);
            setConfig(starterConfig(x.type, today, calendars));
          }}
        />
      </Modal>
    );
  }

  const isMoon = type === "moon";
  const issues = celestialIssues(type, config);
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "general", label: t("cel.tab.general") },
    { key: "behavior", label: isMoon ? t("cel.tab.phases") : t("cel.tab.appearance") },
    { key: "exceptions", label: t("cel.tab.exceptions"), count: (config.overrides?.length ?? 0) + (config.segments?.length ?? 0) },
    { key: "articles", label: t("cel.tab.articles"), count: links.length },
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
    } else setDeleteError(res.data.error ?? t("cel.deleteFailed"));
  }

  async function archive() {
    if (!object) return;
    const res = await api("PATCH", `/api/celestial/${object.id}`, { expectedVersion: object.version, archived: true });
    if (res.ok) {
      setConfirmDelete(false);
      onClose();
    } else setDeleteError(res.data.error ?? t("cel.archiveFailed"));
  }

  async function save() {
    if (!name.trim()) {
      setTab("general");
      setError(t("cel.nameRequired"));
      return;
    }
    if (calendarIds !== null && calendarIds.length === 0) {
      setTab("general");
      setError(t("cel.calendarsRequired"));
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
    else setError(res.data.error ?? t("cel.saveFailed"));
  }

  return (
    <Modal open onClose={onClose} title={title} size="wide">
      <div className="cel-editor">
        <div className="cel-hero">
          <button type="button" className="cel-badge" style={{ color, borderColor: color }} aria-label={t("cel.changeColor")} onClick={() => {
              setTab("general");
              setColorOpen(true);
            }}>
            {icon || info.symbol}
          </button>
          <div className="cel-hero-text">
            <input type="text" className="cel-name-input" value={name} maxLength={80} autoFocus placeholder={t("cel.namePlaceholder", { type: info.label.toLowerCase() })} aria-label={t("cel.name")} onChange={(e) => setName(e.target.value)} />
            <span className="cel-type-pill">
              <info.Icon size={12} aria-hidden /> {info.label}
              {!object && (
                <button type="button" className="cel-change-type" onClick={() => setType(null)}>
                  <ArrowLeft size={12} aria-hidden /> {t("cel.changeType")}
                </button>
              )}
            </span>
          </div>
        </div>

        <nav className="cal-editor-tabs" role="tablist">
          {tabs.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={tab === x.key} className={tab === x.key ? "cal-tab active" : "cal-tab"} onClick={() => setTab(x.key)}>
              {x.label}
              {x.count ? <span className="cel-tab-count">{x.count}</span> : null}
            </button>
          ))}
        </nav>

        <div className="cel-body" role="tabpanel">
          {tab === "general" && (
            <>
              <div className="cel-section">
                <header className="cel-section-head">
                  <div>
                    <h3>{t("cel.symbol")}</h3>
                    <p className="cal-help">{t("cel.symbolHelp")}</p>
                  </div>
                </header>
                <div className="cel-symbols">
                  {SYMBOLS.map((s) => (
                    <button key={s} type="button" className={s === icon ? "cel-symbol active" : "cel-symbol"} style={s === icon ? { color } : undefined} aria-pressed={s === icon} onClick={() => setIcon(s)}>
                      {s}
                    </button>
                  ))}
                  <input type="text" className="cel-symbol-input" maxLength={4} value={icon} aria-label={t("cel.customSymbol")} onChange={(e) => setIcon(e.target.value)} />
                </div>
                <label className="cel-toggle">
                  <input type="checkbox" role="switch" checked={showDayIcon} onChange={(e) => setShowDayIcon(e.target.checked)} />
                  <span className="cel-toggle-track" aria-hidden>
                    <span className="cel-toggle-thumb" />
                  </span>
                  <span>
                    <strong>{t("cel.showDayIcon")}</strong>
                    <span className="cal-help">{t("cel.showDayIconHelp")}</span>
                  </span>
                </label>
                {showDayIcon && (
                  <label className="cel-toggle">
                    <input type="checkbox" role="switch" checked={prioritizeDayIcon} onChange={(e) => setPrioritizeDayIcon(e.target.checked)} />
                    <span className="cel-toggle-track" aria-hidden>
                      <span className="cel-toggle-thumb" />
                    </span>
                    <span>
                      <strong>{t("cel.prioritize")}</strong>
                      <span className="cal-help">{t("cel.prioritizeHelp")}</span>
                    </span>
                  </label>
                )}
              </div>
              <div className="cel-section">
                <header className="cel-section-head">
                  <div>
                    <h3>{t("cel.color")}</h3>
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => setColorOpen(!colorOpen)}>
                    <span className="cal-swatch" style={{ background: color }} aria-hidden /> {colorOpen ? t("cel.closeWheel") : t("cel.changeColor")}
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
                <h3>{t("cel.description")}</h3>
                <textarea rows={4} maxLength={4000} value={description} placeholder={t("cel.descriptionPlaceholder")} onChange={(e) => setDescription(e.target.value)} />
              </label>
              {object && <RevisionsList subjectType="celestial" subjectId={object.id} version={object.version} onRestored={() => onClose()} />}
            </>
          )}
          {tab === "behavior" && (isMoon ? <PhasesSection config={config} setConfig={setConfig} def={def} today={today} /> : <AppearanceSection config={config} setConfig={setConfig} def={def} calendarId={calendars.find((c) => c.definition === def)?.id ?? calendars[0]?.id ?? ""} today={today} calendars={calendars} />)}
          {tab === "exceptions" && <ExceptionsSection config={config} setConfig={setConfig} def={def} today={today} isMoon={isMoon} />}
          {tab === "articles" && <ArticleLinksSection links={links} onChange={setLinks} hint={t("cel.articlesHint")} />}
        </div>

        {issues.length > 0 && (
          <ul className="cal-issues" role="alert">
            {issues.map((i, n) => (
              <li key={n}>{problemText(i)}</li>
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
              <Trash2 size={14} /> {tc("delete")}
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={saving}>
            {tc("cancel")}
          </button>
          <button type="button" className="btn btn-sm btn-primary" disabled={saving || issues.length > 0} onClick={save}>
            {saving ? tc("saving") : object ? tc("save") : t("cel.create", { type: info.label.toLowerCase() })}
          </button>
        </div>
      </div>
      {object && (
        <ConfirmDialog
          open={confirmDelete}
          title={t("cel.deleteTitle", { name: object.name })}
          confirmLabel={tc("delete")}
          busyLabel={tc("deleting")}
          busy={deleting}
          error={deleteError}
          onConfirm={remove}
          onCancel={() => {
            setConfirmDelete(false);
            setDeleteError(null);
          }}
        >
          <p>{t("cel.deleteBody")}</p>
          <p>{t("cel.deleteBlocked")}</p>
          {deleteError && (
            <button type="button" className="btn btn-sm" onClick={archive}>
              <Archive size={14} /> {t("cel.archiveInstead")}
            </button>
          )}
        </ConfirmDialog>
      )}
    </Modal>
  );
}
