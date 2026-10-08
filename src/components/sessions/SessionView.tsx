"use client";

import { formatDecimal, formatInteger } from "@/server/settings/number-format";
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
import { articleHref, isArticleTemplate, templateLabel } from "@/server/articles/templates";
import { xpShares } from "@/server/sessions/totals";
import { Avatar, recipientName } from "./parts";
import type { ClientCampaign, ClientSession } from "./types";
import { Skeleton } from "@/components/Skeleton";
import { LOG_ACTION_LABELS, type QuestData } from "@/server/quests/types";
import { StatusChip } from "@/components/quests/parts";
import { useT } from "@/i18n/useT";

/** Linked articles as chips, grouped under their template (NPCs, places, organizations, items…). */
function Involved({ links }: { links: ClientSession["articleLinks"] }) {
  const t = useT("campaign");
  const ta = useT("articles");
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
  if (links.length === 0) return <p className="cal-help">{t("view.noneLinked")}</p>;
  const groups = new Map<string, typeof links>();
  for (const l of links) groups.set(l.template, [...(groups.get(l.template) ?? []), l]);
  return (
    <div className="ss-groups">
      {[...groups].map(([template, list]) => (
        <div key={template}>
          <span className="field-label">{isArticleTemplate(template) ? templateLabel(template, ta) : t("sessionView.other")}</span>
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
                    <span className="cv-article cal-removed">{candidates ? t("quest.removed") : <Skeleton className="skeleton-inline" width={110} />}</span>
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
  const te = useT("editor");
  const t = useT("campaign");
  const tc = useT("common");
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
    else setDeleteError(res.data.error ?? t("quest.couldNotDelete"));
  }

  return (
    <Modal open onClose={onClose} title={campaign.name} size="wide">
      <div className="cv ss-view">
        <header className="cv-hero">
          <span className="cv-badge ss-badge" aria-hidden>
            <span className="ss-badge-label">{t("sessionView.session")}</span>
            {session.number}
          </span>
          <div className="cv-hero-text">
            <h2 className="cv-name">{session.title || t("session.label", { n: session.number })}</h2>
            <div className="cv-tags">
              {span && (
                <span className="cv-tag" data-tooltip={t("sessionView.inWorldDates")}>
                  <CalendarDays size={13} aria-hidden /> {span}
                </span>
              )}
              {played && (
                <span className="cv-tag" data-tooltip={t("sessionView.playedOn")}>
                  <ScrollText size={13} aria-hidden /> {t("sessionView.played", { date: played })}
                </span>
              )}
            </div>
            {present.length > 0 && (
              <div className="ss-present" aria-label={t("sessionView.whoPlayed")}>
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
              <BookOpen size={14} aria-hidden /> {t("sessionView.recap")}
            </h3>
            <RichEditor documentId={session.recapDocumentId} editable={false} placeholder={te("placeholder.sessionRecapEmpty")} />
          </section>
        )}

        <div className="cv-grid">
          <Block title={t("sessionView.keyEvents")} Icon={ListChecks}>
            <Lines lines={session.notes.events} empty={t("sessionView.noEvents")} />
          </Block>
          <Block title={t("sessionView.decisions")} Icon={Waypoints}>
            <Lines lines={session.notes.decisions} empty={t("sessionView.noDecisions")} />
          </Block>
          <Block title={t("sessionView.quests")} Icon={Swords}>
            {session.questLog.length === 0 ? (
              <p className="cal-help">{t("sessionView.noQuests")}</p>
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
                        <span className="cal-removed">{t("questLog.deleted")}</span>
                      )}
                      {line.note && <p className="qs-history-note">{line.note}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Block>
          <Block title={t("links.title")} Icon={Users}>
            <Involved links={session.articleLinks} />
          </Block>
          <Block title={t("sessionView.partyXp")} Icon={Users}>
            {present.length === 0 ? (
              <p className="cal-help">{t("sessionView.nobodyPlayed")}</p>
            ) : (
              <ul className="cv-list">
                {present.map((m) => (
                  <li key={m.id}>
                    <Avatar member={m} />
                    <span className="cv-list-main">
                      <strong>{m.name ?? t("parts.deletedCharacter")}</strong>
                      {m.playerName && <span className="cal-help">{m.playerName}</span>}
                    </span>
                    {session.xpTotal !== null || m.personId in session.xpOverrides ? <span className="cv-chip">{t("session.xp", { n: formatInteger(shares[m.personId] ?? 0) })}</span> : null}
                  </li>
                ))}
              </ul>
            )}
            {session.xpTotal === null && <p className="cal-help">{t("sessionView.milestone")}</p>}
          </Block>
          <Block title={t("sessionView.loot")} Icon={Gem}>
            {session.loot.length === 0 ? (
              <p className="cal-help">{t("sessionView.noLoot")}</p>
            ) : (
              <ul className="cv-list">
                {session.loot.map((l) => (
                  <li key={l.id}>
                    <span className="cv-list-main">
                      <strong>
                        {l.quantity > 1 ? `${l.quantity} × ` : ""}
                        {l.articleId && l.template && isArticleTemplate(l.template) ? <Link href={articleHref(l.template, l.articleId)}>{l.name || t("sessionView.item")}</Link> : l.name}
                      </strong>
                      <span className="cal-help">
                        {recipientName(l.recipient, roster)}
                        {l.value ? ` · ${t("sessionView.each", { amount: formatDecimal(l.value.amount), coin: coinName(l.value.currencyId) })}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Block>
          <Block title={t("sessionView.coins")} Icon={Coins}>
            {session.coins.length === 0 ? (
              <p className="cal-help">{t("sessionView.noCoins")}</p>
            ) : (
              <ul className="cv-list">
                {session.coins.map((c) => (
                  <li key={c.id}>
                    <span className="cv-list-main">
                      <strong className={c.amount < 0 ? "ss-spent" : "ss-gained"}>
                        {c.amount > 0 ? "+" : ""}
                        {formatDecimal(c.amount)} {coinName(c.currencyId)}
                      </strong>
                      <span className="cal-help">{recipientName(c.recipient, roster)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Block>
          {session.notes.nextSession && (
            <Block title={t("sessionView.nextSession")} Icon={ScrollText}>
              <p className="cv-description">{session.notes.nextSession}</p>
            </Block>
          )}
        </div>

        <div className="cel-footer">
          <button type="button" className="btn btn-sm btn-danger cel-footer-delete" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} /> {tc("delete")}
          </button>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            {tc("close")}
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onEdit}>
            <Pencil size={14} /> {t("view.edit")}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        danger
        title={t("sessionView.deleteTitle", { n: session.number })}
        confirmLabel={tc("delete")}
        error={deleteError}
        onConfirm={remove}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteError(null);
        }}
      >
        {t("sessionView.deleteBody")}
      </ConfirmDialog>
    </Modal>
  );
}
