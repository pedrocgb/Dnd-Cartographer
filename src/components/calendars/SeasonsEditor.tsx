"use client";

import { useState, type CSSProperties } from "react";
import { Archive, ArchiveRestore, Layers, Leaf, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import ColorWheel from "@/components/ColorWheel";
import { api } from "./api";
import { CalendarTabs, seasonsFor } from "./season-parts";
import type { ClientCalendar, ClientSeason, WorldCalendars } from "./types";
import { useT } from "@/i18n/useT";

const QUICK_COLORS = ["#7BC67B", "#58BF65", "#E8C547", "#F0A830", "#D9803F", "#BF6C92", "#C9706F", "#8FB8DE", "#6A90BF", "#B9A2E0", "#A7ADB5", "#E4E8EE"];
const QUICK_SYMBOLS = ["🌱", "🌸", "☀", "🌾", "🍂", "🍁", "❄", "☃", "🌧", "⛈", "🔥", "🌙", "✦", "◈"];

interface Draft {
  name: string;
  description: string;
  color: string;
  icon: string;
  calendarId: string | null;
}

const draftOf = (s: ClientSeason): Draft => ({ name: s.name, description: s.description, color: s.color, icon: s.icon, calendarId: s.calendarId });

/** Profiles (not archived) that use the season. */
const profilesUsing = (world: WorldCalendars, seasonId: string) => world.profiles.filter((p) => !p.archived && p.data.memberships.some((m) => m.seasonId === seasonId));

/** The open season's form: name and badge, color and symbol, description, which calendars can use it, and where it's used. */
function SeasonForm({
  world,
  calendar,
  season,
  onSaved,
  onDeleted,
  onOpenProfiles,
}: {
  world: WorldCalendars;
  calendar: ClientCalendar;
  season: ClientSeason | null;
  onSaved: (s: ClientSeason) => void;
  onDeleted: () => void;
  onOpenProfiles: () => void;
}) {
  const t = useT("calendars");
  const tc = useT("common");
  const [draft, setDraft] = useState<Draft>(season ? draftOf(season) : { name: "", description: "", color: QUICK_COLORS[0], icon: "", calendarId: calendar.id });
  // Remounts the wheel when the color is set from outside it (a quick swatch): it keeps its own state otherwise.
  const [wheelKey, setWheelKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const calendars = world.calendars.filter((c) => !c.trashed || c.id === calendar.id);
  const users = season ? profilesUsing(world, season.id) : [];
  const saved = season ? draftOf(season) : null;
  const changed = (Object.keys(draft) as (keyof Draft)[]).filter((k) => !saved || draft[k] !== saved[k]);

  async function save() {
    setSaving(true);
    setError(null);
    const body = Object.fromEntries(changed.map((k) => [k, draft[k]]));
    const res = season ? await api<{ season: ClientSeason }>("PATCH", `/api/seasons/${season.id}`, body) : await api<{ season: ClientSeason }>("POST", "/api/seasons", draft);
    setSaving(false);
    if (res.ok) onSaved(res.data.season);
    else setError(res.data.error ?? t("se.saveFailed"));
  }
  async function archive() {
    if (!season) return;
    setError(null);
    const res = await api<{ season: ClientSeason }>("PATCH", `/api/seasons/${season.id}`, { archived: !season.archived });
    if (res.ok) onSaved(res.data.season);
    else setError(res.data.error ?? t("se.saveFailed"));
  }
  async function remove() {
    if (!season) return;
    const res = await api("DELETE", `/api/seasons/${season.id}`);
    if (res.ok) {
      setConfirmDelete(false);
      onDeleted();
    } else setDeleteError(res.data.error ?? t("se.deleteFailed"));
  }
  function pickColor(hex: string) {
    set({ color: hex });
    setWheelKey((k) => k + 1);
  }

  return (
    <div className="sp-detail" style={{ "--season": draft.color } as CSSProperties}>
      <div className="sp-hero">
        <span className="sp-hero-badge" aria-hidden>
          {draft.icon || <Leaf size={26} />}
        </span>
        <div className="sp-hero-text">
          <input type="text" className="sp-hero-name" aria-label={t("se.nameAria")} value={draft.name} maxLength={80} placeholder={t("se.namePlaceholder")} autoFocus={!season} onChange={(e) => set({ name: e.target.value })} />
          <span className="sp-hero-meta">
            {season?.archived && <span className="cal-default-badge">{t("se.archived")}</span>}
            <span className="cal-help">{draft.calendarId ? t("se.only", { calendar: calendar.name }) : t("se.shared")}</span>
          </span>
        </div>
      </div>

      <section className="sp-block">
        <header className="sp-block-head">
          <h3>{t("se.appearance")}</h3>
          <p className="cal-help">{t("se.appearanceHelp")}</p>
        </header>
        <div className="sp-appearance">
          <div className="sp-picker-wheel">
            <ColorWheel key={wheelKey} value={draft.color} onChange={(color) => set({ color })} />
          </div>
          <div className="sp-picker-side">
            <div className="cal-fields">
              <span className="field-label">{t("se.quickColors")}</span>
              <div className="sp-swatches">
                {QUICK_COLORS.map((c) => {
                  const active = c.toLowerCase() === draft.color.toLowerCase();
                  return <button key={c} type="button" className={active ? "sp-swatch active" : "sp-swatch"} style={{ background: c }} aria-label={t("se.color", { color: c })} aria-pressed={active} onClick={() => pickColor(c)} />;
                })}
              </div>
            </div>
            <div className="cal-fields">
              <span className="field-label">{t("se.symbol")}</span>
              <div className="sp-symbols">
                {QUICK_SYMBOLS.map((x) => (
                  <button key={x} type="button" className={x === draft.icon ? "cel-symbol active" : "cel-symbol"} aria-pressed={x === draft.icon} aria-label={t("se.symbolAria", { symbol: x })} onClick={() => set({ icon: x === draft.icon ? "" : x })}>
                    {x}
                  </button>
                ))}
                <input type="text" className="cel-symbol-input" maxLength={4} value={draft.icon} aria-label={t("se.customSymbol")} placeholder="…" onChange={(e) => set({ icon: e.target.value })} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sp-block">
        <header className="sp-block-head">
          <h3>{t("se.about")}</h3>
        </header>
        <label className="cal-field">
          <span className="field-label">{t("se.description")}</span>
          <textarea rows={4} value={draft.description} maxLength={4000} placeholder={t("se.descriptionPlaceholder")} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <label className="cal-field">
          <span className="field-label">{t("se.availableTo")}</span>
          <select value={draft.calendarId ?? ""} onChange={(e) => set({ calendarId: e.target.value || null })}>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {t("se.only", { calendar: c.name })}
              </option>
            ))}
            <option value="">{t("se.shared")}</option>
          </select>
        </label>
      </section>

      {season && (
        <section className="sp-block">
          <header className="sp-block-head">
            <div>
              <h3>{t("se.usedIn")}</h3>
              <p className="cal-help">{t("se.usedInHelp")}</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenProfiles}>
              <Layers size={14} /> {t("se.profiles")}
            </button>
          </header>
          {users.length ? (
            <ul className="sp-chips">
              {users.map((p) => (
                <li key={p.id} className="sp-chip">
                  {p.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="cel-empty">{t("se.notInProfile")}</p>
          )}
        </section>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="cel-footer">
        {season && (
          <button type="button" className="btn btn-sm btn-danger cel-footer-delete" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} /> {tc("delete")}
          </button>
        )}
        {season && (
          <button type="button" className="btn btn-sm" onClick={archive}>
            {season.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />} {season.archived ? t("se.unarchive") : t("se.archive")}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-primary" disabled={saving || !draft.name.trim() || changed.length === 0} onClick={save}>
          {saving ? tc("saving") : season ? t("se.save") : t("se.create")}
        </button>
      </div>
      {season && (
        <ConfirmDialog
          open={confirmDelete}
          danger
          title={t("se.deleteTitle", { name: season.name })}
          confirmLabel={tc("delete")}
          error={deleteError}
          onConfirm={remove}
          onCancel={() => {
            setConfirmDelete(false);
            setDeleteError(null);
          }}
        >
          {t("se.deleteBody")}
        </ConfirmDialog>
      )}
    </div>
  );
}

/** One calendar's seasons: the list at the left, the open season's form at the right. */
function SeasonsPane({ world, calendar, initialId, onChanged, onOpenProfiles }: { world: WorldCalendars; calendar: ClientCalendar; initialId: string | null; onChanged: () => void; onOpenProfiles: () => void }) {
  const t = useT("calendars");
  // The season just saved, until the reloaded world data has it.
  const [fresh, setFresh] = useState<ClientSeason | null>(null);
  const mine = seasonsFor(fresh && !world.seasons.some((s) => s.id === fresh.id) ? [...world.seasons, fresh] : world.seasons, calendar.id);
  const [selected, setSelected] = useState<string | "new">(() => (mine.some((s) => s.id === initialId) ? initialId! : (mine.find((s) => !s.archived)?.id ?? "new")));
  const [showArchived, setShowArchived] = useState(() => Boolean(mine.find((s) => s.id === initialId)?.archived));
  const archivedCount = mine.filter((s) => s.archived).length;
  const shown = mine.filter((s) => showArchived || !s.archived || s.id === selected);
  // A season moved to another calendar (or deleted) leaves this list: fall back to the first one still here.
  const season = mine.find((s) => s.id === selected) ?? null;
  const current = selected === "new" || season ? selected : (shown.find((s) => !s.archived)?.id ?? "new");
  const open = mine.find((s) => s.id === current) ?? null;

  return (
    <div className="sp-split">
      <aside className="sp-list" aria-label={t("se.list")}>
        <div className="sp-list-items">
          {shown.map((s) => {
            const used = profilesUsing(world, s.id).length;
            return (
              <button
                key={s.id}
                type="button"
                aria-current={s.id === current}
                className={["sp-list-item", s.id === current && "active", s.archived && "archived"].filter(Boolean).join(" ")}
                style={{ "--season": s.color } as CSSProperties}
                onClick={() => setSelected(s.id)}
              >
                <span className="sp-list-badge" aria-hidden>
                  {s.icon}
                </span>
                <span className="sp-list-text">
                  <strong>{s.name}</strong>
                  <span className="cal-help">
                    {s.calendarId ? "" : t("se.sharedPrefix")}
                    {used ? t("se.profileCount", { count: used, n: used }) : t("se.notInProfileShort")}
                  </span>
                </span>
              </button>
            );
          })}
          {mine.length === 0 && <p className="cel-empty">{t("se.none", { calendar: calendar.name })}</p>}
        </div>
        <button type="button" className={current === "new" ? "sp-list-new active" : "sp-list-new"} onClick={() => setSelected("new")}>
          <Plus size={15} aria-hidden /> {t("se.new")}
        </button>
        {archivedCount > 0 && (
          <label className="cal-check sp-list-archived">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> {t("se.showArchived", { n: archivedCount })}
          </label>
        )}
      </aside>
      <div className="sp-pane">
        <SeasonForm
          key={current}
          world={world}
          calendar={calendar}
          season={open}
          onOpenProfiles={onOpenProfiles}
          onSaved={(s) => {
            setFresh(s);
            setSelected(s.id);
            onChanged();
          }}
          onDeleted={() => {
            setSelected("new");
            onChanged();
          }}
        />
      </div>
    </div>
  );
}

/** The named seasons of each calendar (one tab per calendar), and those shared by all. Their dates live in season profiles. `onChanged` reloads the world data. */
export default function SeasonsEditor({
  world,
  calendarId,
  seasonId = null,
  onChanged,
  onClose,
  onOpenProfiles,
}: {
  world: WorldCalendars;
  calendarId: string | null;
  /** Opens with this season selected. */
  seasonId?: string | null;
  onChanged: () => void;
  onClose: () => void;
  onOpenProfiles: (calendarId: string) => void;
}) {
  const t = useT("calendars");
  const calendars = world.calendars.filter((c) => !c.trashed);
  const [tab, setTab] = useState(calendars.find((c) => c.id === calendarId)?.id ?? calendars[0]?.id ?? null);
  const calendar = calendars.find((c) => c.id === tab) ?? null;
  return (
    <Modal open onClose={onClose} title={t("se.title")} size="wide" className="sp-modal">
      {!calendar ? (
        <p className="cal-help">{t("se.needCalendar")}</p>
      ) : (
        <div className="cel-editor">
          <p className="cal-help">{t("se.help")}</p>
          <CalendarTabs calendars={calendars} value={calendar.id} count={(c) => seasonsFor(world.seasons, c.id).filter((s) => !s.archived).length} onChange={setTab} />
          <SeasonsPane key={calendar.id} world={world} calendar={calendar} initialId={seasonId} onChanged={onChanged} onOpenProfiles={() => onOpenProfiles(calendar.id)} />
        </div>
      )}
    </Modal>
  );
}
