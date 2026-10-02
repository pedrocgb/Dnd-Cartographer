"use client";

import { useState, type CSSProperties } from "react";
import { Book, CalendarDays, Globe2, Map as MapIcon, Pencil, Plus, Swords, Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSettings } from "@/components/settings/SettingsProvider";
import { api } from "@/components/calendars/api";
import { formatRealDate } from "@/server/settings/date-format";
import { formatInteger } from "@/server/settings/number-format";
import LoadingScreen from "@/components/LoadingScreen";
import ColorWheel from "@/components/ColorWheel";
import IconPicker from "@/components/IconPicker";
import { RawIcon } from "@/components/MarkerIcon";
import SegmentedControl from "@/components/marker-panel/SegmentedControl";
import type { WorldSummary } from "@/server/world/worlds";

const NAME_MAX = 80;
const DESCRIPTION_MAX = 4000;

/** Goes to the newly opened world with a full page load, so nothing the previous world left in memory (caches, drafts) carries over. */
function enterWorld() {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load is the point here
  window.location.assign("/maps");
}

/** The world being opened: shown full screen until the next page takes over. */
type Opening = Pick<WorldSummary, "id" | "name" | "icon" | "color">;

/** A stable hue per world, for its automatic color. */
function hueOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** "#RRGGBB" for hsl(h, 55%, 50%). */
function hueHex(h: number): string {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = 0.5 - 0.275 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/** The world's tint: its chosen color, or one picked from its id. */
const worldColor = (w: Pick<WorldSummary, "id" | "color">) => w.color || hueHex(hueOf(w.id));
const tint = (w: Pick<WorldSummary, "id" | "color">) => ({ "--world-color": worldColor(w) }) as CSSProperties;

/** What the round badge shows: the chosen icon, else the name's first letter. */
function BadgeContent({ world, size }: { world: Pick<WorldSummary, "name" | "icon">; size: number }) {
  if (world.icon) return <RawIcon iconKey={world.icon} size={size} strokeWidth={2} />;
  return <>{world.name.trim().charAt(0).toUpperCase() || <Globe2 size={size} />}</>;
}

/** "Opening <world>…": the world's badge over the same progress bar as a map being prepared. */
function WorldOpening({ world }: { world: Opening }) {
  return (
    <div className="world-opening" style={tint(world)}>
      <LoadingScreen message={`Opening ${world.name}…`}>
        <span className="world-opening-badge" aria-hidden>
          <BadgeContent world={world} size={36} />
        </span>
      </LoadingScreen>
    </div>
  );
}

const QUICK_COLORS = ["#C9706F", "#D9803F", "#E8C547", "#7BC67B", "#47BFAB", "#5BA8D9", "#6A7FD9", "#9B7BD9", "#BF6C92", "#A7ADB5"];
const BADGE_SEGMENTS = [
  { key: "letter", label: "First letter" },
  { key: "icon", label: "Icon" },
] as const;

/** Name, description, badge icon and color, for a new world or an existing one, with a live preview of its card. */
function WorldForm({ world, onClose, onSaved, onEntering }: { world: WorldSummary | null; onClose: () => void; onSaved: () => void; onEntering: (w: Opening) => void }) {
  const [name, setName] = useState(world?.name ?? "");
  const [description, setDescription] = useState(world?.description ?? "");
  const [icon, setIcon] = useState(world?.icon ?? "");
  const [badge, setBadge] = useState<"letter" | "icon">(world?.icon ? "icon" : "letter");
  const [color, setColor] = useState(world?.color ?? "");
  // Remounts the wheel when the color is set from outside it (a swatch, Automatic): it keeps its own state otherwise.
  const [wheelKey, setWheelKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A new world has no id yet: its automatic color follows its name until it's created.
  const previewId = world?.id ?? (name.trim() || "new");
  const shownIcon = badge === "icon" ? icon : "";
  const preview = { id: previewId, name: name || "New world", icon: shownIcon, color };

  function pickColor(hex: string) {
    setColor(hex);
    setWheelKey((k) => k + 1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { name, description, icon: shownIcon, color };
    const res = world ? await api("PATCH", `/api/worlds/${world.id}`, body) : await api<{ world: Opening }>("POST", "/api/worlds", body);
    if (!res.ok) {
      setBusy(false);
      setError(res.data.error ?? "Could not save the world.");
      return;
    }
    // A new world opens right away (the server set it as this browser's world).
    if (world) onSaved();
    else {
      onEntering((res.data as { world: Opening }).world);
      enterWorld();
    }
  }

  return (
    <Modal open onClose={() => !busy && onClose()} title={world ? `Edit ${world.name}` : "New world"} size="wide">
      <form className="world-form" onSubmit={submit}>
        <div className="world-form-columns">
          <div className="world-form-main">
            <div className="world-form-preview" style={tint(preview)} aria-hidden>
              <span className="world-card-banner">
                <span className="world-card-initial">
                  <BadgeContent world={preview} size={24} />
                </span>
              </span>
              <span className="world-form-preview-name">{preview.name}</span>
            </div>
            {!world && <p className="world-form-intro">A new world starts empty: its own maps, articles, calendars and campaigns.</p>}
            <label className="world-form-field">
              <span className="field-label">Name</span>
              <input type="text" value={name} maxLength={NAME_MAX} placeholder="e.g. The Shattered Isles" autoFocus onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="world-form-field">
              <span className="field-label">Description</span>
              <textarea rows={5} value={description} maxLength={DESCRIPTION_MAX} placeholder="What this world is: its tone, its campaign, who plays in it…" onChange={(e) => setDescription(e.target.value)} />
            </label>
          </div>

          <div className="world-form-side">
            <section className="world-form-block">
              <div className="world-form-block-head">
                <span className="field-label">Badge</span>
                <SegmentedControl ariaLabel="Badge" value={badge} segments={BADGE_SEGMENTS} onChange={setBadge} />
              </div>
              {badge === "icon" ? (
                <div className="world-form-icons">
                  <IconPicker value={icon} onChange={setIcon} />
                </div>
              ) : (
                <p className="cal-help">The circle shows the first letter of the name. Choose Icon to pick a symbol instead.</p>
              )}
            </section>

            <section className="world-form-block">
              <div className="world-form-block-head">
                <span className="field-label">Color</span>
                <button type="button" className={color ? "world-auto-color" : "world-auto-color active"} aria-pressed={!color} onClick={() => pickColor("")}>
                  Automatic
                </button>
              </div>
              <div className="sp-swatches">
                {QUICK_COLORS.map((c) => {
                  const active = c.toLowerCase() === color.toLowerCase();
                  return <button key={c} type="button" className={active ? "sp-swatch active" : "sp-swatch"} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={active} onClick={() => pickColor(c)} />;
                })}
              </div>
              <div className="world-form-wheel">
                <ColorWheel key={wheelKey} value={worldColor(preview)} onChange={setColor} />
              </div>
            </section>
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-sm btn-primary" disabled={busy || !name.trim() || (badge === "icon" && !icon)}>
            {busy ? "Saving…" : world ? "Save" : "Create and open"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function WorldCard({ world, active, busy, onOpen, onEdit, onDelete }: { world: WorldSummary; active: boolean; busy: boolean; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  const { settings } = useSettings();
  const stats = [
    { Icon: MapIcon, n: world.counts.maps, one: "map", many: "maps" },
    { Icon: Book, n: world.counts.articles, one: "article", many: "articles" },
    { Icon: CalendarDays, n: world.counts.calendars, one: "calendar", many: "calendars" },
    { Icon: Swords, n: world.counts.campaigns, one: "campaign", many: "campaigns" },
  ];
  return (
    <article className={active ? "world-card active" : "world-card"} style={tint(world)}>
      <button type="button" className="world-card-open" onClick={onOpen} disabled={busy} aria-label={`Open ${world.name}`}>
        <span className="world-card-banner" aria-hidden>
          <span className="world-card-initial">
            <BadgeContent world={world} size={24} />
          </span>
        </span>
        <span className="world-card-body">
          <span className="world-card-title">
            <strong>{world.name}</strong>
            {active && <span className="world-card-current">Open now</span>}
          </span>
          <span className={world.description ? "world-card-description" : "world-card-description empty"}>{world.description || "No description yet."}</span>
          <span className="world-card-stats">
            {stats.map(({ Icon, n, one, many }) => (
              <span key={one} className="world-card-stat">
                <Icon size={13} aria-hidden />
                {formatInteger(n)} {n === 1 ? one : many}
              </span>
            ))}
          </span>
          <span className="world-card-foot">{world.lastOpenedAt ? `Last opened ${formatRealDate(world.lastOpenedAt, settings.realDateFormat)}` : "Never opened"}</span>
        </span>
      </button>
      <div className="world-card-actions">
        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Edit ${world.name}`} data-tooltip="Edit name, icon and color" onClick={onEdit}>
          <Pencil size={14} />
        </button>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Delete ${world.name}`} data-tooltip="Delete world" onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}

/** "Choose your world": open one, create one, edit or delete one. */
export default function WorldsScreen({ initialWorlds, activeId: initialActive }: { initialWorlds: WorldSummary[]; activeId: string | null }) {
  const [worlds, setWorlds] = useState(initialWorlds);
  const [activeId, setActiveId] = useState(initialActive);
  const [editing, setEditing] = useState<WorldSummary | "new" | null>(null);
  const [deleting, setDeleting] = useState<WorldSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await api<{ worlds: WorldSummary[]; activeId: string | null }>("GET", "/api/worlds");
    if (res.ok) {
      setWorlds(res.data.worlds);
      setActiveId(res.data.activeId);
    }
  }
  async function open(world: WorldSummary) {
    setOpening(world);
    setError(null);
    const res = await api("POST", `/api/worlds/${world.id}/open`);
    if (res.ok) enterWorld();
    else {
      setOpening(null);
      setError(res.data.error ?? "Could not open the world.");
    }
  }
  async function remove() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const res = await api("DELETE", `/api/worlds/${deleting.id}`, { confirmName: deleting.name });
    setDeleteBusy(false);
    if (!res.ok) {
      setDeleteError(res.data.error ?? "Could not delete the world.");
      return;
    }
    setDeleting(null);
    await reload();
  }

  return (
    <div className="worlds-page">
      <header className="worlds-header">
        <Globe2 size={30} strokeWidth={1.75} aria-hidden />
        <h1>{worlds.length ? "Choose your world" : "Create your first world"}</h1>
        <p>Each world keeps its own maps, articles, calendars and campaigns. Your settings are shared by all of them.</p>
      </header>
      {error && (
        <p className="form-error worlds-error" role="alert">
          {error}
        </p>
      )}
      <div className="worlds-grid">
        {worlds.map((w) => (
          <WorldCard key={w.id} world={w} active={w.id === activeId} busy={opening !== null} onOpen={() => open(w)} onEdit={() => setEditing(w)} onDelete={() => setDeleting(w)} />
        ))}
        <button type="button" className="world-card world-card-new" onClick={() => setEditing("new")}>
          <Plus size={26} aria-hidden />
          <strong>New world</strong>
          <span>Starts empty</span>
        </button>
      </div>

      {editing && (
        <WorldForm
          world={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onEntering={(w) => {
            setEditing(null);
            setOpening(w);
          }}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
      {opening && <WorldOpening world={opening} />}
      {deleting && (
        <ConfirmDialog
          open
          danger
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete world"
          busyLabel="Deleting…"
          busy={deleteBusy}
          error={deleteError}
          confirmText={deleting.name}
          onConfirm={remove}
          onCancel={() => {
            setDeleting(null);
            setDeleteError(null);
          }}
        >
          Everything in this world is removed for good, Trash included: its {formatInteger(deleting.counts.maps)} maps and their images, {formatInteger(deleting.counts.articles)} articles, calendars and campaigns. This can&apos;t be
          undone. To keep a copy of its maps, open it and use Settings › Data › Export first.
        </ConfirmDialog>
      )}
    </div>
  );
}
