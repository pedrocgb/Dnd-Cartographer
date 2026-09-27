"use client";

import type { CalendarDefinition } from "@/server/calendars/engine";
import type { EvalContext } from "@/server/calendars/recurrence";
import { celestialStates, dayLabel, monthBlock, occurrenceTitle, periodsOf, type DayOccurrence, type MonthCell } from "./evaluate";
import type { ClientCelestial, ClientSeason } from "./types";
import type { BriefSession } from "@/components/sessions/types";
import { isClosed, QUEST_DAY_LABELS, type BriefQuest, type QuestDayKind } from "@/server/quests/types";

export interface ViewProps {
  def: CalendarDefinition;
  year: number;
  currentDay: number;
  selectedDay: number | null;
  onSelect: (worldDay: number) => void;
  occurrences: Map<number, DayOccurrence[]>;
  objects: ClientCelestial[];
  ctx: EvalContext;
  /** Season colors of the preview profile, by day. */
  seasonOf: (worldDay: number) => ClientSeason[];
  /** Game sessions whose in-world span covers the day. */
  sessionsOn?: (worldDay: number) => BriefSession[];
  /** Quests starting, due or ending that day. */
  questsOn?: (worldDay: number) => { quest: BriefQuest; kind: QuestDayKind }[];
}

const MAX_CHIPS = 2;
const MAX_MOONS = 3;

/** Prioritized objects first (alphabetically among themselves); the rest keep their order. */
function byIconPriority<T extends { object: ClientCelestial }>(states: T[]): T[] {
  const first = states.filter((s) => s.object.prioritizeDayIcon).sort((a, b) => a.object.name.localeCompare(b.object.name));
  return [...first, ...states.filter((s) => !s.object.prioritizeDayIcon)];
}

function DayCell({ cell, props, dense }: { cell: MonthCell; props: ViewProps; dense: boolean }) {
  const items = props.occurrences.get(cell.worldDay) ?? [];
  const current = cell.worldDay === props.currentDay;
  const selected = cell.worldDay === props.selectedDay;
  // The year overview stays clean: only the season color is drawn there (sky states show in month view and day details).
  const states = dense ? [] : byIconPriority(celestialStates(props.objects.filter((o) => o.showDayIcon), cell.worldDay, props.ctx).flatMap(({ object, states }) => states.map((s) => ({ object, state: s }))));
  const seasons = props.seasonOf(cell.worldDay);
  const daySessions = dense ? [] : (props.sessionsOn?.(cell.worldDay) ?? []);
  const dayQuests = dense ? [] : (props.questsOn?.(cell.worldDay) ?? []);
  // Deadlines of open quests get a chip; every quest date is in the day panel.
  const deadlines = dayQuests.filter((q) => q.kind === "deadline" && !isClosed(q.quest.status));
  // Sessions come first, then deadlines; they share the chip budget with entries.
  const questChips = Math.max(0, MAX_CHIPS - daySessions.length);
  const entryChips = Math.max(0, MAX_CHIPS - daySessions.length - Math.min(questChips, deadlines.length));
  const label = [
    dayLabel(props.def, cell.worldDay),
    current && "current date",
    selected && "selected",
    items.length && `${items.length} entr${items.length === 1 ? "y" : "ies"}`,
    ...daySessions.map((s) => `Session ${s.number}${s.title ? `: ${s.title}` : ""}`),
    ...dayQuests.map((q) => `${QUEST_DAY_LABELS[q.kind]}: ${q.quest.title}`),
    ...states.map(({ object, state }) => `${object.name}: ${state.name}`),
    ...seasons.map((s) => s.name),
  ]
    .filter(Boolean)
    .join(", ");
  const className = ["cal-day", current && "current", selected && "selected", dense && "dense"].filter(Boolean).join(" ");
  return (
    <button type="button" className={className} aria-label={label} aria-pressed={selected} onClick={() => props.onSelect(cell.worldDay)}>
      {seasons.length > 0 && (
        <span className="cal-day-season" aria-hidden>
          {seasons.map((s) => (
            <span key={s.id} style={{ background: s.color }} />
          ))}
        </span>
      )}
      <span className="cal-day-head">
        <span className="cal-day-number">{cell.day}</span>
        {current && !dense && <span className="cal-day-today">Today</span>}
        {!dense && (
          <span className="cal-day-moons" aria-hidden>
            {states.slice(0, MAX_MOONS).map(({ object, state }) => (
              <span key={object.id} style={{ color: object.color }} data-tooltip={`${object.name}: ${state.name}`}>
                {state.icon || "•"}
              </span>
            ))}
            {states.length > MAX_MOONS && <span className="cal-more">+{states.length - MAX_MOONS}</span>}
          </span>
        )}
      </span>
      {!dense && (
        <span className="cal-day-chips" aria-hidden>
          {daySessions.slice(0, MAX_CHIPS).map((s) => (
            <span key={s.id} className="cal-chip session">
              📜 {s.title || `Session ${s.number}`}
            </span>
          ))}
          {deadlines.slice(0, questChips).map((q) => (
            <span key={q.quest.id} className="cal-chip quest-deadline">
              ⏳ {q.quest.title}
            </span>
          ))}
          {items.slice(0, entryChips).map((item) => (
            <span key={`${item.entry.id}:${item.occurrence.key}`} className={`cal-chip ${item.entry.kind}`} style={item.entry.color ? { borderLeftColor: item.entry.color } : undefined}>
              {occurrenceTitle(item) || (item.entry.kind === "note" ? "Note" : "Link")}
            </span>
          ))}
          {items.length > entryChips && <span className="cal-more">+{items.length - entryChips} more</span>}
        </span>
      )}
    </button>
  );
}

function Weekheads({ def }: { def: CalendarDefinition }) {
  if (!def.weekdays.length) return null;
  return (
    <div className="cal-weekheads" aria-hidden>
      {def.weekdays.map((w) => (
        <span key={w.id} data-tooltip={w.name}>
          {w.short || w.name}
        </span>
      ))}
    </div>
  );
}

function Grid({ def, periodId, props, dense }: { def: CalendarDefinition; periodId: string; props: ViewProps; dense: boolean }) {
  const block = monthBlock(def, props.year, periodId);
  if (!block) return <p className="cal-help">This month doesn&apos;t occur in year {props.year}.</p>;
  const cols = def.weekdays.length || 10;
  return (
    <div className="cal-grid-wrap">
      {!dense && <Weekheads def={def} />}
      <div className="cal-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(${dense ? 22 : 64}px, 1fr))` }}>
        {block.rows.flatMap((row, r) => row.map((cell, c) => (cell ? <DayCell key={cell.worldDay} cell={cell} props={props} dense={dense} /> : <span key={`pad-${r}-${c}`} className="cal-day-pad" />)))}
      </div>
      {block.outOfWeek.length > 0 && (
        <div className="cal-outside-week">
          {!dense && <span className="field-label">Outside the week</span>}
          <div className="cal-grid" style={{ gridTemplateColumns: `repeat(${Math.min(block.outOfWeek.length, cols)}, minmax(${dense ? 22 : 64}px, 1fr))` }}>
            {block.outOfWeek.map((cell) => (
              <DayCell key={cell.worldDay} cell={cell} props={props} dense={dense} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MonthView({ periodId, ...props }: ViewProps & { periodId: string }) {
  return <Grid def={props.def} periodId={periodId} props={{ ...props }} dense={false} />;
}

/** Every period of the year as a compact grid; clicking a name opens that month. */
export function YearView({ onOpenMonth, ...props }: ViewProps & { onOpenMonth: (periodId: string) => void }) {
  const periods = periodsOf(props.def, props.year);
  return (
    <div className="cal-year">
      {periods.map((p) => (
        <section key={p.period.id} className={p.period.kind === "special" ? "cal-year-month special" : "cal-year-month"}>
          <button type="button" className="cal-year-title" onClick={() => onOpenMonth(p.period.id)}>
            {p.period.name}
            <span className="cal-help">{p.days}d</span>
          </button>
          <Grid def={props.def} periodId={p.period.id} props={props} dense />
        </section>
      ))}
    </div>
  );
}

/** Chronological list of every occurrence in the viewed range. */
export function AgendaView({ def, items, onSelect, selectedDay, rangeLabel }: { def: CalendarDefinition; items: DayOccurrence[]; onSelect: (d: number) => void; selectedDay: number | null; rangeLabel: string }) {
  if (items.length === 0) return <p className="cal-empty">Nothing recorded in {rangeLabel}.</p>;
  return (
    <ol className="cal-agenda">
      {items.map((item) => (
        <li key={`${item.entry.id}:${item.occurrence.key}`}>
          <button type="button" className={item.occurrence.start === selectedDay ? "cal-agenda-row selected" : "cal-agenda-row"} onClick={() => onSelect(item.occurrence.start)}>
            <span className="cal-agenda-date">
              {dayLabel(def, item.occurrence.start)}
              {item.occurrence.end > item.occurrence.start && ` – ${dayLabel(def, item.occurrence.end, { weekday: false })}`}
            </span>
            <span className={`cal-chip ${item.entry.kind}`} style={item.entry.color ? { borderLeftColor: item.entry.color } : undefined}>
              {occurrenceTitle(item) || (item.entry.kind === "note" ? "Note" : "Article link")}
            </span>
            {item.entry.category && <span className="cal-agenda-category">{item.entry.category}</span>}
          </button>
        </li>
      ))}
    </ol>
  );
}
