"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, ChevronDown, Link2, Pencil, Plus, Repeat, Settings2, Trash2, Undo2, X } from "lucide-react";
import Modal from "@/components/Modal";
import RichEditor from "@/components/RichEditor";
import ConfirmDialog from "@/components/ConfirmDialog";
import { articleHref, isArticleTemplate } from "@/server/articles/templates";
import { describeRecurrence, type EvalContext } from "@/server/calendars/recurrence";
import { fromWorldDay, weekdayIndex, type CalendarDefinition } from "@/server/calendars/engine";
import { api } from "./api";
import FoldSection from "./FoldSection";
import DayWeather from "./DayWeather";
import { celestialStates, dayLabel, occurrenceTitle, safe, type DayOccurrence } from "./evaluate";
import { ENTRY_KINDS, type EntryEditorMode } from "./EntryEditor";
import type { ClientCalendar, ClientCelestial, ClientEntry, ClientProfile, ClientSeason, EntryKind } from "./types";
import { sessionHref, type BriefSession } from "@/components/sessions/types";
import { questHref } from "@/components/quests/href";
import { QUEST_DAY_LABELS, QUEST_STATUS_LABELS, type BriefQuest, type QuestDayKind } from "@/server/quests/types";
import { useT } from "@/i18n/useT";

function ArticleLinkName({ template, id, names }: { template: string | null; id: string; names: Record<string, string> }) {
  const t = useT("calendars");
  const name = names[id];
  if (!name || !template || !isArticleTemplate(template)) return <span className="cal-removed">{t("sidebar.removed")}</span>;
  return (
    <Link className="politics-link-button" href={articleHref(template, id)}>
      {name}
    </Link>
  );
}

/** "What do you want to add?": note, event or article link; picking one opens its editor. */
function AddEntryChooser({ onPick, onClose }: { onPick: (kind: EntryKind) => void; onClose: () => void }) {
  const t = useT("calendars");
  return (
    <Modal open onClose={onClose} title={t("day.addTitle")}>
      <div className="cel-types">
        <p className="cal-help">{t("day.whatToAdd")}</p>
        <div className="cel-type-grid day-add-choices">
          {(["note", "event", "link"] as const).map((k) => {
            const meta = ENTRY_KINDS[k];
            return (
              <button key={k} type="button" className="cel-type-card" onClick={() => onPick(k)}>
                <span className="cel-type-icon" style={{ color: meta.color }}>
                  <meta.Icon size={22} strokeWidth={1.75} />
                </span>
                <strong>{meta.label}</strong>
                <span className="cal-help">{meta.detail}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

/**
 * The selected day: its full date, weekday, the preview profile's seasons, every celestial
 * state, and its notes / events / article links. Selecting never changes
 * the shared date; "Set as current date" does, explicitly.
 */
export default function DayDetails({
  worldDay,
  currentDay,
  calendar,
  profile,
  seasons,
  objects,
  sessions,
  quests = [],
  items,
  articleNames,
  ctx,
  busy,
  onSetCurrent,
  onEdit,
  onViewObject,
  onViewSeason,
  onChanged,
  onClose,
}: {
  worldDay: number;
  currentDay: number;
  calendar: ClientCalendar;
  profile: ClientProfile | null;
  seasons: ClientSeason[];
  objects: ClientCelestial[];
  /** Game sessions whose in-world span covers this day. */
  sessions: BriefSession[];
  /** Quests starting, due or ending on this day. */
  quests?: { quest: BriefQuest; kind: QuestDayKind }[];
  items: DayOccurrence[];
  articleNames: Record<string, string>;
  ctx: EvalContext;
  busy: boolean;
  onSetCurrent: () => void;
  onEdit: (mode: EntryEditorMode) => void;
  /** Opens the read-only view of a celestial object. */
  onViewObject: (object: ClientCelestial) => void;
  /** Opens the read-only view of a season. */
  onViewSeason: (season: ClientSeason) => void;
  onChanged: (entry: ClientEntry | null, removedId?: string) => void;
  onClose: () => void;
}) {
  const te = useT("editor");
  const t = useT("calendars");
  const tc = useT("common");
  const def: CalendarDefinition = calendar.definition;
  const [editingNote, setEditingNote] = useState<string | null>(null);
  // Entries start collapsed (name and icon only); a click opens one.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const [deleting, setDeleting] = useState<DayOccurrence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const date = safe(() => fromWorldDay(def, worldDay), null);
  const weekday = date ? safe(() => weekdayIndex(def, date), null) : null;
  const seasonIds = profile ? ctx.seasonsOn(profile.id, worldDay) : [];
  // Only what is actually in the sky that day: objects with no state on it (not scheduled, lore-only) are left out.
  const states = celestialStates(objects, worldDay, ctx).filter((x) => x.states.length > 0);
  const add = (entryKind: EntryKind) => onEdit({ kind: "create", entryKind, worldDay });

  async function cancelOccurrence(item: DayOccurrence) {
    const res = await api<{ entry: ClientEntry }>("PATCH", `/api/calendar-entries/${item.entry.id}`, { occurrence: item.occurrence.key, exception: { cancelled: true } });
    if (res.ok) onChanged(res.data.entry);
    else setError(res.data.error ?? t("day.changeFailed"));
    setDeleting(null);
  }

  async function restoreOccurrence(item: DayOccurrence) {
    const res = await api<{ entry: ClientEntry }>("PATCH", `/api/calendar-entries/${item.entry.id}`, { occurrence: item.occurrence.key, exception: null });
    if (res.ok) onChanged(res.data.entry);
    else setError(res.data.error ?? t("day.restoreFailed"));
  }

  async function remove(item: DayOccurrence) {
    const res = await api("DELETE", `/api/calendar-entries/${item.entry.id}`);
    if (res.ok) onChanged(null, item.entry.id);
    else setError(res.data.error ?? t("day.deleteFailed"));
    setDeleting(null);
  }

  const repeating = (e: ClientEntry) => e.recurrence.kind !== "none";
  const [linkedBefore, linkedAfter] = t("day.linkedToDay").split("{article}");

  return (
    <aside className="cal-details" aria-label={t("day.label")}>
      <div className="cal-details-head">
        <div>
          <h2>{date ? dayLabel(def, worldDay, { weekday: false }) : t("date.outOfRange")}</h2>
          <p className="cal-help">
            {weekday !== null ? def.weekdays[weekday].name : def.weekdays.length ? t("day.outsideWeek") : ""}
            {worldDay === currentDay ? t("day.currentSuffix") : ""}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-icon" aria-label={t("day.close")} onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {worldDay !== currentDay && (
        <button type="button" className="btn btn-sm" disabled={busy} onClick={onSetCurrent}>
          <CalendarCheck size={14} /> {t("day.setCurrent")}
        </button>
      )}

      <section className="cal-details-section">
        <h3 className="field-label">{profile ? t("day.seasonsOf", { profile: profile.name }) : t("sidebar.seasons")}</h3>
        {!profile ? (
          <p className="cal-help">{t("day.pickProfile")}</p>
        ) : seasonIds.length === 0 ? (
          <p className="cal-help">{t("day.noSeason")}</p>
        ) : (
          <ul className="cal-tags">
            {seasonIds.map((id) => {
              const s = seasons.find((x) => x.id === id);
              return (
                <li key={id}>
                  {s ? (
                    <button type="button" className="cal-tag cal-tag-button" data-tooltip={t("day.about", { name: s.name })} onClick={() => onViewSeason(s)}>
                      <span className="cal-swatch" style={{ background: s.color }} aria-hidden />
                      {s.name}
                    </button>
                  ) : (
                    <span className="cal-tag">{t("sidebar.removed")}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {sessions.length > 0 && (
        <FoldSection title={t("day.sessions")} count={sessions.length}>
          <ul className="day-sessions">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={sessionHref(s)}>
                  <span aria-hidden>📜</span>
                  <span>
                    <strong>{s.title || t("views.session", { n: s.number })}</strong>
                    <span className="cal-help">
                      {" "}
                      {t("day.sessionMeta", { campaign: s.campaignName, n: s.number })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </FoldSection>
      )}

      {quests.length > 0 && (
        <FoldSection title={t("day.quests")} count={quests.length}>
          <ul className="day-sessions">
            {quests.map(({ quest: q, kind }) => (
              <li key={`${q.id}:${kind}`}>
                <Link href={questHref(q)}>
                  <span aria-hidden>{kind === "deadline" ? "⏳" : kind === "start" ? "⚔️" : "🏁"}</span>
                  <span>
                    <strong>{q.title}</strong>
                    <span className="cal-help">
                      {" "}
                      · {QUEST_DAY_LABELS[kind]} · {QUEST_STATUS_LABELS[q.status]} · {q.campaignName}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </FoldSection>
      )}

      <FoldSection title={t("sidebar.sky")} count={states.length}>
        {states.length === 0 ? (
          <p className="cal-help">{objects.length ? t("day.skyQuiet") : t("day.noObjects")}</p>
        ) : (
          <ul className="cal-sky">
            {states.map(({ object, states: s }) => (
              <li key={object.id}>
                <button type="button" className="cal-sky-item" data-tooltip={t("day.about", { name: object.name })} onClick={() => onViewObject(object)}>
                  <span style={{ color: object.color }} aria-hidden>
                    {s[0]?.icon || object.icon || "•"}
                  </span>
                  <span>{object.name}</span>
                  <span className="cal-help">{s.map((x) => (x.override ? t("day.specialDate", { name: x.name }) : x.name)).join(", ")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </FoldSection>

      <DayWeather worldDay={worldDay} />

      <FoldSection
        title={t("day.onThisDay")}
        count={items.length}
        action={
          <button type="button" className="btn btn-ghost btn-icon btn-sm day-fold-add" aria-label={t("day.addTitle")} data-tooltip={t("day.addHint")} onClick={() => setChoosing(true)}>
            <Plus size={16} />
          </button>
        }
      >
        {items.length === 0 && <p className="cal-help">{t("day.nothing")}</p>}
        <ul className="day-entries">
          {items.map((item) => {
            const e = item.entry;
            const key = `${e.id}:${item.occurrence.key}`;
            const meta = ENTRY_KINDS[e.kind];
            const open = expanded.has(key);
            const accent = e.color || meta.color;
            const description = item.occurrence.exception?.description ?? e.description;
            const multiDay = item.occurrence.end > item.occurrence.start;
            return (
              <li key={key} className={open ? "day-entry open" : "day-entry"} style={{ borderLeftColor: accent }}>
                <button type="button" className="day-entry-summary" aria-expanded={open} onClick={() => toggle(key)}>
                  <span className="day-entry-icon" style={{ color: accent }} aria-label={meta.label}>
                    <meta.Icon size={15} strokeWidth={2} />
                  </span>
                  <span className="day-entry-title">{e.kind === "link" ? (articleNames[e.articleId ?? ""] ?? t("day.removedArticle")) : occurrenceTitle(item) || t("day.untitledNote")}</span>
                  {repeating(e) && <Repeat size={12} className="day-entry-flag" aria-label={t("day.repeats")} />}
                  <ChevronDown size={15} className="day-entry-chevron" aria-hidden />
                </button>
                {open && (
                  <div className="day-entry-body">
                    {(multiDay || repeating(e) || e.category) && (
                      <div className="day-entry-meta">
                        {multiDay && (
                          <span>
                            {dayLabel(def, item.occurrence.start, { weekday: false })} – {dayLabel(def, item.occurrence.end, { weekday: false })}
                          </span>
                        )}
                        {repeating(e) && (
                          <span>
                            <Repeat size={11} aria-hidden /> {describeRecurrence(e.recurrence, ctx)}
                            {item.occurrence.exception?.moveTo !== undefined ? t("day.movedHere") : ""}
                          </span>
                        )}
                        {e.category && <span className="cal-tag">{e.category}</span>}
                      </div>
                    )}
                    {e.kind === "link" && (
                      <p className="day-entry-text">
                        {linkedBefore}
                        <ArticleLinkName template={e.articleTemplate} id={e.articleId ?? ""} names={articleNames} />
                        {linkedAfter}
                      </p>
                    )}
                    {description && <p className="day-entry-text">{description}</p>}
                    {e.kind === "note" && e.documentId && (
                      <div className={editingNote === e.id ? "day-entry-note editing" : "day-entry-note"}>
                        <RichEditor key={`${e.documentId}:${editingNote === e.id}`} documentId={e.documentId} editable={editingNote === e.id} placeholder={editingNote === e.id ? "" : te("placeholder.dayNote")} />
                      </div>
                    )}
                    {e.articleLinks.length > 0 && (
                      <div className="day-entry-links">
                        {e.articleLinks.map((l) => (
                          <span key={l.articleId} className="day-entry-link">
                            <Link2 size={12} aria-hidden />
                            <ArticleLinkName template={l.template} id={l.articleId} names={articleNames} />
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="day-entry-actions">
                      {e.kind === "note" && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingNote(editingNote === e.id ? null : e.id)}>
                          <Pencil size={13} /> {editingNote === e.id ? tc("done") : t("day.write")}
                        </button>
                      )}
                      {repeating(e) && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit({ kind: "occurrence", entry: e, key: item.occurrence.key })}>
                          <CalendarCheck size={13} /> {t("day.thisOccurrence")}
                        </button>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit({ kind: "edit", entry: e })}>
                        <Settings2 size={13} /> {repeating(e) ? t("day.entireSeries") : t("sidebar.edit")}
                      </button>
                      {item.occurrence.exception && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => restoreOccurrence(item)}>
                          <Undo2 size={13} /> {t("day.undoChange")}
                        </button>
                      )}
                      <span className="cal-spacer" />
                      <button type="button" className="btn btn-ghost btn-sm day-entry-delete" onClick={() => setDeleting(item)}>
                        <Trash2 size={13} /> {tc("delete")}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </FoldSection>

      {choosing && (
        <AddEntryChooser
          onClose={() => setChoosing(false)}
          onPick={(k) => {
            setChoosing(false);
            add(k);
          }}
        />
      )}
      {deleting && (
        <DeleteEntryDialog item={deleting} onCancel={() => setDeleting(null)} onOccurrence={() => cancelOccurrence(deleting)} onAll={() => remove(deleting)} />
      )}
    </aside>
  );
}

function DeleteEntryDialog({ item, onCancel, onOccurrence, onAll }: { item: DayOccurrence; onCancel: () => void; onOccurrence: () => void; onAll: () => void }) {
  const t = useT("calendars");
  const tc = useT("common");
  const series = item.entry.recurrence.kind !== "none";
  const [scope, setScope] = useState<"one" | "all">(series ? "one" : "all");
  return (
    <ConfirmDialog open title={series ? t("day.deleteEvent") : tc("delete")} confirmLabel={scope === "one" ? t("day.skipOccurrence") : tc("delete")} onCancel={onCancel} onConfirm={() => (scope === "one" ? onOccurrence() : onAll())}>
      {series ? (
        <fieldset className="cal-radio">
          <label className="cal-check">
            <input type="radio" checked={scope === "one"} onChange={() => setScope("one")} /> {t("day.onlyThis")}
          </label>
          <label className="cal-check">
            <input type="radio" checked={scope === "all"} onChange={() => setScope("all")} /> {t("day.wholeSeries")}
          </label>
        </fieldset>
      ) : (
        <p>{t("day.removeHelp")}</p>
      )}
    </ConfirmDialog>
  );
}
