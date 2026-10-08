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
import { useT } from "@/i18n/useT";
import type { Translator } from "@/i18n/translate";
import type { MessageKey } from "@/i18n/messages";

const KIND_ICONS: Record<TrashKind, LucideIcon> = {
  map: MapIcon,
  article: Book,
  person: User,
  organization: Shield,
  territory: Flag,
  calendar: Calendar,
  calendarEntry: CalendarDays,
};

const SORTS: { key: string; label: MessageKey<"trash">; sort: TrashSort; dir: "asc" | "desc" }[] = [
  { key: "deleted-desc", label: "sort.deletedDesc", sort: "deleted", dir: "desc" },
  { key: "deleted-asc", label: "sort.deletedAsc", sort: "deleted", dir: "asc" },
  { key: "name-asc", label: "sort.nameAsc", sort: "name", dir: "asc" },
  { key: "type-asc", label: "sort.typeAsc", sort: "type", dir: "asc" },
];

const keyOf = (ref: TrashRef) => `${ref.kind}:${ref.id}`;
const refOf = ({ kind, id }: TrashItem): TrashRef => ({ kind, id });

async function post(url: string, body?: unknown): Promise<{ ok: boolean; data: { error?: string; purged?: number; skipped?: { reason: string }[] } }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

/** What a permanent delete is about to take: plain sentences for the confirm dialog. */
function purgeWarnings(items: TrashItem[], t: Translator<"trash">): string[] {
  const subMaps = items.reduce((n, i) => n + i.childCount, 0);
  const rostered = items.filter((i) => i.campaignCount > 0);
  const names = rostered.map((i) => `“${i.name}”`).join(", ");
  return [
    subMaps > 0 ? t(items.length === 1 ? "confirm.subMapsOne" : "confirm.subMapsMany", { count: subMaps }) : null,
    rostered.length > 0 ? t(rostered.length === 1 ? "confirm.rosterOne" : "confirm.rosterMany", { names }) : null,
    t("confirm.related"),
  ].filter((w): w is string => w !== null);
}

async function fetchTrash(failed: string): Promise<TrashItem[]> {
  const res = await fetch("/api/trash");
  const data: { items?: TrashItem[]; error?: string } = await res.json().catch(() => ({}));
  if (!res.ok || !data.items) throw new Error(data.error ?? failed);
  return data.items;
}

type Pending = { kind: "purge"; items: TrashItem[] } | { kind: "empty" };

/** A translated sentence with one part in bold: `text` still holds `slot` (e.g. "{items}") where `bold` goes. */
function Bolded({ text, slot, bold }: { text: string; slot: string; bold: string }) {
  const [before, after] = text.split(slot);
  return (
    <>
      {before}
      <strong>{bold}</strong>
      {after}
    </>
  );
}

export default function TrashView() {
  const { settings, updateSetting } = useSettings();
  const t = useT("trash");
  const loadFailed = t("loadFailed");
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
  const showLoadError = useCallback((err: unknown) => setLoadError(err instanceof Error ? err.message : loadFailed), [loadFailed]);
  const load = useCallback(() => fetchTrash(loadFailed).then(showItems, showLoadError), [loadFailed, showItems, showLoadError]);

  useEffect(() => {
    fetchTrash(loadFailed).then(showItems, showLoadError);
  }, [loadFailed, showItems, showLoadError]);

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
    if (!ok) return setActionError(data.error ?? t("restoreFailed"));
    setNotice(targets.length === 1 ? t("restoredOne", { name: targets[0].name }) : t("restoredMany", { count: targets.length }));
    setSelection(EMPTY_SELECTION);
    await load();
  }

  async function confirmPending() {
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    const { ok, data } = pending.kind === "empty" ? await post("/api/trash/empty") : await post("/api/trash/purge", { items: pending.items.map(refOf) });
    setBusy(false);
    if (!ok) return setActionError(data.error ?? t("deleteFailed"));
    const skipped = data.skipped ?? [];
    setNotice([t("deleted", { count: data.purged ?? 0 }), ...skipped.map((s) => s.reason)].join(" "));
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
        title={t("title")}
        description={t("description")}
        actions={
          <button type="button" className="btn btn-danger" disabled={busy || total === 0} onClick={() => setPending({ kind: "empty" })}>
            <Trash2 size={15} strokeWidth={2.25} />
            {t("empty")}
          </button>
        }
      />

      <div className="trash-retention">
        <label htmlFor="trash-retention">{t("retention.label")}</label>
        <select
          id="trash-retention"
          value={retentionValue}
          onChange={async (e) => {
            const value: TrashRetention = e.target.value === "never" ? null : (Number(e.target.value) as TrashRetention);
            setActionError(await updateSetting("trashRetentionDays", value));
          }}
        >
          <option value="never">{t("retention.never")}</option>
          {TRASH_RETENTION_DAYS.map((days) => (
            <option key={days} value={days}>
              {t("retention.days", { days })}
            </option>
          ))}
        </select>
      </div>

      <div className="trash-toolbar">
        <SegmentedControl<TrashGroup | "all">
          ariaLabel={t("show")}
          value={group}
          segments={[
            { key: "all", label: t("group.all", { count: counts.all }) },
            { key: "maps", label: t("group.maps", { count: counts.maps }) },
            { key: "articles", label: t("group.articles", { count: counts.articles }) },
            { key: "calendar", label: t("group.calendar", { count: counts.calendar }) },
          ]}
          onChange={setGroup}
        />
        <label className="settings-search trash-search">
          <Search size={15} strokeWidth={2.25} aria-hidden />
          <input type="search" placeholder={t("search.placeholder")} aria-label={t("search.label")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select aria-label={t("sort.label")} value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {t(s.label)}
            </option>
          ))}
        </select>
      </div>

      {notice && (
        <div className="settings-notice" role="status">
          <p>{notice}</p>
          <button type="button" className="btn btn-icon btn-ghost" aria-label={t("dismiss")} data-tooltip={t("dismiss")} onClick={() => setNotice(null)}>
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
        <div className="trash-bulk" role="toolbar" aria-label={t("selectedItems")}>
          <strong>{t("selectedCount", { count: selected.length })}</strong>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void restore(selected)}>
            <RotateCcw size={14} strokeWidth={2.25} />
            {t("restore")}
          </button>
          <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => setPending({ kind: "purge", items: selected })}>
            <Trash2 size={14} strokeWidth={2.25} />
            {t("deleteForever")}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSelection(EMPTY_SELECTION)}>
            {t("clear")}
          </button>
        </div>
      )}

      {loadError ? (
        <div className="trash-state">
          <p className="form-error">{loadError}</p>
          <button type="button" className="btn btn-sm" onClick={() => void load()}>
            {t("tryAgain")}
          </button>
        </div>
      ) : items === null ? (
        <SkeletonList />
      ) : total === 0 ? (
        <div className="trash-state">
          <Trash2 size={28} strokeWidth={1.75} aria-hidden />
          <strong>{t("isEmpty.title")}</strong>
          <p>{t("isEmpty.text")}</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="trash-state">
          <p>{query.trim() ? t("noMatchQuery", { query: query.trim() }) : t("noMatchFilter")}</p>
        </div>
      ) : (
        <div className="trash-list" role="list" aria-label={t("listLabel")}>
          <div className="trash-list-head">
            <input type="checkbox" aria-label={t("selectAllShown")} checked={allVisibleSelected} onChange={toggleAllVisible} />
            <span>{visible.length !== total ? t("itemCountOf", { count: visible.length, total }) : t("itemCount", { count: visible.length })}</span>
            <span className="trash-list-hint">{t("rangeHint")}</span>
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
                  aria-label={t("selectItem", { name: item.name })}
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
                    {item.childCount > 0 && <span className="trash-pill">{t("subMaps", { count: item.childCount })}</span>}
                    <span>{t("deletedOn", { date: formatRealDate(item.deletedAt, settings.realDateFormat, { withTime: true, language: settings.language }) })}</span>
                    {daysLeft !== null && <span className={daysLeft <= 3 ? "trash-due soon" : "trash-due"}>{daysLeft === 0 ? t("dueNext") : t("dueIn", { count: daysLeft })}</span>}
                  </span>
                </span>
                <span className="trash-row-actions">
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void restore([item])}>
                    <RotateCcw size={14} strokeWidth={2.25} />
                    {t("restore")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-ghost trash-delete"
                    disabled={busy}
                    aria-label={t("deleteItemForever", { name: item.name })}
                    data-tooltip={t("deleteForever")}
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
          title={pending.kind === "empty" ? t("confirm.emptyTitle") : pending.items.length === 1 ? t("confirm.oneTitle") : t("confirm.manyTitle", { count: pending.items.length })}
          confirmLabel={pending.kind === "empty" ? t("empty") : t("deleteForever")}
          busyLabel={t("confirm.deleting")}
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
              <Bolded text={t("confirm.all", { count: total })} slot="{items}" bold={t("itemCount", { count: total })} />
            ) : pending.items.length === 1 ? (
              <Bolded text={t("confirm.one")} slot="{name}" bold={`“${pending.items[0].name}”`} />
            ) : (
              <Bolded text={t("confirm.many")} slot="{items}" bold={t("itemCount", { count: pending.items.length })} />
            )}
          </p>
          <ul>
            {purgeWarnings(pending.kind === "empty" ? (items ?? []) : pending.items, t).map((w) => (
              <li key={w}>{w}</li>
            ))}
            <li>{t("confirm.irreversible")}</li>
          </ul>
        </ConfirmDialog>
      )}
    </>
  );
}
