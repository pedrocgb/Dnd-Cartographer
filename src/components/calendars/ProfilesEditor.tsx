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

/** A yearly date (month, then day) in the profile's calendar. Only months that exist every year are offered. */
function MonthDayInput({ calendar, value, onChange, label }: { calendar: ClientCalendar; value: MonthDay; onChange: (v: MonthDay) => void; label: string }) {
  const periods = calendar.definition.periods.filter((p) => !p.condition);
  const period = periods.find((p) => p.id === value.periodId);
  return (
    <span className="cal-monthday">
      <select aria-label={`${label}: month`} value={value.periodId} onChange={(e) => onChange({ periodId: e.target.value, day: Math.min(value.day, periods.find((p) => p.id === e.target.value)?.days ?? 1) })}>
        {!period && <option value={value.periodId}>(not every year)</option>}
        {periods.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select aria-label={`${label}: day`} className="cal-monthday-day" value={value.day} onChange={(e) => onChange({ ...value, day: Number(e.target.value) })}>
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
  const def = calendar.definition;
  const year = def.sync.date.year;
  const whole = yearRange(def, year);
  if (!whole) return "";
  if (!start) return `${whole[1] - whole[0] + 1} days`;
  const interval = safe(() => annualInterval(def, year, start, end), null);
  if (!interval) return "";
  const days = interval[1] - interval[0] + 1;
  return `${days} day${days === 1 ? "" : "s"}${interval[1] > whole[1] ? ", into the next year" : ""}`;
}

/** A year strip of the profile's seasons in its reference calendar (evaluated day by day, bounded to one year). */
function ProfileStrip({ calendar, data, seasons, compact = false }: { calendar: ClientCalendar; data: SeasonProfileData; seasons: ClientSeason[]; compact?: boolean }) {
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
      <span className="field-label">Year {year} preview</span>
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
  { mode: "sequential", Icon: ListOrdered, label: "One after another", detail: "Pick only the day each season starts; it lasts until the next one begins." },
  { mode: "manual", Icon: CalendarRange, label: "Custom dates", detail: "Pick the first and last day of each season; gaps or overlaps only if you allow them." },
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
  const seasons = seasonsFor(world.seasons, calendar.id).filter((s) => !s.archived || profile?.data.memberships.some((m) => m.seasonId === s.id));
  const [name, setName] = useState(profile?.name ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [data, setData] = useState<SeasonProfileData>(profile?.data ?? { calendarId: calendar.id, mode: "sequential", allowGaps: false, allowOverlaps: false, memberships: [] });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const seasonName = (id: string) => world.seasons.find((s) => s.id === id)?.name ?? "A removed season";
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
    else setError(res.data.error ?? "Could not save the profile.");
  }
  async function simple(body: Record<string, unknown>) {
    if (!profile) return;
    const res = await api<{ profile: ClientProfile }>("PATCH", `/api/season-profiles/${profile.id}`, { ...body, expectedVersion: profile.version });
    if (res.ok) onSaved(res.data.profile);
    else setError(res.data.error ?? "Could not save the profile.");
  }
  async function remove() {
    if (!profile) return;
    const res = await api("DELETE", `/api/season-profiles/${profile.id}`);
    if (res.ok) {
      setConfirmDelete(false);
      onDeleted();
    } else setDeleteError(res.data.error ?? "Could not delete the profile.");
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
          <span className="field-label">Profile name</span>
          <input type="text" value={name} maxLength={80} placeholder="e.g. Northern Climate" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="cal-field">
          <span className="field-label">Description</span>
          <textarea rows={2} value={description} maxLength={4000} placeholder="Where it applies, what makes it different…" onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>

      <section className="sp-block">
        <header className="sp-block-head">
          <h3>Timing</h3>
          <p className="cal-help">How each season&apos;s last day is decided.</p>
        </header>
        <div className="sp-mode-grid" role="radiogroup" aria-label="How seasons end">
          {MODES.map((m) => (
            <button key={m.mode} type="button" role="radio" aria-checked={data.mode === m.mode} className={data.mode === m.mode ? "sp-mode-card active" : "sp-mode-card"} onClick={() => chooseMode(m.mode)}>
              <m.Icon size={18} aria-hidden />
              <strong>{m.label}</strong>
              <span className="cal-help">{m.detail}</span>
            </button>
          ))}
        </div>
        {data.mode === "manual" && (
          <div className="sp-toggles">
            <Toggle checked={data.allowGaps} onChange={(allowGaps) => setData({ ...data, allowGaps })} label="Allow days with no season" />
            <Toggle checked={data.allowOverlaps} onChange={(allowOverlaps) => setData({ ...data, allowOverlaps })} label="Allow overlapping seasons" />
          </div>
        )}
      </section>

      <section className="sp-block">
        <header className="sp-block-head">
          <div>
            <h3>Seasons in this profile</h3>
            <p className="cal-help">Dates are read in {calendar.name}.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenSeasons}>
            <Leaf size={14} /> Manage seasons
          </button>
        </header>
      {data.memberships.length > 0 && (
        <div className="cal-season-table" role="table" aria-label="Seasons in this profile">
          <div className="cal-season-row cal-season-head" role="row">
            <span role="columnheader">Season</span>
            <span role="columnheader">Starts on</span>
            <span role="columnheader">Ends on</span>
            <span role="columnheader">Length</span>
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
                  <select aria-label="Season" value={m.seasonId} onChange={(e) => setMember(m.id, { seasonId: e.target.value })}>
                    {!seasons.some((x) => x.id === m.seasonId) && <option value={m.seasonId}>{seasonName(m.seasonId)} (another calendar)</option>}
                    {seasons.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </span>
                {wholeYear ? (
                  <span role="cell" className="cal-season-span">
                    The whole year
                  </span>
                ) : (
                  <>
                    <span role="cell">
                      <MonthDayInput calendar={calendar} label={`${season?.name ?? "Season"} starts`} value={m.start} onChange={(start) => setMember(m.id, { start })} />
                    </span>
                    <span role="cell">
                      {data.mode === "manual" ? (
                        <MonthDayInput calendar={calendar} label={`${season?.name ?? "Season"} ends`} value={m.end ?? m.start} onChange={(value) => setMember(m.id, { end: value })} />
                      ) : (
                        <span className="cal-season-derived">
                          {monthDayLabel(calendar, end)}
                          {next && <span className="cal-help">the day before {seasonName(next.seasonId)} starts</span>}
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
                    <label className="cal-check" data-tooltip="This season lasts the whole year">
                      <input type="checkbox" checked={Boolean(m.allYear)} onChange={(e) => setMember(m.id, { allYear: e.target.checked })} /> All year
                    </label>
                  )}
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${season?.name ?? "season"} from this profile`} onClick={() => setData({ ...data, memberships: data.memberships.filter((x) => x.id !== m.id) })}>
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {data.memberships.length === 0 && <p className="cel-empty">No seasons in this profile yet. Add the first one, then pick the day it starts.</p>}
      <div className="sp-add-row">
        <button
          type="button"
          className="btn btn-sm"
          disabled={seasons.length === 0}
          onClick={() => setData({ ...data, memberships: [...data.memberships, { id: newId("sm"), seasonId: seasons[0].id, start: { periodId: firstMonth, day: 1 }, end: data.mode === "manual" ? { periodId: firstMonth, day: 1 } : null }] })}
        >
          <Plus size={14} /> Add a season to this profile
        </button>
        {seasons.length === 0 && <span className="cal-help">This calendar has no seasons yet: create them in Manage seasons.</span>}
      </div>
      {data.memberships.length > 0 && <ProfileStrip calendar={calendar} data={data} seasons={world.seasons} />}
      </section>
      {issues.length > 0 && (
        <ul className="cal-issues" role="alert">
          {issues.map((i, n) => (
            <li key={n}>{i.message}</li>
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
            <Trash2 size={14} /> Delete
          </button>
        )}
        {profile && (
          <button type="button" className="btn btn-sm" onClick={() => simple({ archived: !profile.archived })}>
            {profile.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />} {profile.archived ? "Unarchive" : "Archive"}
          </button>
        )}
        {profile && !profile.isDefault && (
          <button type="button" className="btn btn-sm" onClick={() => simple({ isDefault: true })}>
            <Star size={14} /> Make default
          </button>
        )}
        <button type="button" className="btn btn-sm btn-primary" disabled={saving || !name.trim() || issues.length > 0} onClick={save}>
          {saving ? "Saving…" : profile ? "Save profile" : "Create profile"}
        </button>
      </div>
      {profile && (
        <ConfirmDialog
          open={confirmDelete}
          danger
          title={`Delete ${profile.name}?`}
          confirmLabel="Delete"
          error={deleteError}
          onConfirm={remove}
          onCancel={() => {
            setConfirmDelete(false);
            setDeleteError(null);
          }}
        >
          The profile is removed for good. Regions whose article uses it will have no seasons.
        </ConfirmDialog>
      )}
    </div>
  );
}

/** One calendar's profiles: the list at the left, the open profile's form at the right. */
function ProfilesPane({ world, calendar, onChanged, onOpenSeasons }: { world: WorldCalendars; calendar: ClientCalendar; onChanged: () => void; onOpenSeasons: () => void }) {
  // The profile just saved, until the reloaded world data has it.
  const [fresh, setFresh] = useState<ClientProfile | null>(null);
  const profiles = (fresh && !world.profiles.some((p) => p.id === fresh.id) ? [...world.profiles, fresh] : world.profiles).filter((p) => p.data.calendarId === calendar.id);
  const [selected, setSelected] = useState<string | "new" | null>(profiles.find((p) => !p.archived)?.id ?? profiles[0]?.id ?? "new");
  const profile = profiles.find((p) => p.id === selected) ?? null;
  const count = (p: ClientProfile) => new Set(p.data.memberships.map((m) => m.seasonId)).size;
  return (
    <div className="sp-split">
      <aside className="sp-list" aria-label="Profiles">
        <div className="sp-list-items">
          {profiles.map((p) => (
            <button key={p.id} type="button" aria-current={p.id === selected} className={["sp-list-item sp-list-profile", p.id === selected && "active", p.archived && "archived"].filter(Boolean).join(" ")} onClick={() => setSelected(p.id)}>
              <span className="sp-list-text">
                <span className="sp-list-title">
                  <strong>{p.name}</strong>
                  {p.isDefault && (
                    <span className="cal-default-badge">
                      <Star size={11} aria-hidden /> Default
                    </span>
                  )}
                  {p.archived && <span className="cal-default-badge">Archived</span>}
                </span>
                <span className="cal-help">{count(p) ? `${count(p)} season${count(p) === 1 ? "" : "s"}` : "No seasons yet"}</span>
              </span>
              <ProfileStrip calendar={calendar} data={p.data} seasons={world.seasons} compact />
            </button>
          ))}
          {profiles.length === 0 && <p className="cel-empty">No profiles for {calendar.name} yet.</p>}
        </div>
        <button type="button" className={selected === "new" ? "sp-list-new active" : "sp-list-new"} onClick={() => setSelected("new")}>
          <Plus size={15} aria-hidden /> New profile
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
          <p className="cel-empty">Pick a profile, or start a new one.</p>
        )}
      </div>
    </div>
  );
}

/** Season profiles of each calendar (one tab per calendar): when each season starts and ends. `onChanged` reloads the world data. */
export default function ProfilesEditor({ world, calendarId, onChanged, onClose, onOpenSeasons }: { world: WorldCalendars; calendarId: string | null; onChanged: () => void; onClose: () => void; onOpenSeasons: (calendarId: string) => void }) {
  const calendars = world.calendars.filter((c) => !c.trashed);
  const [tab, setTab] = useState(calendars.find((c) => c.id === calendarId)?.id ?? calendars[0]?.id ?? null);
  const calendar = calendars.find((c) => c.id === tab) ?? null;
  return (
    <Modal open onClose={onClose} title="Season profiles" size="wide" className="sp-modal">
      {!calendar ? (
        <p className="cal-help">Create a calendar first: season profiles belong to one.</p>
      ) : (
        <div className="cel-editor">
          <p className="cal-help">When each season starts and ends. Regions pick a profile in their own article (the Season Profile field).</p>
          <CalendarTabs calendars={calendars} value={calendar.id} count={(c) => world.profiles.filter((p) => !p.archived && p.data.calendarId === c.id).length} onChange={setTab} />
          <ProfilesPane key={calendar.id} world={world} calendar={calendar} onChanged={onChanged} onOpenSeasons={() => onOpenSeasons(calendar.id)} />
        </div>
      )}
    </Modal>
  );
}
