"use client";

import { formatInteger } from "@/server/settings/number-format";
import type { CSSProperties } from "react";
import { CalendarDays, CalendarRange, Leaf, Pencil } from "lucide-react";
import Modal from "@/components/Modal";
import { annualInterval } from "@/server/calendars/celestial";
import { fromWorldDay, nextYear, previousYear, type CalendarDefinition } from "@/server/calendars/engine";
import { activeSeasons, effectiveMemberships } from "@/server/calendars/seasons";
import { dayLabel, safe, yearRange } from "./evaluate";
import { Block, LinkedArticles, relative } from "./view-parts";
import type { ClientProfile, ClientSeason, WorldCalendars } from "./types";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";

const plural = (n: number) => activeT("calendars")("sv.days", { count: n, n: formatInteger(n) });

/** This season's span in one profile: its dates, length, and the current/next occurrence around `day`. */
function ProfileRow({ season, profile, world, def, day }: { season: ClientSeason; profile: ClientProfile; world: WorldCalendars; def: CalendarDefinition; day: number }) {
  const t = useT("calendars");
  const pdef = world.calendars.find((c) => c.id === profile.data.calendarId)?.definition;
  if (!pdef) return null;
  const members = safe(() => effectiveMemberships(pdef, profile.data), []).filter((m) => m.seasonId === season.id);
  const year = safe(() => fromWorldDay(pdef, day).year, null);
  const monthDay = (md: { periodId: string; day: number }) => `${md.day} ${pdef.periods.find((p) => p.id === md.periodId)?.name ?? "?"}`;
  const range = year === null ? null : yearRange(pdef, year);
  const strip: boolean[] = [];
  if (range && range[1] - range[0] <= 3000) for (let d = range[0]; d <= range[1]; d++) strip.push(safe(() => activeSeasons(pdef, profile.data, d).includes(season.id), false));

  return (
    <li className="sv-profile">
      <div className="sv-profile-head">
        <strong>{profile.name}</strong>
        {profile.isDefault && <span className="cv-chip">{t("sv.default")}</span>}
      </div>
      {members.map((m) => {
        if (m.allYear || (profile.data.mode === "sequential" && profile.data.memberships.length === 1)) {
          return (
            <p key={m.id} className="cal-help">
              {t("sv.wholeYear")}
            </p>
          );
        }
        // The occurrence running on `day`, else the next one (last year's may wrap into this one).
        const spans = year === null ? [] : [previousYear(pdef, year), year, nextYear(pdef, year)].map((y) => safe(() => annualInterval(pdef, y, m.start, m.end), null)).filter((x): x is [number, number] => x !== null);
        const now = spans.find(([a, b]) => a <= day && day <= b);
        const next = spans.find(([a]) => a > day);
        const length = spans[0] ? spans[0][1] - spans[0][0] + 1 : null;
        return (
          <div key={m.id} className="sv-span">
            <span className="sv-dates">
              {monthDay(m.start)} – {monthDay(m.end)}
              {length !== null && <span className="cal-help"> · {plural(length)}</span>}
            </span>
            {now ? (
              <span className="cal-help">
                {t("sv.now", { start: dayLabel(def, now[0], { weekday: false }), startRel: relative(now[0], day), end: dayLabel(def, now[1], { weekday: false }), endRel: relative(now[1], day) })}
              </span>
            ) : next ? (
              <span className="cal-help">
                {t("sv.next", { start: dayLabel(def, next[0], { weekday: false }), rel: relative(next[0], day) })}
              </span>
            ) : null}
          </div>
        );
      })}
      {strip.length > 0 && (
        <div className="cal-season-strip compact" aria-hidden data-tooltip={t("sv.yearIn", { year: year ?? "", profile: profile.name })}>
          {strip.map((on, i) => (
            <span key={i} style={{ background: on ? season.color : "transparent" }} />
          ))}
        </div>
      )}
    </li>
  );
}

/**
 * Read-only view of a season: what it is, whether it's in season on `day`
 * (in the previewed profile), and its dates in every profile that uses it.
 * Dates are shown in `def` (the calendar being viewed). "Edit" opens it in Seasons.
 */
export default function SeasonView({ season, world, def, day, previewProfile, onEdit, onClose }: { season: ClientSeason; world: WorldCalendars; def: CalendarDefinition; day: number; previewProfile: ClientProfile | null; onEdit: () => void; onClose: () => void }) {
  const t = useT("calendars");
  const tc = useT("common");
  const calendarName = season.calendarId === null ? t("sv.everyCalendar") : (world.calendars.find((c) => c.id === season.calendarId)?.name ?? t("sv.removedCalendar"));
  const profiles = world.profiles.filter((p) => !p.archived && p.data.memberships.some((m) => m.seasonId === season.id));
  const inSeason = previewProfile ? safe(() => activeSeasons(world.calendars.find((c) => c.id === previewProfile.data.calendarId)?.definition ?? def, previewProfile.data, day).includes(season.id), false) : false;
  return (
    <Modal open onClose={onClose} title={t("sv.title")} size="wide">
      <div className="cv" style={{ "--cv-color": season.color } as CSSProperties}>
        <header className="cv-hero">
          <span className="cv-badge" aria-hidden>
            {season.icon || <Leaf size={30} />}
          </span>
          <div className="cv-hero-text">
            <h2 className="cv-name">{season.name}</h2>
            <div className="cv-tags">
              <span className="cv-tag">
                <Leaf size={13} aria-hidden /> {t("sv.title")}
              </span>
              <span className="cv-tag" data-tooltip={t("sv.calendarHint")}>
                <CalendarDays size={13} aria-hidden /> {calendarName}
              </span>
            </div>
          </div>
        </header>

        <div className="cv-today">
          <span className="field-label">{dayLabel(def, day)}</span>
          {!previewProfile ? (
            <span className="cal-help">{t("sv.noPreview")}</span>
          ) : inSeason ? (
            <span className="cv-state">{t("sv.inSeason", { profile: previewProfile.name })}</span>
          ) : (
            <span className="cal-help">{t("sv.notInSeason", { profile: previewProfile.name })}</span>
          )}
        </div>

        {season.description ? <p className="cv-description">{season.description}</p> : <p className="cal-help">{t("cv.noDescription")}</p>}

        <div className="cv-grid">
          <Block title={t("sv.inProfiles")} Icon={CalendarRange}>
            {profiles.length === 0 ? (
              <p className="cal-help">{t("sv.noProfiles")}</p>
            ) : (
              <ul className="sv-profiles">
                {profiles.map((p) => (
                  <ProfileRow key={p.id} season={season} profile={p} world={world} def={def} day={day} />
                ))}
              </ul>
            )}
          </Block>
          <LinkedArticles links={season.articleLinks} />
        </div>

        <div className="cel-footer">
          <button type="button" className="btn btn-sm" onClick={onClose}>
            {tc("close")}
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onEdit}>
            <Pencil size={14} /> {t("sv.edit")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
