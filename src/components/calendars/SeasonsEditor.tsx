"use client";

import { useState, type CSSProperties } from "react";
import { Archive, ArchiveRestore, CalendarRange, Check, ListOrdered, Plus, Star, Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import ColorWheel from "@/components/ColorWheel";
import Toggle from "@/components/Toggle";
import { annualInterval } from "@/server/calendars/celestial";
import { activeSeasons, effectiveMemberships, profileIssues, type MonthDay, type SeasonMembership, type SeasonProfileData } from "@/server/calendars/seasons";
import { api, newId } from "./api";
import { periodsOf, safe, yearRange } from "./evaluate";
import RevisionsList from "./RevisionsList";
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

/** Seasons a calendar's profiles can use: its own and the shared ones. */
const seasonsFor = (seasons: ClientSeason[], calendarId: string) => seasons.filter((s) => s.calendarId === null || s.calendarId === calendarId);

const QUICK_COLORS = ["#7BC67B", "#58BF65", "#E8C547", "#F0A830", "#D9803F", "#BF6C92", "#C9706F", "#8FB8DE", "#6A90BF", "#B9A2E0", "#A7ADB5", "#E4E8EE"];
const QUICK_SYMBOLS = ["🌱", "🌸", "☀", "🌾", "🍂", "🍁", "❄", "☃", "🌧", "⛈", "🔥", "🌙", "✦", "◈"];

/** One season as a card: color/symbol badge, name, description, which calendar it belongs to, and where it's used. */
function SeasonCard({ season, calendars, usedBy, onPatch, onDelete }: { season: ClientSeason; calendars: ClientCalendar[]; usedBy: string[]; onPatch: (body: Record<string, unknown>) => void; onDelete: () => void }) {
  const [picking, setPicking] = useState(false);
  const [color, setColor] = useState(season.color);
  const [icon, setIcon] = useState(season.icon);
  // Remounts the wheel when the color is set from outside it (a quick swatch, Cancel): it keeps its own state otherwise.
  const [wheelKey, setWheelKey] = useState(0);

  function closePicker() {
    setPicking(false);
    if (color !== season.color || icon !== season.icon) onPatch({ color, icon });
  }
  function cancelPicker() {
    setPicking(false);
    setColor(season.color);
    setIcon(season.icon);
    setWheelKey((k) => k + 1);
  }
  function pickColor(hex: string) {
    setColor(hex);
    setWheelKey((k) => k + 1);
  }

  const className = ["sp-season-card", season.archived && "archived", picking && "picking"].filter(Boolean).join(" ");
  return (
    <article className={className} style={{ "--season": color } as CSSProperties}>
      <div className="sp-season-top">
        <button type="button" className="sp-season-badge" aria-label={`Color and symbol of ${season.name}`} aria-expanded={picking} onClick={() => (picking ? closePicker() : setPicking(true))}>
          {icon}
        </button>
        <input type="text" className="sp-season-name" aria-label="Season name" defaultValue={season.name} maxLength={80} onBlur={(e) => e.target.value.trim() && e.target.value !== season.name && onPatch({ name: e.target.value })} />
        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={season.archived ? `Unarchive ${season.name}` : `Archive ${season.name}`} data-tooltip={season.archived ? "Unarchive" : "Archive"} onClick={() => onPatch({ archived: !season.archived })}>
          {season.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
        </button>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Delete ${season.name}`} data-tooltip="Delete" onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      </div>
      {picking && (
        <div className="sp-season-picker">
          <div className="sp-picker-wheel">
            <span className="field-label">Color</span>
            <ColorWheel key={wheelKey} value={color} onChange={setColor} />
          </div>
          <div className="sp-picker-side">
            <div className="cal-fields">
              <span className="field-label">Quick colors</span>
              <div className="sp-swatches">
                {QUICK_COLORS.map((c) => (
                  <button key={c} type="button" className={c.toLowerCase() === color.toLowerCase() ? "sp-swatch active" : "sp-swatch"} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={c.toLowerCase() === color.toLowerCase()} onClick={() => pickColor(c)} />
                ))}
              </div>
            </div>
            <div className="cal-fields">
              <span className="field-label">Symbol</span>
              <div className="sp-symbols">
                {QUICK_SYMBOLS.map((x) => (
                  <button key={x} type="button" className={x === icon ? "cel-symbol active" : "cel-symbol"} aria-pressed={x === icon} onClick={() => setIcon(x === icon ? "" : x)}>
                    {x}
                  </button>
                ))}
                <input type="text" className="cel-symbol-input" maxLength={4} value={icon} aria-label="Custom symbol" placeholder="…" onChange={(e) => setIcon(e.target.value)} />
              </div>
            </div>
            <div className="sp-picker-actions">
              <button type="button" className="btn btn-sm" onClick={cancelPicker}>
                Cancel
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={closePicker}>
                <Check size={14} /> Done
              </button>
            </div>
          </div>
        </div>
      )}
      <textarea className="sp-season-description" rows={4} aria-label={`${season.name} description`} placeholder="What this season is like…" defaultValue={season.description} maxLength={4000} onBlur={(e) => e.target.value !== season.description && onPatch({ description: e.target.value })} />
      <footer className="sp-season-foot">
        <span className="cal-help">{usedBy.length ? `In ${usedBy.join(", ")}` : "Not in a profile yet"}</span>
        <select aria-label={`Calendar of ${season.name}`} value={season.calendarId ?? ""} onChange={(e) => onPatch({ calendarId: e.target.value || null })}>
          {calendars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} only
            </option>
          ))}
          <option value="">Shared by all calendars</option>
        </select>
      </footer>
    </article>
  );
}

function SeasonsSection({ world, calendar, onChanged }: { world: WorldCalendars; calendar: ClientCalendar; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [deleting, setDeleting] = useState<ClientSeason | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const mine = seasonsFor(world.seasons, calendar.id);
  const archivedCount = mine.filter((s) => s.archived).length;
  const shown = mine.filter((s) => showArchived || !s.archived);
  const calendars = world.calendars.filter((c) => !c.archived || c.id === calendar.id);
  const usedBy = (id: string) => world.profiles.filter((p) => !p.archived && p.data.memberships.some((m) => m.seasonId === id)).map((p) => p.name);

  async function patch(id: string, body: Record<string, unknown>) {
    setError(null);
    const res = await api("PATCH", `/api/seasons/${id}`, body);
    if (res.ok) onChanged();
    else setError(res.data.error ?? "Could not save the season.");
  }
  async function remove() {
    if (!deleting) return;
    const res = await api("DELETE", `/api/seasons/${deleting.id}`);
    if (res.ok) {
      setDeleting(null);
      onChanged();
    } else setDeleteError(res.data.error ?? "Could not delete the season.");
  }
  async function create() {
    setError(null);
    const res = await api("POST", "/api/seasons", { name: `Season ${mine.length + 1}`, calendarId: calendar.id });
    if (res.ok) onChanged();
    else setError(res.data.error ?? "Could not create the season.");
  }

  return (
    <section className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>Seasons</h3>
          <p className="cal-help">The named seasons of {calendar.name}. Their dates are set in each profile below.</p>
        </div>
        {archivedCount > 0 && (
          <label className="cal-check">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived ({archivedCount})
          </label>
        )}
      </header>
      <div className="sp-season-grid">
        {shown.map((s) => (
          <SeasonCard key={`${s.id}:${s.color}:${s.icon}`} season={s} calendars={calendars} usedBy={usedBy(s.id)} onPatch={(body) => patch(s.id, body)} onDelete={() => setDeleting(s)} />
        ))}
        <button type="button" className="sp-add-card" onClick={create}>
          <Plus size={18} aria-hidden />
          <span>Add season</span>
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {deleting && (
        <ConfirmDialog
          open
          danger
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete"
          error={deleteError}
          onConfirm={remove}
          onCancel={() => {
            setDeleting(null);
            setDeleteError(null);
          }}
        >
          It&apos;s removed for good. A season a profile still uses can&apos;t be deleted: archive it instead.
        </ConfirmDialog>
      )}
    </section>
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

function ProfileForm({ world, calendar, profile, onSaved, onDeleted }: { world: WorldCalendars; calendar: ClientCalendar; profile: ClientProfile | null; onSaved: (p: ClientProfile) => void; onDeleted: () => void }) {
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
    <div className="sp-profile-form">
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

      <div className="cal-fields">
        <span className="field-label">How seasons end</span>
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
      </div>

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
      {data.memberships.length === 0 && <p className="cal-help">No seasons in this profile yet. Add the first one, then pick the day it starts.</p>}
      <div>
        <button
          type="button"
          className="btn btn-sm"
          disabled={seasons.length === 0}
          onClick={() => setData({ ...data, memberships: [...data.memberships, { id: newId("sm"), seasonId: seasons[0].id, start: { periodId: firstMonth, day: 1 }, end: data.mode === "manual" ? { periodId: firstMonth, day: 1 } : null }] })}
        >
          <Plus size={14} /> Add a season to this profile
        </button>
        {seasons.length === 0 && <p className="cal-help">Create a season above first.</p>}
      </div>
      {data.memberships.length > 0 && <ProfileStrip calendar={calendar} data={data} seasons={world.seasons} />}
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

function ProfilesSection({ world, calendar, onChanged }: { world: WorldCalendars; calendar: ClientCalendar; onChanged: () => void }) {
  const profiles = world.profiles.filter((p) => p.data.calendarId === calendar.id);
  const [profileId, setProfileId] = useState<string | "new" | null>(profiles.find((p) => !p.archived)?.id ?? profiles[0]?.id ?? null);
  const profile = profiles.find((p) => p.id === profileId) ?? null;
  return (
    <section className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>Profiles</h3>
          <p className="cal-help">When each season starts and ends, read in {calendar.name}. Regions pick a profile in their own article (the Season Profile field).</p>
        </div>
      </header>
      <div className="sp-profile-list" role="tablist" aria-label="Profiles">
        {profiles.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={p.id === profileId} className={["sp-profile-card", p.id === profileId && "active", p.archived && "archived"].filter(Boolean).join(" ")} onClick={() => setProfileId(p.id)}>
            <span className="sp-profile-title">
              <strong>{p.name}</strong>
              {p.isDefault && (
                <span className="cal-default-badge">
                  <Star size={11} aria-hidden /> Default
                </span>
              )}
              {p.archived && <span className="cal-default-badge">Archived</span>}
            </span>
            <ProfileStrip calendar={calendar} data={p.data} seasons={world.seasons} compact />
          </button>
        ))}
        <button type="button" role="tab" aria-selected={profileId === "new"} className={profileId === "new" ? "sp-profile-card sp-profile-new active" : "sp-profile-card sp-profile-new"} onClick={() => setProfileId("new")}>
          <Plus size={16} aria-hidden /> New profile
        </button>
      </div>
      {(profile || profileId === "new") && (
        <ProfileForm
          key={profileId ?? "none"}
          world={world}
          calendar={calendar}
          profile={profile}
          onSaved={(p) => {
            setProfileId(p.id);
            onChanged();
          }}
          onDeleted={() => {
            setProfileId(null);
            onChanged();
          }}
        />
      )}
    </section>
  );
}

/** Authoring for each calendar's seasons and season profiles (one tab per calendar). `onChanged` reloads the world data. */
export default function SeasonsEditor({ world, calendarId, onChanged, onClose }: { world: WorldCalendars; calendarId: string | null; onChanged: () => void; onClose: () => void }) {
  const calendars = world.calendars.filter((c) => !c.archived);
  const [tab, setTab] = useState(calendars.find((c) => c.id === calendarId)?.id ?? calendars[0]?.id ?? null);
  const calendar = calendars.find((c) => c.id === tab) ?? null;
  const count = (c: ClientCalendar) => world.profiles.filter((p) => !p.archived && p.data.calendarId === c.id).length;
  return (
    <Modal open onClose={onClose} title="Seasons & Profiles" size="wide">
      {!calendar ? (
        <p className="cal-help">Create a calendar first: seasons and profiles belong to one.</p>
      ) : (
        <div className="cel-editor">
          {calendars.length > 1 && (
            <nav className="cal-editor-tabs" role="tablist" aria-label="Calendar">
              {calendars.map((c) => (
                <button key={c.id} type="button" role="tab" aria-selected={c.id === tab} className={c.id === tab ? "cal-tab active" : "cal-tab"} onClick={() => setTab(c.id)}>
                  {c.name}
                  {count(c) ? <span className="cel-tab-count">{count(c)}</span> : null}
                </button>
              ))}
            </nav>
          )}
          <div className="cel-body" key={calendar.id}>
            <SeasonsSection world={world} calendar={calendar} onChanged={onChanged} />
            <ProfilesSection world={world} calendar={calendar} onChanged={onChanged} />
          </div>
        </div>
      )}
    </Modal>
  );
}
