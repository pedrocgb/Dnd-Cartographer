"use client";

import { formatDecimal } from "@/server/settings/number-format";
import type { CSSProperties } from "react";
import { CalendarClock, CalendarDays, Pencil, Sparkles } from "lucide-react";
import Modal from "@/components/Modal";
import { cycleTotal, evaluateCelestial, normalizeSchedule, phaseSpans, scheduleStarts, type CalendarResolver } from "@/server/calendars/celestial";
import type { CalendarDefinition } from "@/server/calendars/engine";
import { ruleSummary } from "./CelestialSections";
import { CELESTIAL_TYPES } from "./celestial-types";
import { dayLabel, safe } from "./evaluate";
import { Block, LinkedArticles, relative } from "./view-parts";
import type { ClientCalendar, ClientCelestial } from "./types";
import { useT } from "@/i18n/useT";

/** How far ahead appearances are looked up (physical days). */
const HORIZON = 50_000;

/** Upcoming start of each distinct phase name within the next cycle and a half, in date order. */
function upcomingPhases(object: ClientCelestial, from: number) {
  const total = cycleTotal(object.config.phases ?? []);
  if (total <= 0) return [];
  const spans = safe(() => phaseSpans(object.config, from, from + Math.ceil(total * 1.5)), []);
  const seen = new Set<string>();
  const out: { name: string; icon: string; start: number }[] = [];
  for (const s of spans) {
    // The span running on `from` started earlier; only fresh starts count as "next".
    if (s.start === from && safe(() => evaluateCelestial("moon", object.config, from - 1, () => null)[0]?.name, null) === s.name) continue;
    if (seen.has(s.name)) continue;
    seen.add(s.name);
    out.push({ name: s.name, icon: s.icon, start: s.start });
  }
  return out;
}

function MoonCycle({ object, def, day }: { object: ClientCelestial; def: CalendarDefinition; day: number }) {
  const t = useT("calendars");
  const phases = object.config.phases ?? [];
  const total = cycleTotal(phases);
  const spans = safe(() => phaseSpans(object.config, day, day + total - 1), []);
  const next = upcomingPhases(object, day);
  // A cycle storing several lunations repeats its phase names (e.g. 29 + 30 days for a 29.5-day month).
  const distinct = new Set(phases.map((p) => p.name)).size;
  const lunations = distinct > 0 && phases.length % distinct === 0 ? phases.length / distinct : 1;
  // {days} is left in place, then split so it can be bold.
  const [leadBefore, leadAfter] = (lunations > 1 ? t("cv.lunations", { phases: distinct, total, lunations }) : t("cv.cycle", { phases: phases.length })).split("{days}");
  return (
    <Block title={t("cv.lunarCycle")} Icon={CalendarClock}>
      <p className="cv-lead">
        {leadBefore}
        <strong>{t("cv.daysBold", { n: lunations > 1 ? formatDecimal(total / lunations, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : total })}</strong>
        {leadAfter}
      </p>
      <div className="cv-cycle" aria-label={t("cv.nextCycle")}>
        {spans.map((s) => (
          <span key={s.start} className="cv-cycle-span" style={{ flexGrow: s.end - s.start + 1 }} data-tooltip={t("cv.span", { name: s.name, dates: `${dayLabel(def, s.start, { weekday: false })}${s.end > s.start ? ` – ${dayLabel(def, s.end, { weekday: false })}` : ""}` })}>
            <span aria-hidden>{s.icon}</span>
          </span>
        ))}
      </div>
      {next.length > 0 && (
        <ul className="cv-list">
          {next.map((p) => (
            <li key={p.name}>
              <span className="cv-list-icon" aria-hidden>
                {p.icon || "•"}
              </span>
              <span className="cv-list-main">
                <strong>{t("cv.next", { name: p.name })}</strong>
                <span className="cal-help">{dayLabel(def, p.start)}</span>
              </span>
              <span className="cv-chip">{relative(p.start, day)}</span>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

function Appearances({ object, def, day, calendars, resolve }: { object: ClientCelestial; def: CalendarDefinition; day: number; calendars: ClientCalendar[]; resolve: CalendarResolver }) {
  const t = useT("calendars");
  const schedules = (object.config.schedules ?? []).map(normalizeSchedule);
  const states = object.config.states ?? [];
  return (
    <Block title={t("cv.appearances")} Icon={CalendarClock}>
      {schedules.length === 0 ? (
        <p className="cal-help">{t("cv.noRules")}</p>
      ) : (
        <ul className="cv-list">
          {schedules.map((s) => {
            const state = states.find((x) => x.id === s.stateId);
            const next = safe(() => scheduleStarts(s, day, day + HORIZON, resolve, 3), []);
            return (
              <li key={s.id}>
                <span className="cv-list-icon" aria-hidden>
                  {state?.icon || object.icon || "•"}
                </span>
                <span className="cv-list-main">
                  <strong>{ruleSummary(s, state?.name ?? t("cv.appears"), calendars)}</strong>
                  <span className="cal-help">{next.length ? t("cv.nextList", { list: next.map((d) => `${dayLabel(def, d, { weekday: false })} (${relative(d, day)})`).join(" · ") }) : t("sched.noUpcoming")}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Block>
  );
}

function SpecialDates({ object, def, day }: { object: ClientCelestial; def: CalendarDefinition; day: number }) {
  const t = useT("calendars");
  const phases = object.config.phases ?? [];
  const states = object.config.states ?? [];
  const nameOf = (id: string) => phases.find((p) => p.id === id)?.name ?? states.find((s) => s.id === id)?.name ?? "?";
  const overrides = (object.config.overrides ?? []).filter((o) => o.end >= day).sort((a, b) => a.start - b.start);
  const restarts = (object.config.segments ?? []).length;
  if (overrides.length === 0 && restarts === 0) return null;
  return (
    <Block title={t("cv.specialDates")} Icon={Sparkles}>
      {overrides.length > 0 ? (
        <ul className="cv-list">
          {overrides.slice(0, 5).map((o) => (
            <li key={o.id}>
              <span className="cv-list-icon" aria-hidden>
                ✦
              </span>
              <span className="cv-list-main">
                <strong>{nameOf(o.stateId)}</strong>
                <span className="cal-help">
                  {dayLabel(def, o.start, { weekday: false })}
                  {o.end > o.start ? ` – ${dayLabel(def, o.end, { weekday: false })}` : ""}
                </span>
              </span>
              <span className="cv-chip">{relative(o.start, day)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cal-help">{t("cv.noSpecial")}</p>
      )}
      {overrides.length > 5 && <p className="cal-help">{t("cv.andMore", { n: overrides.length - 5 })}</p>}
      {restarts > 0 && <p className="cal-help">{t("cv.restarts", { count: restarts, n: restarts })}</p>}
    </Block>
  );
}

/**
 * Read-only view of a celestial object: what it is, its state on `day`,
 * its cycle or appearances, special dates and linked articles. Dates are
 * shown in `def` (the calendar being viewed). "Edit" hands over to the editor.
 */
export default function CelestialView({ object, def, day, calendars, onEdit, onClose }: { object: ClientCelestial; def: CalendarDefinition; day: number; calendars: ClientCalendar[]; onEdit: () => void; onClose: () => void }) {
  const t = useT("calendars");
  const tc = useT("common");
  const info = CELESTIAL_TYPES.find((x) => x.type === object.type) ?? CELESTIAL_TYPES[CELESTIAL_TYPES.length - 1];
  const resolve: CalendarResolver = (id) => calendars.find((c) => c.id === id)?.definition ?? null;
  const today = safe(() => evaluateCelestial(object.type, object.config, day, resolve), []);
  const shownIn = object.calendarIds === null ? t("cv.everyCalendar") : object.calendarIds.map((id) => calendars.find((c) => c.id === id)?.name).filter(Boolean).join(", ") || t("cv.noCalendar");
  return (
    <Modal open onClose={onClose} title={info.label} size="wide">
      <div className="cv" style={{ "--cv-color": object.color } as CSSProperties}>
        <header className="cv-hero">
          <span className="cv-badge" aria-hidden>
            {object.icon || info.symbol}
          </span>
          <div className="cv-hero-text">
            <h2 className="cv-name">{object.name}</h2>
            {/* One solid bar (type | calendars), readable over any hero tint. */}
            <div className="cv-tags">
              <span className="cv-tag">
                <info.Icon size={13} aria-hidden /> {info.label}
              </span>
              <span className="cv-tag" data-tooltip={t("cv.shownInHint")}>
                <CalendarDays size={13} aria-hidden /> {shownIn}
              </span>
            </div>
          </div>
        </header>

        <div className="cv-today">
          <span className="field-label">{dayLabel(def, day)}</span>
          {today.length ? (
            <div className="cv-states">
              {today.map((s) => (
                <span key={s.id} className="cv-state">
                  <span aria-hidden>{s.icon || object.icon || "•"}</span> {s.name}
                  {s.override && <span className="cal-help">{t("cv.specialSuffix")}</span>}
                </span>
              ))}
            </div>
          ) : (
            <span className="cal-help">{t("cv.notInSky")}</span>
          )}
        </div>

        {object.description ? <p className="cv-description">{object.description}</p> : <p className="cal-help">{t("cv.noDescription")}</p>}

        <div className="cv-grid">
          {object.type === "moon" ? <MoonCycle object={object} def={def} day={day} /> : <Appearances object={object} def={def} day={day} calendars={calendars} resolve={resolve} />}
          <SpecialDates object={object} def={def} day={day} />
          <LinkedArticles links={object.articleLinks} />
        </div>

        <div className="cel-footer">
          <button type="button" className="btn btn-sm" onClick={onClose}>
            {tc("close")}
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onEdit}>
            <Pencil size={14} /> {t("sidebar.edit")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
