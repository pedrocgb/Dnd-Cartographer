"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, Coins, Gem, Link2, ListChecks, Pencil, ScrollText, Swords, Trash2, Users, Waypoints } from "lucide-react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import RichEditor from "@/components/RichEditor";
import { formatIsoDate } from "@/components/DatePicker";
import { loadCandidates, type Candidate } from "@/components/articles/candidates";
import { api } from "@/components/calendars/api";
import { dayLabel } from "@/components/calendars/evaluate";
import { Block } from "@/components/calendars/view-parts";
import type { ClientCalendar } from "@/components/calendars/types";
import { articleHref, isArticleTemplate, TEMPLATE_LABELS } from "@/server/articles/templates";
import { xpShares } from "@/server/sessions/totals";
import { Avatar, recipientName } from "./parts";
import type { ClientCampaign, ClientSession } from "./types";
import { Skeleton } from "@/components/Skeleton";
import { LOG_ACTION_LABELS, type QuestData } from "@/server/quests/types";
import { StatusChip } from "@/components/quests/parts";

/** Linked articles as chips, grouped under their template (NPCs, places, organizations, items…). */
function Involved({ links }: { links: ClientSession["articleLinks"] }) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  useEffect(() => {
    if (links.length === 0) return;
    let cancelled = false;
    loadCandidates()
      .then((c) => !cancelled && setCandidates(c))
      .catch(() => !cancelled && setCandidates([]));
    return () => {
      cancelled = true;
    };
  }, [links.length]);
  if (links.length === 0) return <p className="cal-help">Nobody and nowhere linked yet.</p>;
  const groups = new Map<string, typeof links>();
  for (const l of links) groups.set(l.template, [...(groups.get(l.template) ?? []), l]);
  return (
    <div className="ss-groups">
      {[...groups].map(([template, list]) => (
        <div key={template}>
          <span className="field-label">{isArticleTemplate(template) ? TEMPLATE_LABELS[template] : "Other"}</span>
          <ul className="cv-articles">
            {list.map((l) => {
              const c = candidates?.find((x) => x.id === l.articleId);
              return (
                <li key={l.articleId}>
                  {c && isArticleTemplate(c.template) ? (
                    <Link className="cv-article" href={articleHref(c.template, c.id)}>
                      <Link2 size={13} aria-hidden /> {c.name}
                    </Link>
                  ) : (
                    <span className="cv-article cal-removed">{candidates ? "(removed)" : <Skeleton className="skeleton-inline" width={110} />}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Lines({ lines, empty }: { lines: string[]; empty: string }) {
  if (lines.length === 0) return <p className="cal-help">{empty}</p>;
  return (
    <ul className="ss-bullets">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}

/**
 * Read-only view of a session: dates, who played, the recap, notes, who and
 * where was involved, the quests it moved, XP, loot and coins. Changes go
 * through "Edit".
 */
export default function SessionView({
  session,
  campaign,
  calendars,
  quests,
  onOpenQuest,
  onEdit,
  onDeleted,
  onClose,
}: {
  session: ClientSession;
  campaign: ClientCampaign;
  calendars: ClientCalendar[];
  quests: QuestData[];
  onOpenQuest: (id: string) => void;
  onEdit: () => void;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const def = calendars.find((c) => c.id === campaign.calendarId)?.definition ?? null;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const roster = campaign.roster;
  const present = roster.filter((m) => session.attendance.includes(m.personId));
  const shares = xpShares(session.attendance, session.xpTotal, session.xpOverrides, roster.map((m) => m.personId));
  const coinName = (id: string) => campaign.currencies.find((c) => c.id === id)?.short ?? "?";
  const span =
    def && session.startDay !== null
      ? session.endDay !== null && session.endDay > session.startDay
        ? `${dayLabel(def, session.startDay, { weekday: false })} – ${dayLabel(def, session.endDay, { weekday: false })}`
        : dayLabel(def, session.startDay, { weekday: false })
      : null;
  const played = session.playedOn ? formatIsoDate(session.playedOn) : null;

  async function remove() {
    const res = await api("DELETE", `/api/sessions/${session.id}`);
    if (res.ok) onDeleted();
    else setDeleteError(res.data.error ?? "Could not delete it.");
  }

  return (
    <Modal open onClose={onClose} title={campaign.name} size="wide">
      <div className="cv ss-view">
        <header className="cv-hero">
          <span className="cv-badge ss-badge" aria-hidden>
            <span className="ss-badge-label">Session</span>
            {session.number}
          </span>
          <div className="cv-hero-text">
            <h2 className="cv-name">{session.title || `Session ${session.number}`}</h2>
            <div className="cv-tags">
              {span && (
                <span className="cv-tag" data-tooltip="In-world dates">
                  <CalendarDays size={13} aria-hidden /> {span}
                </span>
              )}
              {played && (
                <span className="cv-tag" data-tooltip="Played on">
                  <ScrollText size={13} aria-hidden /> Played {played}
                </span>
              )}
            </div>
            {present.length > 0 && (
              <div className="ss-present" aria-label="Who played">
                {present.map((m) => (
                  <Avatar key={m.id} member={m} />
                ))}
              </div>
            )}
          </div>
        </header>

        {session.recapDocumentId && (
          <section className="cv-block">
            <h3 className="cv-block-title">
              <BookOpen size={14} aria-hidden /> Recap
            </h3>
            <RichEditor documentId={session.recapDocumentId} editable={false} placeholder="No recap yet. Use Edit to write one." />
          </section>
        )}

        <div className="cv-grid">
          <Block title="Key events" Icon={ListChecks}>
            <Lines lines={session.notes.events} empty="No key events noted." />
          </Block>
          <Block title="Party decisions" Icon={Waypoints}>
            <Lines lines={session.notes.decisions} empty="No decisions noted." />
          </Block>
          <Block title="Quests" Icon={Swords}>
            {session.questLog.length === 0 ? (
              <p className="cal-help">No quest logged this session.</p>
            ) : (
              <ul className="qs-session-quests">
                {session.questLog.map((line) => {
                  const quest = quests.find((q) => q.id === line.questId);
                  return (
                    <li key={line.questId}>
                      <span className="qs-history-action">{LOG_ACTION_LABELS[line.action]}</span>
                      {quest ? (
                        <button type="button" className="qs-sub-link" onClick={() => onOpenQuest(quest.id)}>
                          <StatusChip status={quest.status} /> {quest.title}
                        </button>
                      ) : (
                        <span className="cal-removed">(deleted quest)</span>
                      )}
                      {line.note && <p className="qs-history-note">{line.note}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Block>
          <Block title="Who and where" Icon={Users}>
            <Involved links={session.articleLinks} />
          </Block>
          <Block title="Party & XP" Icon={Users}>
            {present.length === 0 ? (
              <p className="cal-help">Nobody marked as playing.</p>
            ) : (
              <ul className="cv-list">
                {present.map((m) => (
                  <li key={m.id}>
                    <Avatar member={m} />
                    <span className="cv-list-main">
                      <strong>{m.name ?? "(deleted character)"}</strong>
                      {m.playerName && <span className="cal-help">{m.playerName}</span>}
                    </span>
                    {session.xpTotal !== null || m.personId in session.xpOverrides ? <span className="cv-chip">{(shares[m.personId] ?? 0).toLocaleString()} XP</span> : null}
                  </li>
                ))}
              </ul>
            )}
            {session.xpTotal === null && <p className="cal-help">Milestone session (no XP).</p>}
          </Block>
          <Block title="Loot" Icon={Gem}>
            {session.loot.length === 0 ? (
              <p className="cal-help">No loot.</p>
            ) : (
              <ul className="cv-list">
                {session.loot.map((l) => (
                  <li key={l.id}>
                    <span className="cv-list-main">
                      <strong>
                        {l.quantity > 1 ? `${l.quantity} × ` : ""}
                        {l.articleId && l.template && isArticleTemplate(l.template) ? <Link href={articleHref(l.template, l.articleId)}>{l.name || "Item"}</Link> : l.name}
                      </strong>
                      <span className="cal-help">
                        {recipientName(l.recipient, roster)}
                        {l.value ? ` · ${l.value.amount.toLocaleString()} ${coinName(l.value.currencyId)} each` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Block>
          <Block title="Coins" Icon={Coins}>
            {session.coins.length === 0 ? (
              <p className="cal-help">No coins changed hands.</p>
            ) : (
              <ul className="cv-list">
                {session.coins.map((c) => (
                  <li key={c.id}>
                    <span className="cv-list-main">
                      <strong className={c.amount < 0 ? "ss-spent" : "ss-gained"}>
                        {c.amount > 0 ? "+" : ""}
                        {c.amount.toLocaleString()} {coinName(c.currencyId)}
                      </strong>
                      <span className="cal-help">{recipientName(c.recipient, roster)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Block>
          {session.notes.nextSession && (
            <Block title="For next session" Icon={ScrollText}>
              <p className="cv-description">{session.notes.nextSession}</p>
            </Block>
          )}
        </div>

        <div className="cel-footer">
          <button type="button" className="btn btn-sm btn-danger cel-footer-delete" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} /> Delete
          </button>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onEdit}>
            <Pencil size={14} /> Edit
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        danger
        title={`Delete session ${session.number}?`}
        confirmLabel="Delete"
        error={deleteError}
        onConfirm={remove}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteError(null);
        }}
      >
        The session, its loot, coins and XP leave the campaign&apos;s totals. Its number becomes free again.
      </ConfirmDialog>
    </Modal>
  );
}
