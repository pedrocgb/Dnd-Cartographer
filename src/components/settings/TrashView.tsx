"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Book, Calendar, CalendarDays, Flag, Map as MapIcon, RotateCcw, Search, Shield, Trash2, User, X, type LucideIcon } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import SegmentedControl from "@/components/marker-panel/SegmentedControl";
import { SkeletonList } from "@/components/Skeleton";
import { clickSelection, EMPTY_SELECTION, type Selection } from "@/components/multi-select";
import { useSettings } from "./SettingsProvider";
import { SettingsHeader } from "./parts";
import { formatRealDate } from "@/server/settings/date-format";
import { TRASH_RETENTION_DAYS, type TrashRetention } from "@/server/settings/settings";
import { countByGroup, daysUntilPurge, filterSortTrash, type TrashGroup, type TrashItem, type TrashKind, type TrashRef, type TrashSort } from "@/server/trash/trash";

const KIND_ICONS: Record<TrashKind, LucideIcon> = {
  map: MapIcon,
  article: Book,
  person: User,
  organization: Shield,
  territory: Flag,
  calendar: Calendar,
  calendarEntry: CalendarDays,
};

const SORTS: { key: string; label: string; sort: TrashSort; dir: "asc" | "desc" }[] = [
  { key: "deleted-desc", label: "Recently deleted", sort: "deleted", dir: "desc" },
  { key: "deleted-asc", label: "Oldest first", sort: "deleted", dir: "asc" },
  { key: "name-asc", label: "Name (A–Z)", sort: "name", dir: "asc" },
  { key: "type-asc", label: "Type", sort: "type", dir: "asc" },
];

const keyOf = (ref: TrashRef) => `${ref.kind}:${ref.id}`;
const refOf = ({ kind, id }: TrashItem): TrashRef => ({ kind, id });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

async function post(url: string, body?: unknown): Promise<{ ok: boolean; data: { error?: string; purged?: number; skipped?: { reason: string }[] } }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

/** What a permanent delete is about to take: plain sentences for the confirm dialog. */
function purgeWarnings(items: TrashItem[]): string[] {
  const subMaps = items.reduce((n, i) => n + i.childCount, 0);
  const rostered = items.filter((i) => i.campaignCount > 0);
  return [
    subMaps > 0 ? `${plural(subMaps, "sub-map")} trashed with ${items.length === 1 ? "this map" : "these maps"} will be deleted too.` : null,
    rostered.length > 0 ? `${rostered.map((i) => `“${i.name}”`).join(", ")} will leave ${rostered.length === 1 ? "its campaign roster" : "their campaign rosters"}.` : null,
    "Images, descriptions, links and relations that belong to them are removed as well.",
  ].filter((w): w is string => w !== null);
}

async function fetchTrash(): Promise<TrashItem[]> {
  const res = await fetch("/api/trash");
  const data: { items?: TrashItem[]; error?: string } = await res.json().catch(() => ({}));
  if (!res.ok || !data.items) throw new Error(data.error ?? "Couldn't load the Trash.");
  return data.items;
}

type Pending = { kind: "purge"; items: TrashItem[] } | { kind: "empty" };

export default function TrashView() {
  const { settings, updateSetting } = useSettings();
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [group, setGroup] = useState<TrashGroup | "all">("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(SORTS[0].key);
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [now] = useState(() => Date.now());

  const showItems = useCallback((next: TrashItem[]) => {
    setLoadError(null);
    setItems(next);
    // Drop picks that are no longer in the Trash.
    const present = new Set(next.map(keyOf));
    setSelection((s) => ({ ids: s.ids.filter((id) => present.has(id)), anchor: s.anchor && present.has(s.anchor) ? s.anchor : null }));
  }, []);
  const showLoadError = useCallback((err: unknown) => setLoadError(err instanceof Error ? err.message : "Couldn't load the Trash."), []);
  const load = useCallback(() => fetchTrash().then(showItems, showLoadError), [showItems, showLoadError]);

  useEffect(() => {
    fetchTrash().then(showItems, showLoadError);
  }, [showItems, showLoadError]);

  const sort = SORTS.find((s) => s.key === sortKey) ?? SORTS[0];
  const visible = useMemo(() => filterSortTrash(items ?? [], { q: query, group, sort: sort.sort, dir: sort.dir }), [items, query, group, sort]);
  const counts = useMemo(() => countByGroup(items ?? []), [items]);
  const order = useMemo(() => visible.map(keyOf), [visible]);
  const selected = useMemo(() => {
    const picked = new Set(selection.ids);
    return (items ?? []).filter((i) => picked.has(keyOf(i)));
  }, [items, selection]);
  const allVisibleSelected = visible.length > 0 && visible.every((i) => selection.ids.includes(keyOf(i)));

  async function restore(targets: TrashItem[]) {
    setBusy(true);
    setActionError(null);
    const { ok, data } = await post("/api/trash/restore", { items: targets.map(refOf) });
    setBusy(false);
    if (!ok) return setActionError(data.error ?? "Couldn't restore.");
    setNotice(targets.length === 1 ? `Restored “${targets[0].name}”.` : `Restored ${plural(targets.length, "item")}.`);
    setSelection(EMPTY_SELECTION);
    await load();
  }

  async function confirmPending() {
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    const { ok, data } = pending.kind === "empty" ? await post("/api/trash/empty") : await post("/api/trash/purge", { items: pending.items.map(refOf) });
    setBusy(false);
    if (!ok) return setActionError(data.error ?? "Couldn't delete.");
    const skipped = data.skipped ?? [];
    setNotice(`Deleted ${plural(data.purged ?? 0, "item")} for good.${skipped.length ? ` ${skipped.map((s) => s.reason).join(" ")}` : ""}`);
    setPending(null);
    setSelection(EMPTY_SELECTION);
    await load();
  }

  function toggleRow(item: TrashItem, shift: boolean) {
    setSelection((s) => clickSelection(s, keyOf(item), { toggle: true, range: shift }, order));
  }

  function toggleAllVisible() {
    setSelection(allVisibleSelected ? EMPTY_SELECTION : { ids: order, anchor: order[0] ?? null });
  }

  const retentionValue = settings.trashRetentionDays === null ? "never" : String(settings.trashRetentionDays);
  const total = items?.length ?? 0;

  return (
    <>
      <SettingsHeader
        title="Trash"
        description="Deleted maps, articles and calendar entries wait here. Restore them, or delete them for good."
        actions={
          <button type="button" className="btn btn-danger" disabled={busy || total === 0} onClick={() => setPending({ kind: "empty" })}>
            <Trash2 size={15} strokeWidth={2.25} />
            Empty trash
          </button>
        }
      />

      <div className="trash-retention">
        <label htmlFor="trash-retention">Automatically delete items after</label>
        <select
          id="trash-retention"
          value={retentionValue}
          onChange={async (e) => {
            const value: TrashRetention = e.target.value === "never" ? null : (Number(e.target.value) as TrashRetention);
            setActionError(await updateSetting("trashRetentionDays", value));
          }}
        >
          <option value="never">Never</option>
          {TRASH_RETENTION_DAYS.map((days) => (
            <option key={days} value={days}>
              {days} days
            </option>
          ))}
        </select>
      </div>

      <div className="trash-toolbar">
        <SegmentedControl<TrashGroup | "all">
          ariaLabel="Show"
          value={group}
          segments={[
            { key: "all", label: `All · ${counts.all}` },
            { key: "maps", label: `Maps · ${counts.maps}` },
            { key: "articles", label: `Articles · ${counts.articles}` },
            { key: "calendar", label: `Calendar · ${counts.calendar}` },
          ]}
          onChange={setGroup}
        />
        <label className="settings-search trash-search">
          <Search size={15} strokeWidth={2.25} aria-hidden />
          <input type="search" placeholder="Search the Trash…" aria-label="Search the Trash" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select aria-label="Sort" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {notice && (
        <div className="settings-notice" role="status">
          <p>{notice}</p>
          <button type="button" className="btn btn-icon btn-ghost" aria-label="Dismiss" data-tooltip="Dismiss" onClick={() => setNotice(null)}>
            <X size={14} strokeWidth={2.25} />
          </button>
        </div>
      )}
      {actionError && !pending && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      {selected.length > 0 && (
        <div className="trash-bulk" role="toolbar" aria-label="Selected items">
          <strong>{selected.length} selected</strong>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void restore(selected)}>
            <RotateCcw size={14} strokeWidth={2.25} />
            Restore
          </button>
          <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => setPending({ kind: "purge", items: selected })}>
            <Trash2 size={14} strokeWidth={2.25} />
            Delete forever
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSelection(EMPTY_SELECTION)}>
            Clear
          </button>
        </div>
      )}

      {loadError ? (
        <div className="trash-state">
          <p className="form-error">{loadError}</p>
          <button type="button" className="btn btn-sm" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : items === null ? (
        <SkeletonList />
      ) : total === 0 ? (
        <div className="trash-state">
          <Trash2 size={28} strokeWidth={1.75} aria-hidden />
          <strong>The Trash is empty</strong>
          <p>Deleted maps, articles and calendar entries show up here.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="trash-state">
          <p>Nothing here matches{query.trim() ? ` “${query.trim()}”` : " this filter"}.</p>
        </div>
      ) : (
        <div className="trash-list" role="list" aria-label="Trashed items">
          <div className="trash-list-head">
            <input type="checkbox" aria-label="Select all shown" checked={allVisibleSelected} onChange={toggleAllVisible} />
            <span>
              {plural(visible.length, "item")}
              {visible.length !== total ? ` of ${total}` : ""}
            </span>
            <span className="trash-list-hint">Shift-click to select a range</span>
          </div>
          {visible.map((item) => {
            const Icon = KIND_ICONS[item.kind];
            const key = keyOf(item);
            const checked = selection.ids.includes(key);
            const daysLeft = daysUntilPurge(item.deletedAt, settings.trashRetentionDays, now);
            return (
              <div key={key} role="listitem" className={checked ? "trash-row selected" : "trash-row"}>
                <input
                  type="checkbox"
                  aria-label={`Select ${item.name}`}
                  checked={checked}
                  onChange={() => undefined}
                  onClick={(e) => toggleRow(item, e.shiftKey)}
                />
                <span className="trash-row-icon" aria-hidden>
                  <Icon size={16} strokeWidth={2.25} />
                </span>
                <span className="trash-row-main">
                  <span className="trash-row-name">{item.name}</span>
                  <span className="trash-row-meta">
                    <span className="trash-pill">{item.subtype}</span>
                    {item.childCount > 0 && <span className="trash-pill">+ {plural(item.childCount, "sub-map")}</span>}
                    <span>Deleted {formatRealDate(item.deletedAt, settings.realDateFormat, { withTime: true })}</span>
                    {daysLeft !== null && <span className={daysLeft <= 3 ? "trash-due soon" : "trash-due"}>{daysLeft === 0 ? "Deleted at next cleanup" : `Auto-deletes in ${plural(daysLeft, "day")}`}</span>}
                  </span>
                </span>
                <span className="trash-row-actions">
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void restore([item])}>
                    <RotateCcw size={14} strokeWidth={2.25} />
                    Restore
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-ghost trash-delete"
                    disabled={busy}
                    aria-label={`Delete ${item.name} forever`}
                    data-tooltip="Delete forever"
                    onClick={() => setPending({ kind: "purge", items: [item] })}
                  >
                    <Trash2 size={15} strokeWidth={2.25} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {pending && (
        <ConfirmDialog
          open
          title={pending.kind === "empty" ? "Empty the Trash?" : pending.items.length === 1 ? "Delete forever?" : `Delete ${pending.items.length} items forever?`}
          confirmLabel={pending.kind === "empty" ? "Empty trash" : "Delete forever"}
          busyLabel="Deleting…"
          busy={busy}
          error={actionError}
          onConfirm={() => void confirmPending()}
          onCancel={() => {
            setPending(null);
            setActionError(null);
          }}
        >
          <p>
            {pending.kind === "empty" ? (
              <>
                All <strong>{plural(total, "item")}</strong> in the Trash will be deleted permanently.
              </>
            ) : pending.items.length === 1 ? (
              <>
                <strong>&ldquo;{pending.items[0].name}&rdquo;</strong> will be deleted permanently.
              </>
            ) : (
              <>
                <strong>{plural(pending.items.length, "item")}</strong> will be deleted permanently.
              </>
            )}
          </p>
          <ul>
            {purgeWarnings(pending.kind === "empty" ? (items ?? []) : pending.items).map((w) => (
              <li key={w}>{w}</li>
            ))}
            <li>This can&rsquo;t be undone.</li>
          </ul>
        </ConfirmDialog>
      )}
    </>
  );
}
