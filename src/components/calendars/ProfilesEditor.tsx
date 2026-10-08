"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, CalendarRange, Leaf, ListOrdered, Plus, Star, Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import Toggle from "@/components/Toggle";
import { annualInterval } from "@/server/calendars/celestial";
import { activeSeasons, effectiveMemberships, profileIssues, type MonthDay, type SeasonMembership, type SeasonProfileData } from "@/server/calendars/seasons";
import { api, newId } from "./api";
import { periodsOf, safe, yearRange } from "./evaluate";
import RevisionsList from "./RevisionsList";
import { CalendarTabs, seasonsFor } from "./season-parts";
import type { ClientCalendar, ClientProfile, ClientSeason, WorldCalendars } from "./types";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";
import { problemText } from "@/server/calendars/engine";

/** A yearly date (month, then day) in the profile's calendar. Only months that exist every year are offered. */
function MonthDayInput({ calendar, value, onChange, label }: { calendar: ClientCalendar; value: MonthDay; onChange: (v: MonthDay) => void; label: string }) {
  const t = useT("calendars");
  const periods = calendar.definition.periods.filter((p) => !p.condition);
  const period = periods.find((p) => p.id === value.periodId);
  return (
    <span className="cal-monthday">
      <select aria-label={t("date.monthAria", { label })} value={value.periodId} onChange={(e) => onChange({ periodId: e.target.value, day: Math.min(value.day, periods.find((p) => p.id === e.target.value)?.days ?? 1) })}>
        {!period && <option value={value.periodId}>{t("pe.notEveryYear")}</option>}
        {periods.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select aria-label={t("date.dayAria", { label })} className="cal-monthday-day" value={value.day} onChange={(e) => onChange({ ...value, day: Number(e.target.value) })}>
        {Array.from({ length: Math.max(period?.days ?? 1, value.day) }, (_, i) => (
          <option key={i} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </select>
    </span>
  );
}

const monthDayLabel = (calendar: ClientCalendar, md: MonthDay) => `${calendar.definition.periods.find((p) => p.id === md.periodId)?.name ?? "?"} ${md.day}`;

/** "45 days" (", into the next year" when it wraps) for start..end in the calendar's reference year; the whole year when `start` is null. */
function seasonLength(calendar: ClientCalendar, start: MonthDay | null, end: MonthDay): string {
  const t = activeT("calendars");
  const def = calendar.definition;
  const year = def.sync.date.year;
  const whole = yearRange(def, year);
  if (!whole) return "";
  if (!start) return t("pe.wholeYearDays", { n: whole[1] - whole[0] + 1 });
  const interval = safe(() => annualInterval(def, year, start, end), null);
  if (!interval) return "";
  const days = interval[1] - interval[0] + 1;
  const length = t("pe.length", { count: days, n: days });
  return interval[1] > whole[1] ? t("pe.intoNextYear", { length }) : length;
}

/** A year strip of the profile's seasons in its reference calendar (evaluated day by day, bounded to one year). */
function ProfileStrip({ calendar, data, seasons, compact = false }: { calendar: ClientCalendar; data: SeasonProfileData; seasons: ClientSeason[]; compact?: boolean }) {
  const t = useT("calendars");
  const year = calendar.definition.sync.date.year;
  const range = yearRange(calendar.definition, year);
  if (!range || range[1] - range[0] > 3000) return null;
  const days: string[][] = [];
  for (let d = range[0]; d <= range[1]; d++) days.push(safe(() => activeSeasons(calendar.definition, data, d), []));
  const strip = (
    <div className={compact ? "cal-season-strip compact" : "cal-season-strip"} aria-hidden>
      {days.map((ids, i) => (
        <span key={i} style={{ background: ids.length ? (seasons.find((s) => s.id === ids[0])?.color ?? "var(--border-default)") : "transparent", opacity: ids.length > 1 ? 0.6 : 1 }} />
      ))}
    </div>
  );
  if (compact) return strip;
  return (
    <div className="cal-fields">
      <span className="field-label">{t("pe.yearPreview", { year })}</span>
      {strip}
      <div className="cal-season-months" aria-hidden>
        {periodsOf(calendar.definition, year).map((p) => (
          <span key={p.period.id} style={{ flexGrow: p.days }}>
            {p.period.short || p.period.name}
          </span>
        ))}
      </div>
    </div>
  );
}

const MODES = [
  { mode: "sequential", Icon: ListOrdered },
  { mode: "manual", Icon: CalendarRange },
] as const;

function ProfileForm({
  world,
  calendar,
  profile,
  onSaved,
  onDeleted,
  onOpenSeasons,
}: {
  world: WorldCalendars;
  calendar: ClientCalendar;
  profile: ClientProfile | null;
  onSaved: (p: ClientProfile) => void;
  onDeleted: () => void;
  onOpenSeasons: () => void;
}) {
  const t = useT("calendars");
  const tc = useT("common");
  const seasons = seasonsFor(world.seasons, calendar.id).filter((s) => !s.archived || profile?.data.memberships.some((m) => m.seasonId === s.id));
  const [name, setName] = useState(profile?.name ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [data, setData] = useState<SeasonProfileData>(profile?.data ?? { calendarId: calendar.id, mode: "sequential", allowGaps: false, allowOverlaps: false, memberships: [] });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const seasonName = (id: string) => world.seasons.find((s) => s.id === id)?.name ?? t("pe.removedSeason");
  const issues = safe(() => profileIssues(calendar.definition, data, seasonName), []);
  const setMember = (id: string, patch: Partial<SeasonMembership>) => setData({ ...data, memberships: data.memberships.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const ends = safe(() => effectiveMemberships(calendar.definition, data), []);
  const firstMonth = calendar.definition.periods.find((p) => !p.condition)?.id ?? "";

  async function save() {
    setSaving(true);
    setError(null);
    const body = { name, description, calendarId: data.calendarId, data };
    const res = profile ? await api<{ profile: ClientProfile }>("PATCH", `/api/season-profiles/${profile.id}`, { ...body, expectedVersion: profile.version }) : await api<{ profile: ClientProfile }>("POST", "/api/season-profiles", body);
    setSaving(false);
    if (res.ok) onSaved(res.data.profile);
    else setError(res.data.error ?? t("pe.saveFailed"));
  }
  async function simple(body: Record<string, unknown>) {
    if (!profile) return;
    const res = await api<{ profile: ClientProfile }>("PATCH", `/api/season-profiles/${profile.id}`, { ...body, expectedVersion: profile.version });
    if (res.ok) onSaved(res.data.profile);
    else setError(res.data.error ?? t("pe.saveFailed"));
  }
  async function remove() {
    if (!profile) return;
    const res = await api("DELETE", `/api/season-profiles/${profile.id}`);
    if (res.ok) {
      setConfirmDelete(false);
      onDeleted();
    } else setDeleteError(res.data.error ?? t("pe.deleteFailed"));
  }
  function chooseMode(mode: SeasonProfileData["mode"]) {
    if (mode === data.mode) return;
    if (mode === "sequential") setData({ ...data, mode });
    else setData({ ...data, mode, memberships: data.memberships.map((m) => ({ ...m, end: m.end ?? ends.find((e) => e.id === m.id)?.end ?? m.start })) });
  }

  return (
    <div className="sp-detail">
      <div className="sp-profile-fields">
        <label className="cal-field">
          <span className="field-label">{t("pe.name")}</span>
          <input type="text" value={name} maxLength={80} placeholder={t("pe.namePlaceholder")} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="cal-field">
          <span className="field-label">{t("se.description")}</span>
          <textarea rows={2} value={description} maxLength={4000} placeholder={t("pe.descriptionPlaceholder")} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>

      <section className="sp-block">
        <header className="sp-block-head">
          <h3>{t("pe.timing")}</h3>
          <p className="cal-help">{t("pe.timingHelp")}</p>
        </header>
        <div className="sp-mode-grid" role="radiogroup" aria-label={t("pe.howEnd")}>
          {MODES.map((m) => (
            <button key={m.mode} type="button" role="radio" aria-checked={data.mode === m.mode} className={data.mode === m.mode ? "sp-mode-card active" : "sp-mode-card"} onClick={() => chooseMode(m.mode)}>
              <m.Icon size={18} aria-hidden />
              <strong>{t(`pe.mode.${m.mode}`)}</strong>
              <span className="cal-help">{t(`pe.mode.${m.mode}Detail`)}</span>
            </button>
          ))}
        </div>
        {data.mode === "manual" && (
          <div className="sp-toggles">
            <Toggle checked={data.allowGaps} onChange={(allowGaps) => setData({ ...data, allowGaps })} label={t("pe.allowGaps")} />
            <Toggle checked={data.allowOverlaps} onChange={(allowOverlaps) => setData({ ...data, allowOverlaps })} label={t("pe.allowOverlaps")} />
          </div>
        )}
      </section>

      <section className="sp-block">
        <header className="sp-block-head">
          <div>
            <h3>{t("pe.inProfile")}</h3>
            <p className="cal-help">{t("pe.readIn", { calendar: calendar.name })}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenSeasons}>
            <Leaf size={14} /> {t("pe.manage")}
          </button>
        </header>
      {data.memberships.length > 0 && (
        <div className="cal-season-table" role="table" aria-label={t("pe.inProfile")}>
          <div className="cal-season-row cal-season-head" role="row">
            <span role="columnheader">{t("pe.col.season")}</span>
            <span role="columnheader">{t("pe.col.starts")}</span>
            <span role="columnheader">{t("pe.col.ends")}</span>
            <span role="columnheader">{t("pe.col.length")}</span>
            <span />
          </div>
          {(data.mode === "sequential" ? ends : data.memberships).map((m, i, list) => {
            const end = ends.find((e) => e.id === m.id)?.end ?? m.end ?? m.start;
            const season = world.seasons.find((x) => x.id === m.seasonId);
            const next = data.mode === "sequential" && list.length > 1 ? list[(i + 1) % list.length] : null;
            const wholeYear = Boolean(m.allYear) || (data.mode === "sequential" && list.length === 1);
            return (
              <div key={m.id} className="cal-season-row" role="row">
                <span className="cal-season-name" role="cell">
                  <span className="cal-swatch" style={{ background: season?.color }} aria-hidden />
                  <select aria-label={t("pe.col.season")} value={m.seasonId} onChange={(e) => setMember(m.id, { seasonId: e.target.value })}>
                    {!seasons.some((x) => x.id === m.seasonId) && <option value={m.seasonId}>{t("pe.otherCalendar", { name: seasonName(m.seasonId) })}</option>}
                    {seasons.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </span>
                {wholeYear ? (
                  <span role="cell" className="cal-season-span">
                    {t("pe.wholeYear")}
                  </span>
                ) : (
                  <>
                    <span role="cell">
                      <MonthDayInput calendar={calendar} label={t("pe.startsAria", { season: season?.name ?? t("pe.col.season") })} value={m.start} onChange={(start) => setMember(m.id, { start })} />
                    </span>
                    <span role="cell">
                      {data.mode === "manual" ? (
                        <MonthDayInput calendar={calendar} label={t("pe.endsAria", { season: season?.name ?? t("pe.col.season") })} value={m.end ?? m.start} onChange={(value) => setMember(m.id, { end: value })} />
                      ) : (
                        <span className="cal-season-derived">
                          {monthDayLabel(calendar, end)}
                          {next && <span className="cal-help">{t("pe.dayBefore", { season: seasonName(next.seasonId) })}</span>}
                        </span>
                      )}
                    </span>
                  </>
                )}
                <span role="cell" className="cal-season-length">
                  {seasonLength(calendar, wholeYear ? null : m.start, end)}
                </span>
                <span role="cell" className="cal-season-actions">
                  {data.mode === "manual" && (
                    <label className="cal-check" data-tooltip={t("pe.allYearHint")}>
                      <input type="checkbox" checked={Boolean(m.allYear)} onChange={(e) => setMember(m.id, { allYear: e.target.checked })} /> {t("pe.allYear")}
                    </label>
                  )}
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("pe.remove", { season: season?.name ?? t("pe.seasonLower") })} onClick={() => setData({ ...data, memberships: data.memberships.filter((x) => x.id !== m.id) })}>
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {data.memberships.length === 0 && <p className="cel-empty">{t("pe.none")}</p>}
      <div className="sp-add-row">
        <button
          type="button"
          className="btn btn-sm"
          disabled={seasons.length === 0}
          onClick={() => setData({ ...data, memberships: [...data.memberships, { id: newId("sm"), seasonId: seasons[0].id, start: { periodId: firstMonth, day: 1 }, end: data.mode === "manual" ? { periodId: firstMonth, day: 1 } : null }] })}
        >
          <Plus size={14} /> {t("pe.add")}
        </button>
        {seasons.length === 0 && <span className="cal-help">{t("pe.noSeasons")}</span>}
      </div>
      {data.memberships.length > 0 && <ProfileStrip calendar={calendar} data={data} seasons={world.seasons} />}
      </section>
      {issues.length > 0 && (
        <ul className="cal-issues" role="alert">
          {issues.map((i, n) => (
            <li key={n}>{problemText(i.problem)}</li>
          ))}
        </ul>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {profile && <RevisionsList subjectType="profile" subjectId={profile.id} version={profile.version} onRestored={onDeleted} />}
      <div className="cel-footer">
        {profile && (
          <button type="button" className="btn btn-sm btn-danger cel-footer-delete" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} /> {tc("delete")}
          </button>
        )}
        {profile && (
          <button type="button" className="btn btn-sm" onClick={() => simple({ archived: !profile.archived })}>
            {profile.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />} {profile.archived ? t("se.unarchive") : t("se.archive")}
          </button>
        )}
        {profile && !profile.isDefault && (
          <button type="button" className="btn btn-sm" onClick={() => simple({ isDefault: true })}>
            <Star size={14} /> {t("pe.makeDefault")}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-primary" disabled={saving || !name.trim() || issues.length > 0} onClick={save}>
          {saving ? tc("saving") : profile ? t("pe.save") : t("pe.create")}
        </button>
      </div>
      {profile && (
        <ConfirmDialog
          open={confirmDelete}
          danger
          title={t("se.deleteTitle", { name: profile.name })}
          confirmLabel={tc("delete")}
          error={deleteError}
          onConfirm={remove}
          onCancel={() => {
            setConfirmDelete(false);
            setDeleteError(null);
          }}
        >
          {t("pe.deleteBody")}
        </ConfirmDialog>
      )}
    </div>
  );
}

/** One calendar's profiles: the list at the left, the open profile's form at the right. */
function ProfilesPane({ world, calendar, onChanged, onOpenSeasons }: { world: WorldCalendars; calendar: ClientCalendar; onChanged: () => void; onOpenSeasons: () => void }) {
  const t = useT("calendars");
  // The profile just saved, until the reloaded world data has it.
  const [fresh, setFresh] = useState<ClientProfile | null>(null);
  const profiles = (fresh && !world.profiles.some((p) => p.id === fresh.id) ? [...world.profiles, fresh] : world.profiles).filter((p) => p.data.calendarId === calendar.id);
  const [selected, setSelected] = useState<string | "new" | null>(profiles.find((p) => !p.archived)?.id ?? profiles[0]?.id ?? "new");
  const profile = profiles.find((p) => p.id === selected) ?? null;
  const count = (p: ClientProfile) => new Set(p.data.memberships.map((m) => m.seasonId)).size;
  return (
    <div className="sp-split">
      <aside className="sp-list" aria-label={t("pe.list")}>
        <div className="sp-list-items">
          {profiles.map((p) => (
            <button key={p.id} type="button" aria-current={p.id === selected} className={["sp-list-item sp-list-profile", p.id === selected && "active", p.archived && "archived"].filter(Boolean).join(" ")} onClick={() => setSelected(p.id)}>
              <span className="sp-list-text">
                <span className="sp-list-title">
                  <strong>{p.name}</strong>
                  {p.isDefault && (
                    <span className="cal-default-badge">
                      <Star size={11} aria-hidden /> {t("sv.default")}
                    </span>
                  )}
                  {p.archived && <span className="cal-default-badge">{t("pe.archivedBadge")}</span>}
                </span>
                <span className="cal-help">{count(p) ? t("pe.seasonCount", { count: count(p), n: count(p) }) : t("pe.noSeasonsYet")}</span>
              </span>
              <ProfileStrip calendar={calendar} data={p.data} seasons={world.seasons} compact />
            </button>
          ))}
          {profiles.length === 0 && <p className="cel-empty">{t("pe.noProfiles", { calendar: calendar.name })}</p>}
        </div>
        <button type="button" className={selected === "new" ? "sp-list-new active" : "sp-list-new"} onClick={() => setSelected("new")}>
          <Plus size={15} aria-hidden /> {t("pe.new")}
        </button>
      </aside>
      <div className="sp-pane">
        {profile || selected === "new" ? (
          <ProfileForm
            key={selected ?? "none"}
            world={world}
            calendar={calendar}
            profile={profile}
            onOpenSeasons={onOpenSeasons}
            onSaved={(p) => {
              setFresh(p);
              setSelected(p.id);
              onChanged();
            }}
            onDeleted={() => {
              setSelected(null);
              onChanged();
            }}
          />
        ) : (
          <p className="cel-empty">{t("pe.pick")}</p>
        )}
      </div>
    </div>
  );
}

/** Season profiles of each calendar (one tab per calendar): when each season starts and ends. `onChanged` reloads the world data. */
export default function ProfilesEditor({ world, calendarId, onChanged, onClose, onOpenSeasons }: { world: WorldCalendars; calendarId: string | null; onChanged: () => void; onClose: () => void; onOpenSeasons: (calendarId: string) => void }) {
  const t = useT("calendars");
  const calendars = world.calendars.filter((c) => !c.trashed);
  const [tab, setTab] = useState(calendars.find((c) => c.id === calendarId)?.id ?? calendars[0]?.id ?? null);
  const calendar = calendars.find((c) => c.id === tab) ?? null;
  return (
    <Modal open onClose={onClose} title={t("pe.title")} size="wide" className="sp-modal">
      {!calendar ? (
        <p className="cal-help">{t("pe.needCalendar")}</p>
      ) : (
        <div className="cel-editor">
          <p className="cal-help">{t("pe.help")}</p>
          <CalendarTabs calendars={calendars} value={calendar.id} count={(c) => world.profiles.filter((p) => !p.archived && p.data.calendarId === c.id).length} onChange={setTab} />
          <ProfilesPane key={calendar.id} world={world} calendar={calendar} onChanged={onChanged} onOpenSeasons={() => onOpenSeasons(calendar.id)} />
        </div>
      )}
    </Modal>
  );
}
