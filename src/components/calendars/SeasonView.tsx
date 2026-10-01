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

const plural = (n: number) => `${formatInteger(n)} day${n === 1 ? "" : "s"}`;

/** This season's span in one profile: its dates, length, and the current/next occurrence around `day`. */
function ProfileRow({ season, profile, world, def, day }: { season: ClientSeason; profile: ClientProfile; world: WorldCalendars; def: CalendarDefinition; day: number }) {
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
        {profile.isDefault && <span className="cv-chip">Default</span>}
      </div>
      {members.map((m) => {
        if (m.allYear || (profile.data.mode === "sequential" && profile.data.memberships.length === 1)) {
          return (
            <p key={m.id} className="cal-help">
              The whole year.
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
                Now: began {dayLabel(def, now[0], { weekday: false })} ({relative(now[0], day)}), ends {dayLabel(def, now[1], { weekday: false })} ({relative(now[1], day)})
              </span>
            ) : next ? (
              <span className="cal-help">
                Next begins {dayLabel(def, next[0], { weekday: false })} ({relative(next[0], day)})
              </span>
            ) : null}
          </div>
        );
      })}
      {strip.length > 0 && (
        <div className="cal-season-strip compact" aria-hidden data-tooltip={`Year ${year} in ${profile.name}`}>
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
 * Dates are shown in `def` (the calendar being viewed). "Edit" opens Seasons & Profiles.
 */
export default function SeasonView({ season, world, def, day, previewProfile, onEdit, onClose }: { season: ClientSeason; world: WorldCalendars; def: CalendarDefinition; day: number; previewProfile: ClientProfile | null; onEdit: () => void; onClose: () => void }) {
  const calendarName = season.calendarId === null ? "Every calendar" : (world.calendars.find((c) => c.id === season.calendarId)?.name ?? "A removed calendar");
  const profiles = world.profiles.filter((p) => !p.archived && p.data.memberships.some((m) => m.seasonId === season.id));
  const inSeason = previewProfile ? safe(() => activeSeasons(world.calendars.find((c) => c.id === previewProfile.data.calendarId)?.definition ?? def, previewProfile.data, day).includes(season.id), false) : false;
  return (
    <Modal open onClose={onClose} title="Season" size="wide">
      <div className="cv" style={{ "--cv-color": season.color } as CSSProperties}>
        <header className="cv-hero">
          <span className="cv-badge" aria-hidden>
            {season.icon || <Leaf size={30} />}
          </span>
          <div className="cv-hero-text">
            <h2 className="cv-name">{season.name}</h2>
            <div className="cv-tags">
              <span className="cv-tag">
                <Leaf size={13} aria-hidden /> Season
              </span>
              <span className="cv-tag" data-tooltip="Calendar whose profiles can use it">
                <CalendarDays size={13} aria-hidden /> {calendarName}
              </span>
            </div>
          </div>
        </header>

        <div className="cv-today">
          <span className="field-label">{dayLabel(def, day)}</span>
          {!previewProfile ? (
            <span className="cal-help">No season profile is being previewed.</span>
          ) : inSeason ? (
            <span className="cv-state">In season · {previewProfile.name}</span>
          ) : (
            <span className="cal-help">Not in season on this day ({previewProfile.name}).</span>
          )}
        </div>

        {season.description ? <p className="cv-description">{season.description}</p> : <p className="cal-help">No description yet.</p>}

        <div className="cv-grid">
          <Block title="In profiles" Icon={CalendarRange}>
            {profiles.length === 0 ? (
              <p className="cal-help">Not in any profile yet.</p>
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
            Close
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onEdit}>
            <Pencil size={14} /> Edit in Seasons &amp; Profiles
          </button>
        </div>
      </div>
    </Modal>
  );
}
