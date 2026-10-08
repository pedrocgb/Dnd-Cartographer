"use client";

import { formatDecimal, formatInteger } from "@/server/settings/number-format";
import { useState } from "react";
import { BookOpen, Flame, Gem, GitBranch, History, KeyRound, ListChecks, Pencil, Plus, ScrollText, Timer, Trash2, UserRound, Users } from "lucide-react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import RichEditor from "@/components/RichEditor";
import MentionBacklinks from "@/components/MentionBacklinks";
import type { Candidate } from "@/components/articles/candidates";
import { api } from "@/components/calendars/api";
import { dayLabel } from "@/components/calendars/evaluate";
import { Block } from "@/components/calendars/view-parts";
import { formatIsoDate } from "@/components/DatePicker";
import type { CalendarDefinition } from "@/server/calendars/engine";
import { questHistory, questTree, type TreeNode } from "@/server/quests/logic";
import { hasRewards, LINK_ROLE_LABELS, LINK_ROLES, LOG_ACTION_LABELS, PRIORITY_LABELS, type FrontData, type QuestData } from "@/server/quests/types";
import type { Currency } from "@/server/sessions/types";
import type { ClientSession } from "@/components/sessions/types";
import { ArticleName, DeadlineChip, KindChip, Progress, StatusChip } from "./parts";
import ProgressClock from "./ProgressClock";
import { CoverageHint } from "./QuestDepthTabs";
import { useT } from "@/i18n/useT";

/**
 * Read-only view of a quest: its hook, objectives (tickable here), sub-quests,
 * secrets & clues (revealable here), its clock (tickable here), rewards,
 * who and where is involved (by role), its history across sessions and the
 * DM's notes. Everything else goes through Edit.
 */
export default function QuestView({
  quest,
  quests,
  fronts,
  currencies,
  sessions,
  candidates,
  def,
  today,
  onOpenQuest,
  onOpenSession,
  onEdit,
  onAddSub,
  onChanged,
  onDeleted,
  onClose,
}: {
  quest: QuestData;
  quests: QuestData[];
  fronts: FrontData[];
  currencies: Currency[];
  sessions: ClientSession[];
  candidates: Candidate[] | null;
  def: CalendarDefinition | null;
  /** The world's current day (deadline countdown). */
  today: number;
  onOpenQuest: (id: string) => void;
  onOpenSession: (id: string) => void;
  onEdit: () => void;
  onAddSub: () => void;
  onChanged: (q: QuestData) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const te = useT("editor");
  const t = useT("campaign");
  const tc = useT("common");
  const [error, setError] = useState<string | null>(null);
  const parent = quests.find((q) => q.id === quest.parentId) ?? null;
  const subtree = questTree(quests).flatMap(function find(n): TreeNode<QuestData>[] {
    return n.quest.id === quest.id ? n.children : n.children.flatMap(find);
  });
  const history = questHistory(sessions, quest.id);
  const front = fronts.find((f) => f.id === quest.frontId) ?? null;
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function remove() {
    const res = await api("DELETE", `/api/quests/${quest.id}`);
    if (res.ok) onDeleted(quest.id);
    else setDeleteError(res.data.error ?? t("quest.couldNotDelete"));
  }

  /** Saves one small edit made in the view (objective, clue, clock). */
  async function patch(fields: Partial<QuestData>, failure: string) {
    setError(null);
    setBusy(true);
    const res = await api<{ quest: QuestData }>("PATCH", `/api/quests/${quest.id}`, { expectedVersion: quest.version, ...fields });
    setBusy(false);
    if (res.ok) onChanged(res.data.quest);
    else setError(res.data.error ?? failure);
  }

  const toggleObjective = (id: string, done: boolean) =>
    patch({ objectives: quest.objectives.map((o) => (o.id === id ? { ...o, state: done ? ("done" as const) : ("open" as const) } : o)) }, t("view.couldNotUpdateObjective"));
  const toggleClue = (id: string, revealed: boolean) =>
    patch({ clues: quest.clues.map((c) => (c.id === id ? { ...c, revealed, revealedSessionId: revealed ? c.revealedSessionId : null } : c)) }, t("view.couldNotUpdateClue"));
  const sessionName = (id: string | null) => {
    const s = id ? sessions.find((x) => x.id === id) : null;
    return s ? t("view.sessionN", { n: s.number }) : null;
  };

  return (
    <Modal open onClose={onClose} title={t("view.title")} size="wide">
      <div className="cv qs-view">
        <header className="cv-hero">
          <span className={`cv-badge qs-badge qs-badge-${quest.status}`} aria-hidden>
            <ScrollText size={26} strokeWidth={1.75} />
          </span>
          <div className="cv-hero-text">
            <h2 className="cv-name">{quest.title}</h2>
            <div className="qs-view-chips">
              <StatusChip status={quest.status} />
              <KindChip kind={quest.kind} />
            </div>
            {(quest.priority !== 1 || quest.giver || front || parent) && (
              <div className="cv-tags">
                {quest.priority !== 1 && <span className="cv-tag">{t("view.priority", { priority: PRIORITY_LABELS[quest.priority] })}</span>}
                {quest.giver && (
                  <span className="cv-tag" data-tooltip={t("quest.giver")}>
                    <UserRound size={13} aria-hidden /> <ArticleName link={quest.giver} candidates={candidates} />
                  </span>
                )}
                {front && (
                  <span className="cv-tag qs-front-tag" style={front.color ? { ["--qs-front" as string]: front.color } : undefined} data-tooltip={t("quest.front")}>
                    <Flame size={13} aria-hidden /> {front.name}
                  </span>
                )}
                {parent && (
                  <button type="button" className="cv-tag qs-tag-button" data-tooltip={t("view.partOf")} onClick={() => onOpenQuest(parent.id)}>
                    <GitBranch size={13} aria-hidden /> {parent.title}
                  </button>
                )}
              </div>
            )}
            <Progress objectives={quest.objectives} />
            {(quest.startDay !== null || quest.deadlineDay !== null || quest.endDay !== null) && (
              <div className="qs-view-dates">
                {quest.startDay !== null && <span className="cal-help">{t("view.startedOn", { date: def ? dayLabel(def, quest.startDay, { weekday: false }) : t("quest.dayN", { n: quest.startDay }) })}</span>}
                <DeadlineChip quest={quest} def={def} today={today} />
                {quest.endDay !== null && <span className="cal-help">{t("view.endedOn", { date: def ? dayLabel(def, quest.endDay, { weekday: false }) : t("quest.dayN", { n: quest.endDay }) })}</span>}
              </div>
            )}
          </div>
        </header>

        {quest.summary && <p className="cv-description">{quest.summary}</p>}

        <div className="cv-grid">
          <Block title={t("view.objectives")} Icon={ListChecks}>
            {quest.objectives.length === 0 ? (
              <p className="cal-help">{t("view.noObjectives")}</p>
            ) : (
              <ul className="ss-threads">
                {quest.objectives.map((o) => (
                  <li key={o.id}>
                    <label className={o.state === "open" ? "cal-check" : "cal-check ss-resolved"}>
                      <input type="checkbox" checked={o.state === "done"} disabled={busy || o.state === "failed"} onChange={(e) => toggleObjective(o.id, e.target.checked)} /> {o.text}
                      {o.optional && <span className="cal-help"> {t("view.optional")}</span>}
                      {o.state === "failed" && <span className="qs-failed-mark"> {t("view.failed")}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Block>
          {quest.clock && (
            <Block title={t("quest.clock")} Icon={Timer}>
              <div className="qs-clock-view">
                <ProgressClock clock={quest.clock} size={88} disabled={busy} onSet={(filled) => quest.clock && patch({ clock: { ...quest.clock, filled } }, t("fronts.couldNotTick"))} />
                <span>
                  <strong>{quest.clock.label || t("view.progress")}</strong>
                  <span className="cal-help">
                    {t("view.clockCount", { filled: quest.clock.filled, segments: quest.clock.segments })}
                    {quest.clock.filled >= quest.clock.segments ? ` ${t("view.full")}` : ""}
                  </span>
                </span>
              </div>
            </Block>
          )}
          <Block title={t("clues.title")} Icon={KeyRound}>
            <CoverageHint clues={quest.clues} />
            {quest.clues.length > 0 && (
              <ul className="qs-clues">
                {quest.clues.map((c) => (
                  <li key={c.id}>
                    <label className={c.revealed ? "cal-check ss-resolved" : "cal-check"}>
                      <input type="checkbox" checked={c.revealed} disabled={busy} onChange={(e) => toggleClue(c.id, e.target.checked)} /> {c.text}
                      {c.revealed && sessionName(c.revealedSessionId) && <span className="cal-help"> ({sessionName(c.revealedSessionId)})</span>}
                    </label>
                    {c.placedIn.length > 0 && (
                      <span className="qs-clue-places">
                        {c.placedIn.map((p) => (
                          <ArticleName key={p.articleId} link={p} candidates={candidates} />
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Block>
          {hasRewards(quest.rewards) && quest.rewards && (
            <Block title={t("view.rewards")} Icon={Gem}>
              <ul className="cv-articles qs-rewards">
                {quest.rewards.xp !== null && <li className="cv-chip">{t("view.xp", { n: formatInteger(quest.rewards.xp) })}</li>}
                {quest.rewards.coins.map((c, i) => (
                  <li key={i} className="cv-chip">
                    {formatDecimal(c.amount)} {currencies.find((x) => x.id === c.currencyId)?.short ?? "?"}
                  </li>
                ))}
                {quest.rewards.items.map((it) => (
                  <li key={it.id}>
                    {it.quantity > 1 ? `${it.quantity}× ` : ""}
                    {it.articleId && it.template ? <ArticleName link={{ template: it.template, articleId: it.articleId }} candidates={candidates} /> : it.name}
                  </li>
                ))}
              </ul>
            </Block>
          )}
          <Block title={t("view.subQuests")} Icon={GitBranch}>
            {subtree.length === 0 ? <p className="cal-help">{t("view.none")}</p> : <SubTree nodes={subtree} onOpen={onOpenQuest} />}
            <button type="button" className="btn btn-sm qs-add-sub" onClick={onAddSub}>
              <Plus size={14} /> {t("view.addSub")}
            </button>
          </Block>
          <Block title={t("links.title")} Icon={Users}>
            <Involved quest={quest} candidates={candidates} />
          </Block>
          <Block title={t("view.history")} Icon={History}>
            {history.length === 0 ? (
              <p className="cal-help">{t("view.noHistory")}</p>
            ) : (
              <ol className="qs-history">
                {history.map((h) => (
                  <li key={h.sessionId} className={`qs-history-${h.action}`}>
                    <button type="button" className="qs-history-session" onClick={() => onOpenSession(h.sessionId)}>
                      {h.sessionTitle ? t("view.sessionTitleNamed", { n: h.sessionNumber, title: h.sessionTitle }) : t("view.sessionTitle", { n: h.sessionNumber })}
                    </button>
                    <span className="qs-history-action">{LOG_ACTION_LABELS[h.action]}</span>
                    <span className="cal-help">{[def && h.startDay !== null ? dayLabel(def, h.startDay, { weekday: false }) : null, h.playedOn ? t("view.played", { date: formatIsoDate(h.playedOn) }) : null].filter(Boolean).join(" · ")}</span>
                    {h.note && <p className="qs-history-note">{h.note}</p>}
                    {h.clueIds.length > 0 && (
                      <ul className="qs-history-objectives">
                        {h.clueIds.map((id) => (
                          <li key={id}><KeyRound size={11} aria-hidden /> {quest.clues.find((c) => c.id === id)?.text ?? t("view.removedClue")}</li>
                        ))}
                      </ul>
                    )}
                    {h.clockTicks !== 0 && <span className="cal-help">{t("view.clockTicks", { ticks: h.clockTicks > 0 ? `+${h.clockTicks}` : h.clockTicks })}</span>}
                    {h.objectiveIds.length > 0 && (
                      <ul className="qs-history-objectives">
                        {h.objectiveIds.map((id) => (
                          <li key={id}>✓ {quest.objectives.find((o) => o.id === id)?.text ?? t("view.removedObjective")}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Block>
        </div>

        {quest.bodyDocumentId && (
          <section className="cv-block">
            <h3 className="cv-block-title">
              <BookOpen size={14} aria-hidden /> {t("view.notes")}
            </h3>
            <RichEditor documentId={quest.bodyDocumentId} editable={false} placeholder={te("placeholder.questNotes")} />
          </section>
        )}
        <MentionBacklinks targetId={quest.id} variant="plain" />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
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
        title={t("quest.deleteNamed", { name: quest.title })}
        confirmLabel={tc("delete")}
        error={deleteError}
        onConfirm={remove}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteError(null);
        }}
      >
        {t("quest.subQuestsMoveUp")}
      </ConfirmDialog>
    </Modal>
  );
}

function SubTree({ nodes, onOpen }: { nodes: TreeNode<QuestData>[]; onOpen: (id: string) => void }) {
  return (
    <ul className="qs-subtree">
      {nodes.map((n) => (
        <li key={n.quest.id}>
          <button type="button" className="qs-sub-link" onClick={() => onOpen(n.quest.id)}>
            <StatusChip status={n.quest.status} /> {n.quest.title}
          </button>
          {n.children.length > 0 && <SubTree nodes={n.children} onOpen={onOpen} />}
        </li>
      ))}
    </ul>
  );
}

function Involved({ quest, candidates }: { quest: QuestData; candidates: Candidate[] | null }) {
  const t = useT("campaign");
  if (quest.articleLinks.length === 0) return <p className="cal-help">{t("view.noneLinked")}</p>;
  return (
    <div className="ss-groups">
      {LINK_ROLES.map((role) => {
        const list = quest.articleLinks.filter((l) => l.role === role);
        return (
          list.length > 0 && (
            <div key={role}>
              <span className="field-label">{LINK_ROLE_LABELS[role]}</span>
              <ul className="cv-articles">
                {list.map((l) => (
                  <li key={l.articleId}>
                    <ArticleName link={l} candidates={candidates} />
                  </li>
                ))}
              </ul>
            </div>
          )
        );
      })}
    </div>
  );
}
