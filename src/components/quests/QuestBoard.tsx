"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Flame, GitBranch, Plus, Timer, UserRound } from "lucide-react";
import type { Candidate } from "@/components/articles/candidates";
import { boardColumns } from "@/server/quests/logic";
import { PRIORITY_LABELS, QUEST_KIND_LABELS, QUEST_KINDS, QUEST_STATUS_LABELS, type FrontData, type QuestData, type QuestKind, type QuestStatus } from "@/server/quests/types";
import { DeadlineChip, KindChip, nameOf, Progress } from "./parts";
import type { CalendarDefinition } from "@/server/calendars/engine";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";

/** The board's columns; failed and abandoned quests share the last one. `label` is worded on read. */
const COLUMNS: { key: string; readonly label: string; statuses: QuestStatus[]; drop: QuestStatus; collapsible?: boolean }[] = [
  { key: "hook", get label() { return QUEST_STATUS_LABELS.hook; }, statuses: ["hook"], drop: "hook" },
  { key: "active", get label() { return QUEST_STATUS_LABELS.active; }, statuses: ["active"], drop: "active" },
  { key: "onHold", get label() { return QUEST_STATUS_LABELS.onHold; }, statuses: ["onHold"], drop: "onHold" },
  { key: "completed", get label() { return QUEST_STATUS_LABELS.completed; }, statuses: ["completed"], drop: "completed", collapsible: true },
  { key: "failed", get label() { return activeT("campaign")("board.failedAbandoned"); }, statuses: ["failed", "abandoned"], drop: "failed", collapsible: true },
];

/** A card moved: its (new) status, and the target column's quest ids in their new order. */
export type BoardMove = { id: string; status: QuestStatus; order: string[] };

/**
 * The campaign's quests as a status board. Drag a card to another column
 * (its status) or up/down (its order); with the keyboard, focus a card and
 * use Alt+←/→ to change column, Alt+↑/↓ to reorder. Sub-quests show under
 * their own status, marked with their parent.
 */
export default function QuestBoard({
  quests,
  fronts,
  candidates,
  def,
  today,
  onOpen,
  onMove,
  onNew,
}: {
  quests: QuestData[];
  fronts: FrontData[];
  candidates: Candidate[] | null;
  /** For deadline chips: the campaign's calendar and the world's current day. */
  def: CalendarDefinition | null;
  today: number;
  onOpen: (id: string) => void;
  onMove: (move: BoardMove) => void;
  onNew: (status: QuestStatus) => void;
}) {
  const t = useT("campaign");
  const [kind, setKind] = useState<QuestKind | "">("");
  const [frontFilter, setFrontFilter] = useState("");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(["completed", "failed"]));
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<{ column: string; index: number } | null>(null);

  const needle = query.trim().toLowerCase();
  const shown = useMemo(
    () => quests.filter((q) => (!kind || q.kind === kind) && (!frontFilter || (frontFilter === "none" ? !q.frontId : q.frontId === frontFilter)) && (!needle || q.title.toLowerCase().includes(needle) || q.summary.toLowerCase().includes(needle))),
    [quests, kind, frontFilter, needle]
  );
  const byStatus = useMemo(() => boardColumns(shown), [shown]);
  const cardsOf = (statuses: QuestStatus[]) => statuses.flatMap((s) => byStatus[s]);
  const titleOf = (id: string | null) => quests.find((q) => q.id === id)?.title ?? null;

  /** Moves a card before slot `index` of a column (slots counted with the card still in place). */
  function move(id: string, columnKey: string, index: number) {
    const column = COLUMNS.find((c) => c.key === columnKey)!;
    const quest = quests.find((q) => q.id === id);
    if (!quest) return;
    // Dropping a failed/abandoned quest back into its own column keeps its exact status.
    const status = column.statuses.includes(quest.status) ? quest.status : column.drop;
    // Order the whole column (filters off), so hidden cards keep their places.
    const all = boardColumns(quests);
    const ids = column.statuses.flatMap((s) => all[s]).map((q) => q.id);
    const visible = cardsOf(column.statuses).map((q) => q.id);
    const from = ids.indexOf(id);
    const before = visible[index] ?? null; // the card it lands in front of, or the end
    const order = ids.filter((x) => x !== id);
    const at = before && before !== id ? order.indexOf(before) : before === id ? from : order.length;
    order.splice(at < 0 ? order.length : at, 0, id);
    if (from === -1 || order.some((x, i) => ids[i] !== x) || status !== quest.status) onMove({ id, status, order });
  }

  function keyMove(e: React.KeyboardEvent, q: QuestData, columnIndex: number, index: number) {
    if (!e.altKey) return;
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!delta) return;
    e.preventDefault();
    const target = COLUMNS[columnIndex + delta[0]];
    if (!target) return;
    // Down lands in front of the card after the next one (slots count the card itself).
    move(q.id, target.key, delta[0] ? cardsOf(target.statuses).length : Math.max(0, index + (delta[1] > 0 ? 2 : -1)));
    // The card re-mounts in its new place: keep the keyboard on it.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-quest-card="${CSS.escape(q.id)}"]`)?.focus());
  }

  return (
    <div className="qs-board-wrap">
      <div className="qs-filters">
        <input type="search" placeholder={t("board.search")} aria-label={t("board.searchLabel")} value={query} onChange={(e) => setQuery(e.target.value)} />
        <select aria-label={t("board.typeLabel")} value={kind} onChange={(e) => setKind(e.target.value as QuestKind | "")}>
          <option value="">{t("board.allTypes")}</option>
          {QUEST_KINDS.map((k) => (
            <option key={k} value={k}>
              {QUEST_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        {fronts.length > 0 && (
          <select aria-label={t("quest.front")} value={frontFilter} onChange={(e) => setFrontFilter(e.target.value)}>
            <option value="">{t("quest.allFronts")}</option>
            {fronts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            <option value="none">{t("board.noFront")}</option>
          </select>
        )}
        <span className="cal-help qs-board-hint">{t("board.hint")}</span>
      </div>
      <div className="qs-board">
        {COLUMNS.map((column, columnIndex) => {
          const cards = cardsOf(column.statuses);
          const isCollapsed = column.collapsible && collapsed.has(column.key);
          return (
            <section
              key={column.key}
              className={["qs-column", `qs-column-${column.key}`, dropAt?.column === column.key && "drop", isCollapsed && "collapsed"].filter(Boolean).join(" ")}
              aria-label={column.label}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                if (dropAt?.column !== column.key || e.target === e.currentTarget) setDropAt({ column: column.key, index: e.target === e.currentTarget ? cards.length : (dropAt?.index ?? cards.length) });
              }}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropAt(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging && dropAt) move(dragging, column.key, dropAt.index);
                setDragging(null);
                setDropAt(null);
              }}
            >
              <header className="qs-column-head">
                {column.collapsible ? (
                  <button type="button" className="qs-column-toggle" aria-expanded={!isCollapsed} onClick={() => setCollapsed((s) => (s.has(column.key) ? new Set([...s].filter((k) => k !== column.key)) : new Set([...s, column.key])))}>
                    {isCollapsed ? <ChevronRight size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
                    {column.label}
                  </button>
                ) : (
                  <h3>{column.label}</h3>
                )}
                <span className="cel-tab-count">{cards.length}</span>
                {!column.collapsible && (
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("board.newIn", { column: column.label })} data-tooltip={t("board.newIn", { column: column.label })} onClick={() => onNew(column.drop)}>
                    <Plus size={14} />
                  </button>
                )}
              </header>
              {!isCollapsed && (
                <ol className="qs-cards">
                  {cards.map((q, index) => (
                    <li
                      key={q.id}
                      className={dropAt?.column === column.key && dropAt.index === index && dragging !== q.id ? "qs-card-slot drop-before" : "qs-card-slot"}
                      onDragOver={(e) => {
                        if (!dragging) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const at = e.clientY < rect.top + rect.height / 2 ? index : index + 1;
                        if (dropAt?.column !== column.key || dropAt.index !== at) setDropAt({ column: column.key, index: at });
                      }}
                    >
                      <QuestCard
                        quest={q}
                        giver={nameOf(q.giver, candidates)}
                        parent={titleOf(q.parentId)}
                        front={fronts.find((f) => f.id === q.frontId) ?? null}
                        deadline={<DeadlineChip quest={q} def={def} today={today} />}
                        subCount={quests.filter((x) => x.parentId === q.id).length}
                        dragging={dragging === q.id}
                        onOpen={() => onOpen(q.id)}
                        onDragStart={() => setDragging(q.id)}
                        onDragEnd={() => (setDragging(null), setDropAt(null))}
                        onKeyDown={(e) => keyMove(e, q, columnIndex, index)}
                      />
                    </li>
                  ))}
                  {cards.length === 0 && <li className="qs-column-empty cal-help">{dragging ? t("board.dropHere") : t("board.nothingHere")}</li>}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function QuestCard({
  quest,
  giver,
  parent,
  front,
  deadline,
  subCount,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
  onKeyDown,
}: {
  quest: QuestData;
  giver: string | null;
  parent: string | null;
  front: FrontData | null;
  deadline: React.ReactNode;
  subCount: number;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const t = useT("campaign");
  return (
    <button
      type="button"
      className={["qs-card", `qs-priority-${quest.priority}`, front?.color && "qs-card-front", dragging && "dragging"].filter(Boolean).join(" ")}
      style={front?.color ? { ["--qs-front" as string]: front.color } : undefined}
      data-quest-card={quest.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", quest.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={onKeyDown}
    >
      <span className="qs-card-top">
        <KindChip kind={quest.kind} />
        {quest.priority === 2 && <span className="qs-priority-flag">{PRIORITY_LABELS[2]}</span>}
      </span>
      <strong className="qs-card-title">{quest.title}</strong>
      {parent && (
        <span className="qs-card-parent">
          <GitBranch size={11} aria-hidden /> {parent}
        </span>
      )}
      {quest.summary && <span className="qs-card-summary">{quest.summary}</span>}
      {front && (
        <span className="qs-card-meta qs-card-front-name" data-tooltip={t("quest.front")}>
          <Flame size={11} aria-hidden /> {front.name}
        </span>
      )}
      <span className="qs-card-foot">
        <Progress objectives={quest.objectives} />
        {deadline}
        {quest.clock && (
          <span className="qs-card-meta" data-tooltip={quest.clock.label || t("quest.clock")}>
            <Timer size={11} aria-hidden /> {quest.clock.filled}/{quest.clock.segments}
          </span>
        )}
        {giver && (
          <span className="qs-card-meta" data-tooltip={t("quest.giver")}>
            <UserRound size={11} aria-hidden /> {giver}
          </span>
        )}
        {subCount > 0 && (
          <span className="qs-card-meta" data-tooltip={t("board.subQuests")}>
            <GitBranch size={11} aria-hidden /> {subCount}
          </span>
        )}
      </span>
    </button>
  );
}
