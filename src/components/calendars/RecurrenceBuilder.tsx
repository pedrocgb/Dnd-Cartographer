"use client";

import { Plus, Trash2 } from "lucide-react";
import { fromWorldDay, type CalendarDefinition } from "@/server/calendars/engine";
import { occurrenceStarts, type Condition, type EvalContext, type Recurrence } from "@/server/calendars/recurrence";
import { dayLabel, periodsOf, safe } from "./evaluate";
import type { WorldCalendars } from "./types";
import { useT } from "@/i18n/useT";

const KINDS: Recurrence["kind"][] = ["none", "everyDays", "weekly", "weekday", "monthly", "annual", "condition"];

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
  const t = useT("calendars");
  const tc = useT("common");
  const calendars = world.calendars.filter((c) => !c.trashed);
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
      <select aria-label={t("rb.condType")} value={condition.type} onChange={(e) => onChange(retype(e.target.value as Condition["type"]))}>
        <option value="dayOfPeriod">{t("rb.cond.dayOfPeriod")}</option>
        <option value="period">{t("rb.cond.period")}</option>
        <option value="weekday">{t("rb.cond.weekday")}</option>
        <option value="season" disabled={world.profiles.length === 0}>
          {t("rb.cond.season")}
        </option>
        <option value="celestial" disabled={world.celestial.length === 0}>
          {t("rb.cond.celestial")}
        </option>
      </select>
      {"calendarId" in condition && (
        <select aria-label={t("rb.inCalendar")} value={condition.calendarId} onChange={(e) => onChange(retype(condition.type, e.target.value))}>
          {calendars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {condition.type === "dayOfPeriod" && <input type="number" min={1} aria-label={t("rb.day")} value={condition.day} onChange={(e) => onChange({ ...condition, day: int(e.target.value) })} />}
      {condition.type === "period" && (
        <select aria-label={tc("datePicker.month")} value={condition.periodId} onChange={(e) => onChange({ ...condition, periodId: e.target.value })}>
          {calendarOf(condition.calendarId)?.periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      {condition.type === "weekday" && (
        <select aria-label={t("rb.weekday")} value={condition.weekdayId} onChange={(e) => onChange({ ...condition, weekdayId: e.target.value })}>
          {calendarOf(condition.calendarId)?.weekdays.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      )}
      {condition.type === "season" && (
        <>
          <select aria-label={t("rb.profile")} value={condition.profileId} onChange={(e) => onChange({ ...condition, profileId: e.target.value, seasonId: world.profiles.find((p) => p.id === e.target.value)?.data.memberships[0]?.seasonId ?? "" })}>
            {world.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select aria-label={t("rb.season")} value={condition.seasonId} onChange={(e) => onChange({ ...condition, seasonId: e.target.value })}>
            {[...new Set(world.profiles.find((p) => p.id === condition.profileId)?.data.memberships.map((m) => m.seasonId) ?? [])].map((id) => (
              <option key={id} value={id}>
                {world.seasons.find((s) => s.id === id)?.name ?? t("sidebar.removed")}
              </option>
            ))}
          </select>
        </>
      )}
      {condition.type === "celestial" && (
        <>
          <select aria-label={t("rb.object")} value={condition.objectId} onChange={(e) => onChange({ ...condition, objectId: e.target.value, stateId: "" })}>
            {world.celestial.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select aria-label={t("rb.state")} value={condition.stateId} onChange={(e) => onChange({ ...condition, stateId: e.target.value })}>
            <option value="">{t("rb.pick")}</option>
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
      <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("rb.removeCondition")} onClick={onRemove}>
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
  const t = useT("calendars");
  const tc = useT("common");
  const ruleDef = ("calendarId" in value ? world.calendars.find((c) => c.id === value.calendarId)?.definition : null) ?? def;
  const preview = value.kind === "none" ? [] : safe(() => occurrenceStarts(value, start, until, start, start + PREVIEW_DAYS - 1, ctx), []);

  return (
    <div className="cal-recurrence">
      <label className="cal-field">
        <span className="field-label">{t("rb.repeats")}</span>
        <select value={value.kind} onChange={(e) => onChange(defaultFor(e.target.value as Recurrence["kind"], calendarId, def, start))}>
          {KINDS.map((k) => (
            <option key={k} value={k} disabled={k === "weekday" && def.weekdays.length === 0}>
              {t(`rb.kind.${k}`)}
            </option>
          ))}
        </select>
      </label>
      {value.kind === "everyDays" && (
        <label className="cal-inline">
          <span>{t("rb.every")}</span>
          <input type="number" min={1} value={value.interval} aria-label={t("rb.daysBetween")} onChange={(e) => onChange({ ...value, interval: int(e.target.value) })} />
          <span>{t("rb.physicalDays")}</span>
        </label>
      )}
      {value.kind === "weekly" && (
        <label className="cal-inline">
          <span>{t("rb.every")}</span>
          <input type="number" min={1} value={value.interval} aria-label={t("rb.weeksBetween")} onChange={(e) => onChange({ ...value, interval: int(e.target.value) })} />
          <span>{t("rb.weeksEquals", { n: value.interval * Math.max(1, ruleDef.weekdays.length) })}</span>
        </label>
      )}
      {value.kind === "weekday" && (
        <label className="cal-inline">
          <span>{t("rb.every")}</span>
          <select value={value.weekdayId} aria-label={t("rb.weekday")} onChange={(e) => onChange({ ...value, weekdayId: e.target.value })}>
            {ruleDef.weekdays.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <span className="cal-help">{t("rb.outsideNever")}</span>
        </label>
      )}
      {(value.kind === "monthly" || value.kind === "annual") && (
        <>
          <label className="cal-inline">
            <span>{t("rb.every")}</span>
            <input type="number" min={1} value={value.interval} aria-label={t("rb.interval")} onChange={(e) => onChange({ ...value, interval: int(e.target.value) })} />
            <span>{value.kind === "monthly" ? t("rb.monthsOnDay") : t("rb.yearsOn")}</span>
            <input type="number" min={1} value={value.day} aria-label={t("rb.day")} onChange={(e) => onChange({ ...value, day: int(e.target.value) })} />
            {value.kind === "annual" && (
              <select value={value.periodId} aria-label={tc("datePicker.month")} onChange={(e) => onChange({ ...value, periodId: e.target.value })}>
                {ruleDef.periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label className="cal-inline">
            <span>{t("rb.ifMissing")}</span>
            <select value={value.missing} aria-label={t("rb.missingAria")} onChange={(e) => onChange({ ...value, missing: e.target.value as "skip" | "last" })}>
              <option value="skip">{value.kind === "monthly" ? t("rb.skipMonth") : t("rb.skipYear")}</option>
              <option value="last">{t("rb.useLast")}</option>
            </select>
          </label>
          {value.kind === "annual" && periodsOf(ruleDef, 1).length > 0 && ruleDef.periods.find((p) => p.id === value.periodId)?.condition && <p className="cal-help">{t("rb.conditionalMonth")}</p>}
        </>
      )}
      {value.kind === "condition" && (
        <div className="cal-conditions">
          <label className="cal-inline">
            <select value={value.trigger} aria-label={t("rb.fireAria")} onChange={(e) => onChange({ ...value, trigger: e.target.value as "enter" | "every" })}>
              <option value="enter">{t("rb.onEnter")}</option>
              <option value="every">{t("rb.onEvery")}</option>
            </select>
            <span>{t("rb.when")}</span>
            <select value={value.group.match} aria-label={t("rb.matchAria")} onChange={(e) => onChange({ ...value, group: { ...value.group, match: e.target.value as "all" | "any" } })}>
              <option value="all">{t("rb.all")}</option>
              <option value="any">{t("rb.any")}</option>
            </select>
            <span>{t("rb.ofThese")}</span>
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
              <Plus size={14} /> {t("rb.addCondition")}
            </button>
          )}
        </div>
      )}
      {value.kind !== "none" && (
        <>
          <label className="cal-check">
            <input type="checkbox" checked={until !== null} onChange={(e) => onUntil(e.target.checked ? start + PREVIEW_DAYS : null)} />
            {t("rb.stopAfter")}
          </label>
          {until !== null && (
            <label className="cal-inline">
              <span>{t("rb.lastStart", { date: dayLabel(def, until) })}</span>
              <input type="number" aria-label={t("rb.daysAfterAria")} min={0} value={until - start} onChange={(e) => onUntil(start + Math.max(0, Math.floor(Number(e.target.value)) || 0))} />
              <span>{t("rb.daysAfter")}</span>
            </label>
          )}
          <div className="cal-preview-occurrences" aria-live="polite">
            <span className="field-label">{t("preview.title")}</span>
            {preview.length === 0 ? (
              <p className="cal-help">
                {t("rb.none", { from: dayLabel(def, start, { weekday: false }), to: dayLabel(def, start + PREVIEW_DAYS - 1, { weekday: false }), n: PREVIEW_DAYS })}
              </p>
            ) : (
              <p className="cal-help">
                {preview.slice(0, 6).map((d) => dayLabel(def, d)).join(" · ")}
                {preview.length > 6 ? t("rb.andMore", { n: preview.length - 6, days: PREVIEW_DAYS }) : ""}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
