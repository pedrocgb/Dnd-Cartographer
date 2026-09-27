"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Link2, NotebookPen, Repeat, type LucideIcon } from "lucide-react";
import Modal from "@/components/Modal";
import ColorWheel from "@/components/ColorWheel";
import InfoPicker from "@/components/articles/InfoPicker";
import { candidateOptions, loadCandidates, type Candidate } from "@/components/articles/candidates";
import { toWorldDay, type CalendarDefinition } from "@/server/calendars/engine";
import { describeRecurrence, type EvalContext, type Recurrence } from "@/server/calendars/recurrence";
import { api } from "./api";
import { dayLabel, localOf, safe } from "./evaluate";
import DateInput from "./DateInput";
import RecurrenceBuilder from "./RecurrenceBuilder";
import ArticleLinksSection from "./ArticleLinksSection";
import { Section } from "./CelestialSections";
import type { ArticleRef, ClientEntry, EntryKind, WorldCalendars } from "./types";

export type EntryEditorMode =
  | { kind: "create"; entryKind: EntryKind; worldDay: number }
  | { kind: "edit"; entry: ClientEntry }
  | { kind: "occurrence"; entry: ClientEntry; key: number };

export const ENTRY_KINDS: Record<EntryKind, { label: string; Icon: LucideIcon; color: string; detail: string }> = {
  note: { label: "Note", Icon: NotebookPen, color: "#D29C53", detail: "Free text about this day" },
  event: { label: "Event", Icon: CalendarPlus, color: "#47BFAB", detail: "Something that happens — it can last days or repeat" },
  link: { label: "Article link", Icon: Link2, color: "#9CC3F5", detail: "Tie an existing article to this day" },
};

const SWATCHES = ["#47BFAB", "#9CC3F5", "#D29C53", "#E8735F", "#B48EE0", "#7AC77A", "#E8E3D5"];

type Tab = "details" | "repeats" | "articles";

/**
 * Create or edit a dated note, event or direct article link, or change a
 * single occurrence of a repeating event (This Occurrence). Dates are
 * entered in the active calendar and stored as the shared physical day.
 */
export default function EntryEditor({
  mode,
  world,
  def,
  calendarId,
  ctx,
  categories,
  onSaved,
  onClose,
}: {
  mode: EntryEditorMode;
  world: WorldCalendars;
  def: CalendarDefinition;
  calendarId: string;
  ctx: EvalContext;
  categories: string[];
  onSaved: (entry: ClientEntry, articleNames: Record<string, string>) => void;
  onClose: () => void;
}) {
  const entry = mode.kind === "create" ? null : mode.entry;
  const kind = mode.kind === "create" ? mode.entryKind : mode.entry.kind;
  const meta = ENTRY_KINDS[kind];
  const occurrence = mode.kind === "occurrence";
  const exception = occurrence ? (mode.entry.exceptions[String(mode.key)] ?? {}) : null;
  const startDay = mode.kind === "create" ? mode.worldDay : occurrence ? (exception?.moveTo ?? mode.key) : mode.entry.worldDay;

  const [date, setDate] = useState(() => localOf(def, startDay) ?? def.sync.date);
  const [title, setTitle] = useState(exception?.title ?? entry?.title ?? "");
  const [description, setDescription] = useState(exception?.description ?? entry?.description ?? "");
  const [category, setCategory] = useState(entry?.category ?? "");
  const [color, setColor] = useState(entry?.color ?? "");
  const [wheelOpen, setWheelOpen] = useState(false);
  const [duration, setDuration] = useState(entry?.durationDays ?? 1);
  const [recurrence, setRecurrence] = useState<Recurrence>(entry?.recurrence ?? { kind: "none" });
  const [until, setUntil] = useState<number | null>(entry?.untilDay ?? null);
  const [links, setLinks] = useState<ArticleRef[]>(entry?.articleLinks ?? []);
  const [article, setArticle] = useState<string | null>(entry?.articleId ?? null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [tab, setTab] = useState<Tab>("details");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const worldDay = safe(() => toWorldDay(def, date), null);
  const isEvent = kind === "event" && !occurrence;
  const accent = color || meta.color;

  useEffect(() => {
    if (kind !== "link") return;
    let cancelled = false;
    loadCandidates()
      .then((c) => !cancelled && setCandidates(c))
      .catch(() => !cancelled && setError("Could not load the articles."));
    return () => {
      cancelled = true;
    };
  }, [kind]);

  async function save() {
    if (worldDay === null) {
      setTab("details");
      setError("Pick a date that exists in this calendar.");
      return;
    }
    setSaving(true);
    setError(null);
    type Res = { entry: ClientEntry; articleNames: Record<string, string> };
    let res;
    if (occurrence) {
      res = await api<Res>("PATCH", `/api/calendar-entries/${mode.entry.id}`, {
        occurrence: mode.key,
        exception: { moveTo: worldDay === mode.key ? undefined : worldDay, title: title !== mode.entry.title ? title : undefined, description: description !== mode.entry.description ? description : undefined },
      });
    } else {
      const body: Record<string, unknown> = { worldDay, title, description, category, color, source: { calendarId, version: world.calendars.find((c) => c.id === calendarId)?.version ?? 1 } };
      if (kind === "event") Object.assign(body, { durationDays: duration, recurrence, untilDay: recurrence.kind === "none" ? null : until, articleLinks: links });
      if (kind === "link") Object.assign(body, { articleId: article, articleTemplate: article ? (candidates?.find((c) => c.id === article)?.template ?? "generic") : null });
      res = mode.kind === "create" ? await api<Res>("POST", "/api/calendar-entries", { ...body, kind }) : await api<Res>("PATCH", `/api/calendar-entries/${mode.entry.id}`, body);
    }
    setSaving(false);
    if (res.ok) onSaved(res.data.entry, res.data.articleNames);
    else setError(res.data.error ?? "Could not save.");
  }

  const heading = mode.kind === "create" ? `New ${meta.label}` : occurrence ? "Change This Occurrence" : `Edit ${meta.label}`;
  const tabs: { key: Tab; label: string; badge?: string }[] = [
    { key: "details", label: "Details" },
    { key: "repeats", label: "Repeats", badge: recurrence.kind === "none" ? undefined : "on" },
    { key: "articles", label: "Articles", badge: links.length ? String(links.length) : undefined },
  ];
  const canSave = !saving && !(kind === "link" && !article) && !(kind === "event" && !title.trim());

  const when = (
    <Section title="When" hint={occurrence ? "Pick another day to move only this occurrence." : undefined}>
      <DateInput def={def} label={isEvent ? "Starts on" : "Date"} value={date} onChange={setDate} />
      {isEvent && (
        <label className="cel-cycle">
          <span>Lasts</span>
          <input type="number" min={1} max={1000} value={duration} aria-label="Duration in days" onChange={(e) => setDuration(Math.min(1000, Math.max(1, Math.floor(Number(e.target.value)) || 1)))} />
          <span>day{duration === 1 ? "" : "s"}</span>
          {worldDay !== null && duration > 1 && <span className="cal-help">· ends {dayLabel(def, worldDay + duration - 1)}</span>}
        </label>
      )}
    </Section>
  );

  return (
    <Modal open onClose={onClose} title={heading} size="wide">
      <div className="cel-editor">
        <div className="cel-hero">
          <span className="cel-badge entry-badge" style={{ color: accent, borderColor: accent }} aria-hidden>
            <meta.Icon size={26} strokeWidth={1.75} />
          </span>
          <div className="cel-hero-text">
            {kind === "link" ? (
              <InfoPicker options={candidateOptions(candidates ?? [])} value={article} placeholder={candidates ? "Pick the article to link…" : "Loading articles…"} ariaLabel="Article to link" collapsibleGroups disabled={!candidates} onChange={setArticle} />
            ) : (
              <input type="text" className="cel-name-input" value={title} maxLength={200} autoFocus placeholder={kind === "note" ? "Title (optional)" : "What happens?"} aria-label="Title" onChange={(e) => setTitle(e.target.value)} />
            )}
            <span className="cel-type-pill">
              <meta.Icon size={12} aria-hidden /> {occurrence ? `One occurrence of a repeating ${meta.label.toLowerCase()}` : meta.label}
              {entry && !occurrence && entry.recurrence.kind !== "none" && (
                <>
                  {" "}
                  · <Repeat size={11} aria-hidden /> {describeRecurrence(entry.recurrence, ctx)}
                </>
              )}
            </span>
          </div>
        </div>

        {isEvent && (
          <nav className="cal-editor-tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "cal-tab active" : "cal-tab"} onClick={() => setTab(t.key)}>
                {t.label}
                {t.badge && <span className="cel-tab-count">{t.badge}</span>}
              </button>
            ))}
          </nav>
        )}

        <div className="cel-body entry-body" role={isEvent ? "tabpanel" : undefined}>
          {(!isEvent || tab === "details") && (
            <>
              {when}
              {kind !== "link" && (
                <label className="cel-section">
                  <h3>{kind === "note" ? "Summary" : "Description"}</h3>
                  {kind === "note" && <span className="cal-help">A short line. The note&apos;s full, formatted text is written on the day itself.</span>}
                  <textarea rows={3} maxLength={4000} value={description} placeholder={kind === "note" ? "In a few words…" : "What happened, who was there…"} onChange={(e) => setDescription(e.target.value)} />
                </label>
              )}
              {!occurrence && (
                <Section title="Category" hint="Group similar entries (Festival, War, Birthday…) and filter the calendar by them.">
                  <input type="text" list="cal-categories" maxLength={60} value={category} placeholder="None" aria-label="Category" onChange={(e) => setCategory(e.target.value)} />
                  <datalist id="cal-categories">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  {categories.length > 0 && (
                    <div className="entry-chips">
                      {categories.map((c) => (
                        <button key={c} type="button" className={c === category ? "entry-chip active" : "entry-chip"} onClick={() => setCategory(c === category ? "" : c)}>
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </Section>
              )}
              {isEvent && (
                <Section title="Color" hint="Marks the event on the calendar.">
                  <div className="entry-swatches">
                    <button type="button" className={!color ? "entry-swatch active" : "entry-swatch"} style={{ background: meta.color }} aria-label="Default color" aria-pressed={!color} onClick={() => setColor("")} />
                    {SWATCHES.filter((s) => s !== meta.color).map((s) => (
                      <button key={s} type="button" className={s === color.toUpperCase() ? "entry-swatch active" : "entry-swatch"} style={{ background: s }} aria-label={`Color ${s}`} aria-pressed={s === color.toUpperCase()} onClick={() => setColor(s)} />
                    ))}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWheelOpen(!wheelOpen)}>
                      {wheelOpen ? "Close" : "Custom…"}
                    </button>
                  </div>
                  {wheelOpen && <ColorWheel value={color || meta.color} onChange={setColor} />}
                </Section>
              )}
            </>
          )}
          {isEvent && tab === "repeats" && (
            <Section title="Repeats" hint="Occurrences are worked out from the rule; nothing is copied, so editing the rule updates them all.">
              <RecurrenceBuilder value={recurrence} onChange={setRecurrence} def={def} calendarId={calendarId} start={worldDay ?? startDay} until={until} onUntil={setUntil} world={world} ctx={ctx} />
            </Section>
          )}
          {isEvent && tab === "articles" && <ArticleLinksSection links={links} onChange={setLinks} hint="The people, places and organizations involved." />}
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="cel-footer">
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-sm btn-primary" disabled={!canSave} onClick={save}>
            {saving ? "Saving…" : mode.kind === "create" ? `Add ${meta.label.toLowerCase()}` : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
