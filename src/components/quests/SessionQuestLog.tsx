"use client";

import { useState } from "react";
import { Check, Gem, Minus, Plus, Trash2 } from "lucide-react";
import InfoPicker from "@/components/articles/InfoPicker";
import { api } from "@/components/calendars/api";
import { hasRewards, isClosed, LOG_ACTION_LABELS, LOG_ACTIONS, QUEST_STATUS_LABELS, QUEST_STATUSES, type LogAction, type QuestData, type QuestLogLine, type Rewards } from "@/server/quests/types";
import ProgressClock from "./ProgressClock";
import { StatusChip } from "./parts";
import { useT } from "@/i18n/useT";

/**
 * A session's Quests tab: which quests were started, advanced, completed or
 * failed this session, with a note, the objectives reached, the clues
 * revealed and how far its clock moved. Saving the session applies it to
 * the quests and it becomes part of each quest's history. A completed quest
 * with rewards offers to add them to the session. New quests can be
 * created right here.
 */
export default function SessionQuestLog({
  campaignId,
  quests,
  log,
  onChange,
  onQuestCreated,
  onAddRewards,
}: {
  campaignId: string;
  quests: QuestData[];
  log: QuestLogLine[];
  onChange: (log: QuestLogLine[]) => void;
  onQuestCreated: (q: QuestData) => void;
  /** Adds a quest's rewards to the session's XP, coins and loot. */
  onAddRewards: (rewards: Rewards) => void;
}) {
  const t = useT("campaign");
  const tc = useT("common");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logged = new Set(log.map((l) => l.questId));
  const set = (questId: string, patch: Partial<QuestLogLine>) => onChange(log.map((l) => (l.questId === questId ? { ...l, ...patch } : l)));
  const add = (questId: string, action: LogAction) => onChange([...log, { questId, action, note: "", objectiveIds: [], clueIds: [], clockTicks: 0, rewardsAdded: false }]);

  // Open quests first, then the closed ones, grouped by status.
  const options = [...QUEST_STATUSES]
    .sort((a, b) => Number(isClosed(a)) - Number(isClosed(b)))
    .flatMap((s) =>
      quests
        .filter((q) => q.status === s && !logged.has(q.id))
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((q) => ({ value: q.id, label: q.title, group: QUEST_STATUS_LABELS[s] }))
    );

  async function create() {
    if (!newTitle.trim()) return;
    setCreating(true);
    setError(null);
    const res = await api<{ quest: QuestData }>("POST", `/api/campaigns/${campaignId}/quests`, { title: newTitle, status: "hook" });
    setCreating(false);
    if (!res.ok) {
      setError(res.data.error ?? t("questLog.couldNotCreate"));
      return;
    }
    onQuestCreated(res.data.quest);
    onChange([...log, { questId: res.data.quest.id, action: "started", note: "", objectiveIds: [], clueIds: [], clockTicks: 0, rewardsAdded: false }]);
    setNewTitle("");
  }

  return (
    <div className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>{t("questLog.title")}</h3>
          <p className="cal-help">{t("questLog.help")}</p>
        </div>
      </header>
      {log.length === 0 ? (
        <p className="cel-empty">{t("questLog.empty")}</p>
      ) : (
        <ul className="qs-log">
          {log.map((line) => {
            const quest = quests.find((q) => q.id === line.questId);
            return (
              <LogRow
                key={line.questId}
                line={line}
                quest={quest ?? null}
                onChange={(patch) => set(line.questId, patch)}
                onRemove={() => onChange(log.filter((l) => l.questId !== line.questId))}
                onAddRewards={() => {
                  if (!quest?.rewards) return;
                  onAddRewards(quest.rewards);
                  set(line.questId, { rewardsAdded: true });
                }}
              />
            );
          })}
        </ul>
      )}
      <div className="qs-log-add">
        <InfoPicker options={options} value={null} placeholder={options.length ? t("questLog.pick") : t("questLog.allLogged")} ariaLabel={t("questLog.pickLabel")} disabled={options.length === 0} onChange={(id) => id && add(id, "advanced")} />
        <span className="qs-log-new">
          <input type="text" aria-label={t("questLog.newTitle")} placeholder={t("questLog.newPlaceholder")} maxLength={160} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void create())} />
          <button type="button" className="btn btn-sm" disabled={!newTitle.trim() || creating} onClick={create}>
            <Plus size={14} /> {creating ? tc("creating") : t("questLog.newQuest")}
          </button>
        </span>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function LogRow({ line, quest, onChange, onRemove, onAddRewards }: { line: QuestLogLine; quest: QuestData | null; onChange: (patch: Partial<QuestLogLine>) => void; onRemove: () => void; onAddRewards: () => void }) {
  const t = useT("campaign");
  const toggle = (id: string, on: boolean) => onChange({ objectiveIds: on ? [...line.objectiveIds, id] : line.objectiveIds.filter((x) => x !== id) });
  const toggleClue = (id: string, on: boolean) => onChange({ clueIds: on ? [...line.clueIds, id] : line.clueIds.filter((x) => x !== id) });
  // Objectives still open, plus the ones this session already ticked; same for clues.
  const objectives = quest?.objectives.filter((o) => o.state === "open" || line.objectiveIds.includes(o.id)) ?? [];
  const clues = quest?.clues.filter((c) => !c.revealed || line.clueIds.includes(c.id)) ?? [];
  const clock = quest?.clock ?? null;
  const offerRewards = line.action === "completed" && !!quest && hasRewards(quest.rewards);
  return (
    <li className="qs-log-row">
      <div className="qs-log-head">
        {quest ? <StatusChip status={quest.status} /> : null}
        <strong className="qs-log-title">{quest?.title ?? t("questLog.deleted")}</strong>
        <select aria-label={t("questLog.whatHappened")} value={line.action} onChange={(e) => onChange({ action: e.target.value as LogAction })}>
          {LOG_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {LOG_ACTION_LABELS[a]}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("questLog.removeFromSession")} data-tooltip={t("questLog.removeHint")} onClick={onRemove}>
          <Trash2 size={14} />
        </button>
      </div>
      <input type="text" aria-label={t("questLog.note")} placeholder={t("questLog.notePlaceholder")} maxLength={500} value={line.note} onChange={(e) => onChange({ note: e.target.value })} />
      {objectives.length > 0 && (
        <div className="qs-log-objectives">
          <span className="field-label">{t("questLog.objectivesReached")}</span>
          {objectives.map((o) => (
            <label key={o.id} className="cal-check">
              <input type="checkbox" checked={line.objectiveIds.includes(o.id)} onChange={(e) => toggle(o.id, e.target.checked)} /> {o.text}
            </label>
          ))}
        </div>
      )}
      {clues.length > 0 && (
        <div className="qs-log-objectives">
          <span className="field-label">{t("questLog.cluesRevealed")}</span>
          {clues.map((c) => (
            <label key={c.id} className="cal-check">
              <input type="checkbox" checked={line.clueIds.includes(c.id)} onChange={(e) => toggleClue(c.id, e.target.checked)} /> {c.text}
            </label>
          ))}
        </div>
      )}
      {clock && (
        <div className="qs-log-clock">
          <ProgressClock clock={clock} size={32} />
          <span className="field-label">{clock.label || t("quest.clock")}</span>
          <span className="qs-stepper">
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("questLog.tickLess")} data-tooltip={t("questLog.tickLess")} disabled={line.clockTicks <= -12} onClick={() => onChange({ clockTicks: line.clockTicks - 1 })}>
              <Minus size={14} />
            </button>
            <span aria-live="polite">{line.clockTicks > 0 ? `+${line.clockTicks}` : line.clockTicks}</span>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("questLog.tickMore")} data-tooltip={t("questLog.tickMore")} disabled={line.clockTicks >= 12} onClick={() => onChange({ clockTicks: line.clockTicks + 1 })}>
              <Plus size={14} />
            </button>
          </span>
          <span className="cal-help">{t("questLog.ticksThisSession", { filled: clock.filled, segments: clock.segments })}</span>
        </div>
      )}
      {offerRewards &&
        (line.rewardsAdded ? (
          <p className="qs-log-rewards done">
            <Check size={14} aria-hidden /> {t("questLog.rewardsAdded")}
          </p>
        ) : (
          <div className="qs-log-rewards">
            <Gem size={14} aria-hidden />
            <span>{t("questLog.hasRewards")}</span>
            <button type="button" className="btn btn-sm btn-primary" onClick={onAddRewards}>
              {t("questLog.addRewards")}
            </button>
          </div>
        ))}
    </li>
  );
}
