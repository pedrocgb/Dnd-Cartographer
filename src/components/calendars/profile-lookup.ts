import { activeSeasons } from "@/server/calendars/seasons";
import { safe } from "./evaluate";
import type { WorldCalendars } from "./types";
import { activeT } from "@/i18n/active";

/**
 * Season profiles as Info Bar link targets, each with its current season:
 * evaluated at the shared current day in the profile's own reference
 * calendar (never the calendar someone last viewed).
 */
export function seasonProfileLookup(world: WorldCalendars): { id: string; name: string; detail: string }[] {
  const t = activeT("calendars");
  return world.profiles.map((p) => {
    const def = world.calendars.find((c) => c.id === p.data.calendarId)?.definition;
    const ids = def ? safe(() => activeSeasons(def, p.data, world.chronology.currentDay), []) : [];
    const names = ids.map((id) => world.seasons.find((s) => s.id === id)?.name ?? t("lookup.removedSeason"));
    const detail = !def ? t("lookup.noCalendar") : names.length ? t("lookup.now", { seasons: names.join(t("lookup.and")) }) : t("lookup.none");
    return { id: p.id, name: p.archived ? t("lookup.archived", { name: p.name }) : p.name, detail };
  });
}

/** How long one /api/calendars answer is shared between callers (an article page asks from several places at once). */
const SHARE_MS = 5000;
let shared: { at: number; promise: Promise<WorldCalendars | null> } | null = null;

/** The world's calendars, seasons and chronology; concurrent and back-to-back callers share one request. */
export function loadWorldCalendars(): Promise<WorldCalendars | null> {
  if (shared && Date.now() - shared.at < SHARE_MS) return shared.promise;
  const promise = fetch("/api/calendars", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<WorldCalendars>) : null))
    .catch(() => null);
  shared = { at: Date.now(), promise };
  return promise;
}

export async function loadSeasonProfileLookup() {
  const world = await loadWorldCalendars();
  return world ? seasonProfileLookup(world) : [];
}
