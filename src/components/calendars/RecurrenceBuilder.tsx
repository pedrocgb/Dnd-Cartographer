"use client";

import { Plus, Trash2 } from "lucide-react";
import { fromWorldDay, type CalendarDefinition } from "@/server/calendars/engine";
import { occurrenceStarts, type Condition, type EvalContext, type Recurrence } from "@/server/calendars/recurrence";
import { dayLabel, periodsOf, safe } from "./evaluate";
import type { WorldCalendars } from "./types";

const KINDS: { value: Recurrence["kind"]; label: string }[] = [
  { value: "none", label: "Doesn't repeat" },
  { value: "everyDays", label: "Every N days" },
  { value: "weekly", label: "Every N weeks" },
  { value: "weekday", label: "Every named weekday" },
  { value: "monthly", label: "Every N months, on a day" },
  { value: "annual", label: "Every N years, on a date" },
  { value: "condition", label: "When conditions match" },
];

const PREVIEW_DAYS = 400;

function defaultFor(kind: Recurrence["kind"], calendarId: string, def: CalendarDefinition, start: number): Recurrence {
  const date = safe(() => fromWorldDay(def, start), null);
  switch (kind) {
    case "everyDays":
      return { kind, interval: 10 };
    case "weekly":
      return { kind, calendarId, interval: 1 };
    case "weekday":
      return { kind, calendarId, weekdayId: def.weekdays[0]?.id ?? "" };
    case "monthly":
      return { kind, calendarId, interval: 1, day: date?.day ?? 1, missing: "skip" };
    case "annual":
      return { kind, calendarId, interval: 1, periodId: date?.periodId ?? def.periods[0]?.id ?? "", day: date?.day ?? 1, missing: "skip" };
    case "condition":
      return { kind, trigger: "enter", group: { match: "all", conditions: [{ type: "dayOfPeriod", calendarId, day: 1 }] } };
    default:
      return { kind: "none" };
  }
}

const int = (v: string, min = 1) => Math.max(min, Math.floor(Number(v)) || min);

function ConditionRow({ condition, world, onChange, onRemove }: { condition: Condition; world: WorldCalendars; onChange: (c: Condition) => void; onRemove: () => void }) {
  const calendars = world.calendars.filter((c) => !c.archived);
  const calendarOf = (id: string) => calendars.find((c) => c.id === id)?.definition;
  const firstCal = calendars[0]?.id ?? "";
  const retype = (type: Condition["type"], calendar?: string): Condition => {
    const cal = calendar ?? ("calendarId" in condition ? condition.calendarId : firstCal);
    const def = calendarOf(cal);
    if (type === "weekday") return { type, calendarId: cal, weekdayId: def?.weekdays[0]?.id ?? "" };
    if (type === "period") return { type, calendarId: cal, periodId: def?.periods[0]?.id ?? "" };
    if (type === "dayOfPeriod") return { type, calendarId: cal, day: 1 };
    if (type === "season") {
      const p = world.profiles.find((x) => !x.archived);
      return { type, profileId: p?.id ?? "", seasonId: p?.data.memberships[0]?.seasonId ?? "" };
    }
    const o = world.celestial.find((x) => !x.archived);
    return { type, objectId: o?.id ?? "", stateId: (o?.type === "moon" ? o.config.phases?.[0]?.id : o?.config.states?.[0]?.id) ?? "" };
  };
  return (
    <li className="cal-inline cal-condition">
      <select aria-label="Condition type" value={condition.type} onChange={(e) => onChange(retype(e.target.value as Condition["type"]))}>
        <option value="dayOfPeriod">Day of the month is</option>
        <option value="period">Month is</option>
        <option value="weekday">Weekday is</option>
        <option value="season" disabled={world.profiles.length === 0}>
          Season is
        </option>
        <option value="celestial" disabled={world.celestial.length === 0}>
          Celestial state is
        </option>
      </select>
      {"calendarId" in condition && (
        <select aria-label="In calendar" value={condition.calendarId} onChange={(e) => onChange(retype(condition.type, e.target.value))}>
          {calendars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {condition.type === "dayOfPeriod" && <input type="number" min={1} aria-label="Day" value={condition.day} onChange={(e) => onChange({ ...condition, day: int(e.target.value) })} />}
      {condition.type === "period" && (
        <select aria-label="Month" value={condition.periodId} onChange={(e) => onChange({ ...condition, periodId: e.target.value })}>
          {calendarOf(condition.calendarId)?.periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      {condition.type === "weekday" && (
        <select aria-label="Weekday" value={condition.weekdayId} onChange={(e) => onChange({ ...condition, weekdayId: e.target.value })}>
          {calendarOf(condition.calendarId)?.weekdays.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      )}
      {condition.type === "season" && (
        <>
          <select aria-label="Season profile" value={condition.profileId} onChange={(e) => onChange({ ...condition, profileId: e.target.value, seasonId: world.profiles.find((p) => p.id === e.target.value)?.data.memberships[0]?.seasonId ?? "" })}>
            {world.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select aria-label="Season" value={condition.seasonId} onChange={(e) => onChange({ ...condition, seasonId: e.target.value })}>
            {[...new Set(world.profiles.find((p) => p.id === condition.profileId)?.data.memberships.map((m) => m.seasonId) ?? [])].map((id) => (
              <option key={id} value={id}>
                {world.seasons.find((s) => s.id === id)?.name ?? "(removed)"}
              </option>
            ))}
          </select>
        </>
      )}
      {condition.type === "celestial" && (
        <>
          <select aria-label="Celestial object" value={condition.objectId} onChange={(e) => onChange({ ...condition, objectId: e.target.value, stateId: "" })}>
            {world.celestial.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select aria-label="State" value={condition.stateId} onChange={(e) => onChange({ ...condition, stateId: e.target.value })}>
            <option value="">Pick…</option>
            {(() => {
              const o = world.celestial.find((x) => x.id === condition.objectId);
              const states = o?.type === "moon" ? (o.config.phases ?? []) : (o?.config.states ?? []);
              return states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ));
            })()}
          </select>
        </>
      )}
      <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Remove condition" onClick={onRemove}>
        <Trash2 size={14} />
      </button>
    </li>
  );
}

/**
 * Readable repeat controls. Weekly repeats count physical days (N × the
 * calendar's week length); a named weekday follows the weekday flow and
 * skips days outside the week. The preview evaluates a bounded window only.
 */
export default function RecurrenceBuilder({
  value,
  onChange,
  def,
  calendarId,
  start,
  until,
  onUntil,
  world,
  ctx,
}: {
  value: Recurrence;
  onChange: (r: Recurrence) => void;
  def: CalendarDefinition;
  calendarId: string;
  start: number;
  until: number | null;
  onUntil: (day: number | null) => void;
  world: WorldCalendars;
  ctx: EvalContext;
}) {
  const ruleDef = ("calendarId" in value ? world.calendars.find((c) => c.id === value.calendarId)?.definition : null) ?? def;
  const preview = value.kind === "none" ? [] : safe(() => occurrenceStarts(value, start, until, start, start + PREVIEW_DAYS - 1, ctx), []);

  return (
    <div className="cal-recurrence">
      <label className="cal-field">
        <span className="field-label">Repeats</span>
        <select value={value.kind} onChange={(e) => onChange(defaultFor(e.target.value as Recurrence["kind"], calendarId, def, start))}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value} disabled={k.value === "weekday" && def.weekdays.length === 0}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      {value.kind === "everyDays" && (
        <label className="cal-inline">
          <span>Every</span>
          <input type="number" min={1} value={value.interval} aria-label="Days between occurrences" onChange={(e) => onChange({ ...value, interval: int(e.target.value) })} />
          <span>physical days</span>
        </label>
      )}
      {value.kind === "weekly" && (
        <label className="cal-inline">
          <span>Every</span>
          <input type="number" min={1} value={value.interval} aria-label="Weeks between occurrences" onChange={(e) => onChange({ ...value, interval: int(e.target.value) })} />
          <span>
            week(s) = every {value.interval * Math.max(1, ruleDef.weekdays.length)} physical days (festival days included)
          </span>
        </label>
      )}
      {value.kind === "weekday" && (
        <label className="cal-inline">
          <span>Every</span>
          <select value={value.weekdayId} aria-label="Weekday" onChange={(e) => onChange({ ...value, weekdayId: e.target.value })}>
            {ruleDef.weekdays.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <span className="cal-help">(days outside the week never match)</span>
        </label>
      )}
      {(value.kind === "monthly" || value.kind === "annual") && (
        <>
          <label className="cal-inline">
            <span>Every</span>
            <input type="number" min={1} value={value.interval} aria-label="Interval" onChange={(e) => onChange({ ...value, interval: int(e.target.value) })} />
            <span>{value.kind === "monthly" ? "month(s), on day" : "year(s), on"}</span>
            <input type="number" min={1} value={value.day} aria-label="Day" onChange={(e) => onChange({ ...value, day: int(e.target.value) })} />
            {value.kind === "annual" && (
              <select value={value.periodId} aria-label="Month" onChange={(e) => onChange({ ...value, periodId: e.target.value })}>
                {ruleDef.periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label className="cal-inline">
            <span>If that day doesn&apos;t exist</span>
            <select value={value.missing} aria-label="When the day is missing" onChange={(e) => onChange({ ...value, missing: e.target.value as "skip" | "last" })}>
              <option value="skip">skip that {value.kind === "monthly" ? "month" : "year"}</option>
              <option value="last">use the month&apos;s last day</option>
            </select>
          </label>
          {value.kind === "annual" && periodsOf(ruleDef, 1).length > 0 && ruleDef.periods.find((p) => p.id === value.periodId)?.condition && <p className="cal-help">This month doesn&apos;t occur every year; years without it are skipped.</p>}
        </>
      )}
      {value.kind === "condition" && (
        <div className="cal-conditions">
          <label className="cal-inline">
            <select value={value.trigger} aria-label="When to fire" onChange={(e) => onChange({ ...value, trigger: e.target.value as "enter" | "every" })}>
              <option value="enter">On entering (the first matching day)</option>
              <option value="every">On every matching day</option>
            </select>
            <span>when</span>
            <select value={value.group.match} aria-label="Match all or any" onChange={(e) => onChange({ ...value, group: { ...value.group, match: e.target.value as "all" | "any" } })}>
              <option value="all">all</option>
              <option value="any">any</option>
            </select>
            <span>of these hold:</span>
          </label>
          <ul>
            {value.group.conditions.map((c, i) => (
              <ConditionRow
                key={i}
                condition={c}
                world={world}
                onChange={(next) => onChange({ ...value, group: { ...value.group, conditions: value.group.conditions.map((x, j) => (j === i ? next : x)) } })}
                onRemove={() => onChange({ ...value, group: { ...value.group, conditions: value.group.conditions.filter((_, j) => j !== i) } })}
              />
            ))}
          </ul>
          {value.group.conditions.length < 8 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ ...value, group: { ...value.group, conditions: [...value.group.conditions, { type: "dayOfPeriod", calendarId, day: 1 }] } })}>
              <Plus size={14} /> Add condition
            </button>
          )}
        </div>
      )}
      {value.kind !== "none" && (
        <>
          <label className="cal-check">
            <input type="checkbox" checked={until !== null} onChange={(e) => onUntil(e.target.checked ? start + PREVIEW_DAYS : null)} />
            Stop repeating after a date
          </label>
          {until !== null && (
            <label className="cal-inline">
              <span>Last possible start: {dayLabel(def, until)}</span>
              <input type="number" aria-label="Days after the first occurrence" min={0} value={until - start} onChange={(e) => onUntil(start + Math.max(0, Math.floor(Number(e.target.value)) || 0))} />
              <span>days after the first</span>
            </label>
          )}
          <div className="cal-preview-occurrences" aria-live="polite">
            <span className="field-label">Preview</span>
            {preview.length === 0 ? (
              <p className="cal-help">
                No occurrences between {dayLabel(def, start, { weekday: false })} and {dayLabel(def, start + PREVIEW_DAYS - 1, { weekday: false })} ({PREVIEW_DAYS} days).
              </p>
            ) : (
              <p className="cal-help">
                {preview.slice(0, 6).map((d) => dayLabel(def, d)).join(" · ")}
                {preview.length > 6 ? ` · and ${preview.length - 6} more in the next ${PREVIEW_DAYS} days` : ""}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
