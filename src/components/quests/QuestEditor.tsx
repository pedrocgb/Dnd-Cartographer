"use client";

import { useState } from "react";
import { BookOpen, CalendarDays, Gem, KeyRound, ListChecks, ScrollText, Timer, Trash2, Waypoints, Plus } from "lucide-react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import RichEditor from "@/components/RichEditor";
import InfoPicker from "@/components/articles/InfoPicker";
import { candidateOptions, type Candidate } from "@/components/articles/candidates";
import { api, newId } from "@/components/calendars/api";
import { descendantsOf } from "@/server/quests/logic";
import {
  OBJECTIVE_STATE_LABELS,
  OBJECTIVE_STATES,
  PRIORITY_LABELS,
  QUEST_KIND_LABELS,
  QUEST_KINDS,
  QUEST_PRIORITIES,
  QUEST_STATUS_LABELS,
  QUEST_STATUSES,
  EMPTY_REWARDS,
  hasRewards,
  type ArticleRef,
  type Clock,
  type Clue,
  type FrontData,
  type Rewards,
  type Objective,
  type ObjectiveState,
  type QuestData,
  type QuestKind,
  type QuestLink,
  type QuestPriority,
  type QuestStatus,
} from "@/server/quests/types";
import type { Currency } from "@/server/sessions/types";
import QuestLinksSection from "./QuestLinksSection";
import { CluesTab, ClockTab, DatesTab, RewardsTab, type QuestDays } from "./QuestDepthTabs";
import type { CalendarDefinition } from "@/server/calendars/engine";
import { useT } from "@/i18n/useT";

type Tab = "general" | "objectives" | "clues" | "clock" | "dates" | "rewards" | "involved" | "notes";

/** What a new quest starts as (from the board's "+" of a column, or a session). */
export interface QuestDraft {
  status?: QuestStatus;
  parentId?: string | null;
}

/**
 * Create or edit a quest in tabs: the basics (type, status, priority,
 * parent, giver, summary), objectives, secrets & clues, its front and
 * clock, rewards, involved articles with their roles, and rich notes
 * (which autosave; available once the quest exists).
 */
export default function QuestEditor({
  campaignId,
  quest,
  draft,
  quests,
  fronts,
  currencies,
  def,
  currentDay,
  candidates,
  onSaved,
  onDeleted,
  onClose,
}: {
  campaignId: string;
  /** Null creates a quest. */
  quest: QuestData | null;
  draft?: QuestDraft;
  /** The campaign's quests (parent choices). */
  quests: QuestData[];
  fronts: FrontData[];
  /** The campaign's coins (rewards). */
  currencies: Currency[];
  /** The campaign's calendar (dates), and the world's current day. */
  def: CalendarDefinition | null;
  currentDay: number;
  candidates: Candidate[] | null;
  onSaved: (q: QuestData) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const te = useT("editor");
  const t = useT("campaign");
  const tc = useT("common");
  const [tab, setTab] = useState<Tab>("general");
  const [title, setTitle] = useState(quest?.title ?? "");
  const [kind, setKind] = useState<QuestKind>(quest?.kind ?? "side");
  const [status, setStatus] = useState<QuestStatus>(quest?.status ?? draft?.status ?? "hook");
  const [priority, setPriority] = useState<QuestPriority>(quest?.priority ?? 1);
  const [parentId, setParentId] = useState<string | null>(quest?.parentId ?? draft?.parentId ?? null);
  const [giver, setGiver] = useState<ArticleRef | null>(quest?.giver ?? null);
  const [summary, setSummary] = useState(quest?.summary ?? "");
  const [objectives, setObjectives] = useState<Objective[]>(quest?.objectives ?? []);
  const [links, setLinks] = useState<QuestLink[]>(quest?.articleLinks ?? []);
  const [clues, setClues] = useState<Clue[]>(quest?.clues ?? []);
  const [frontId, setFrontId] = useState<string | null>(quest?.frontId ?? null);
  const [clock, setClock] = useState<Clock | null>(quest?.clock ?? null);
  const [rewards, setRewards] = useState<Rewards>(quest?.rewards ?? EMPTY_REWARDS);
  const [days, setDays] = useState<QuestDays>({ startDay: quest?.startDay ?? null, deadlineDay: quest?.deadlineDay ?? null, endDay: quest?.endDay ?? null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // A quest can't sit under itself or its own sub-quests.
  const blocked = quest ? new Set([quest.id, ...descendantsOf(quests, quest.id)]) : new Set<string>();
  const parentOptions = quests.filter((q) => !blocked.has(q.id)).sort((a, b) => a.title.localeCompare(b.title)).map((q) => ({ value: q.id, label: q.title }));

  async function save() {
    if (!title.trim()) {
      setTab("general");
      setError(t("problem.questTitle"));
      return;
    }
    setSaving(true);
    setError(null);
    const cleanRewards: Rewards = { xp: rewards.xp, coins: rewards.coins.filter((c) => c.amount > 0), items: rewards.items.filter((it) => it.name.trim() || it.articleId) };
    const body = {
      title,
      kind,
      status,
      priority,
      parentId,
      giver,
      summary,
      objectives: objectives.filter((o) => o.text.trim()),
      articleLinks: links,
      clues: clues.filter((c) => c.text.trim()),
      frontId,
      clock,
      rewards: hasRewards(cleanRewards) ? cleanRewards : null,
      ...days,
    };
    const res = quest
      ? await api<{ quest: QuestData }>("PATCH", `/api/quests/${quest.id}`, { ...body, expectedVersion: quest.version })
      : await api<{ quest: QuestData }>("POST", `/api/campaigns/${campaignId}/quests`, body);
    setSaving(false);
    if (res.ok) onSaved(res.data.quest);
    else setError(res.data.error ?? t("editor.couldNotSave"));
  }

  async function remove() {
    if (!quest) return;
    const res = await api("DELETE", `/api/quests/${quest.id}`);
    if (res.ok) onDeleted(quest.id);
    else setDeleteError(res.data.error ?? t("quest.couldNotDelete"));
  }

  const tabs: { key: Tab; label: string; Icon: typeof ScrollText; count?: number }[] = [
    { key: "general", label: t("editor.tab.general"), Icon: ScrollText },
    { key: "objectives", label: t("editor.tab.objectives"), Icon: ListChecks, count: objectives.length },
    { key: "clues", label: t("editor.tab.clues"), Icon: KeyRound, count: clues.length },
    { key: "clock", label: t("editor.tab.clock"), Icon: Timer },
    { key: "dates", label: t("editor.tab.dates"), Icon: CalendarDays, count: [days.startDay, days.deadlineDay, days.endDay].filter((d) => d !== null).length },
    { key: "rewards", label: t("editor.tab.rewards"), Icon: Gem, count: rewards.coins.length + rewards.items.length + (rewards.xp !== null ? 1 : 0) },
    { key: "involved", label: t("editor.tab.involved"), Icon: Waypoints, count: links.length },
    { key: "notes", label: t("editor.tab.notes"), Icon: BookOpen },
  ];

  return (
    <Modal open onClose={onClose} title={quest ? t("quest.editNamed", { name: quest.title }) : t("editor.new")} size="wide">
      <div className="cel-editor">
        <nav className="cal-editor-tabs" role="tablist">
          {tabs.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={tab === x.key} className={tab === x.key ? "cal-tab active" : "cal-tab"} onClick={() => setTab(x.key)}>
              <x.Icon size={14} aria-hidden /> {x.label}
              {x.count ? <span className="cel-tab-count">{x.count}</span> : null}
            </button>
          ))}
        </nav>
        <div className="cel-body" role="tabpanel">
          {tab === "general" && (
            <GeneralTab
              {...{ title, kind, status, priority, parentId, giver, summary, candidates, parentOptions }}
              onTitle={setTitle}
              onKind={setKind}
              onStatus={setStatus}
              onPriority={setPriority}
              onParent={setParentId}
              onGiver={setGiver}
              onSummary={setSummary}
            />
          )}
          {tab === "objectives" && <ObjectivesTab objectives={objectives} onChange={setObjectives} />}
          {tab === "clues" && <CluesTab clues={clues} candidates={candidates} onChange={setClues} />}
          {tab === "clock" && <ClockTab fronts={fronts} frontId={frontId} clock={clock} onFront={setFrontId} onClock={setClock} />}
          {tab === "dates" && <DatesTab def={def} currentDay={currentDay} days={days} onChange={setDays} />}
          {tab === "rewards" && <RewardsTab rewards={rewards} currencies={currencies} candidates={candidates} onChange={setRewards} />}
          {tab === "involved" && <QuestLinksSection links={links} candidates={candidates} onChange={setLinks} />}
          {tab === "notes" &&
            (quest?.bodyDocumentId ? (
              <div className="cel-section ss-recap-edit">
                <p className="cal-help">{t("editor.notesHelp")}</p>
                <RichEditor documentId={quest.bodyDocumentId} editable mentionCampaignId={campaignId} placeholder={te("placeholder.questBody")} />
              </div>
            ) : (
              <p className="cal-help">{t("editor.notesAfterCreate")}</p>
            ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="cel-footer">
          {quest && (
            <button type="button" className="btn btn-sm btn-danger cel-footer-delete" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} /> {tc("delete")}
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={saving}>
            {tc("cancel")}
          </button>
          <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={save}>
            {saving ? tc("saving") : quest ? t("editor.save") : t("editor.create")}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        danger
        title={t("quest.deleteNamed", { name: quest?.title ?? t("editor.thisQuest") })}
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

function GeneralTab(p: {
  title: string;
  kind: QuestKind;
  status: QuestStatus;
  priority: QuestPriority;
  parentId: string | null;
  giver: ArticleRef | null;
  summary: string;
  candidates: Candidate[] | null;
  parentOptions: { value: string; label: string }[];
  onTitle: (v: string) => void;
  onKind: (v: QuestKind) => void;
  onStatus: (v: QuestStatus) => void;
  onPriority: (v: QuestPriority) => void;
  onParent: (v: string | null) => void;
  onGiver: (v: ArticleRef | null) => void;
  onSummary: (v: string) => void;
}) {
  const t = useT("campaign");
  return (
    <div className="cel-section">
      <label className="cal-field">
        <span className="field-label">{t("editor.title")}</span>
        <input type="text" value={p.title} maxLength={160} placeholder={t("editor.titlePlaceholder")} onChange={(e) => p.onTitle(e.target.value)} autoFocus />
      </label>
      <div className="qs-general-grid">
        <label className="cal-field">
          <span className="field-label">{t("editor.type")}</span>
          <select value={p.kind} onChange={(e) => p.onKind(e.target.value as QuestKind)}>
            {QUEST_KINDS.map((k) => (
              <option key={k} value={k}>
                {QUEST_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="cal-field">
          <span className="field-label">{t("editor.status")}</span>
          <select value={p.status} onChange={(e) => p.onStatus(e.target.value as QuestStatus)}>
            {QUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUEST_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="cal-field">
          <span className="field-label">{t("editor.priority")}</span>
          <select value={p.priority} onChange={(e) => p.onPriority(Number(e.target.value) as QuestPriority)}>
            {QUEST_PRIORITIES.map((n) => (
              <option key={n} value={n}>
                {PRIORITY_LABELS[n]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="qs-general-grid two">
        <div className="cal-field">
          <span className="field-label">{t("editor.parent")}</span>
          <InfoPicker options={p.parentOptions} value={p.parentId} placeholder={t("editor.parentNone")} clearLabel={t("quest.none")} ariaLabel={t("editor.parentLabel")} onChange={p.onParent} />
        </div>
        <div className="cal-field">
          <span className="field-label">{t("quest.giver")}</span>
          <InfoPicker
            options={candidateOptions(p.candidates ?? [])}
            value={p.giver?.articleId ?? null}
            placeholder={p.candidates ? t("editor.giverNone") : t("quest.loadingArticles")}
            clearLabel={t("editor.nobody")}
            ariaLabel={t("quest.giver")}
            collapsibleGroups
            disabled={!p.candidates}
            onChange={(id) => {
              const c = id ? p.candidates?.find((x) => x.id === id) : null;
              p.onGiver(c ? { template: c.template, articleId: c.id } : null);
            }}
          />
        </div>
      </div>
      <label className="cal-field">
        <span className="field-label">{t("editor.summary")}</span>
        <textarea rows={4} maxLength={2000} value={p.summary} placeholder={t("editor.summaryPlaceholder")} onChange={(e) => p.onSummary(e.target.value)} />
      </label>
    </div>
  );
}

function ObjectivesTab({ objectives, onChange }: { objectives: Objective[]; onChange: (o: Objective[]) => void }) {
  const t = useT("campaign");
  const set = (id: string, patch: Partial<Objective>) => onChange(objectives.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  return (
    <div className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>{t("view.objectives")}</h3>
          <p className="cal-help">{t("editor.objectivesHelp")}</p>
        </div>
      </header>
      {objectives.map((o, i) => (
        <div key={o.id} className="ss-line qs-objective-row">
          <select aria-label={t("editor.objectiveStateN", { n: i + 1 })} value={o.state} onChange={(e) => set(o.id, { state: e.target.value as ObjectiveState })}>
            {OBJECTIVE_STATES.map((s) => (
              <option key={s} value={s}>
                {OBJECTIVE_STATE_LABELS[s]}
              </option>
            ))}
          </select>
          <input type="text" aria-label={t("editor.objectiveN", { n: i + 1 })} value={o.text} maxLength={500} placeholder={t("editor.objectivePlaceholder")} className={o.state === "done" ? "ss-resolved" : undefined} onChange={(e) => set(o.id, { text: e.target.value })} />
          <label className="cal-check">
            <input type="checkbox" checked={o.optional} onChange={(e) => set(o.id, { optional: e.target.checked })} /> {t("editor.optional")}
          </label>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("editor.removeObjectiveN", { n: i + 1 })} data-tooltip={t("quest.remove")} onClick={() => onChange(objectives.filter((x) => x.id !== o.id))}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-sm" disabled={objectives.length >= 50} onClick={() => onChange([...objectives, { id: newId("ob"), text: "", state: "open", optional: false }])}>
          <Plus size={14} /> {t("editor.addObjective")}
        </button>
      </div>
    </div>
  );
}
