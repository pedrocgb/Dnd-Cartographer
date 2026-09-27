import { and, eq, isNull, like } from "drizzle-orm";
import { db } from "@/server/db/client";
import { articles, calendarEntries, seasons, territories } from "@/server/db/schema";
import { profileIssues, type SeasonProfileData } from "./seasons";
import { InvalidError } from "./mutations";
import { calendarOf } from "./store";
import { safeJson } from "./parse";
import type { CalendarDefinition } from "./engine";

/** Throws InvalidError unless the profile is valid in its (live, same-world) calendar and every season exists. */
export async function checkProfile(worldId: string, data: SeasonProfileData) {
  const calendar = await calendarOf(worldId, data.calendarId);
  if (!calendar) throw new InvalidError("Pick the calendar this profile's dates are read in.");
  const seasonRows = await db.select({ id: seasons.id, name: seasons.name, calendarId: seasons.calendarId }).from(seasons).where(eq(seasons.worldId, worldId));
  const names = new Map(seasonRows.map((s) => [s.id, s.name]));
  const unknown = data.memberships.find((m) => !names.has(m.seasonId));
  if (unknown) throw new InvalidError("A season in this profile no longer exists.");
  const foreign = seasonRows.find((s) => s.calendarId !== null && s.calendarId !== data.calendarId && data.memberships.some((m) => m.seasonId === s.id));
  if (foreign) throw new InvalidError(`"${foreign.name}" belongs to another calendar.`);
  const def = safeJson<CalendarDefinition | null>(calendar.definition, null);
  if (!def) throw new InvalidError("That calendar can't be read.");
  const issues = profileIssues(def, data, (id) => names.get(id) ?? "A season");
  if (issues.length) throw new InvalidError(issues[0].message);
}

/** Articles (territories, generic articles) whose Season Profile field points at the profile — assignment lives there. */
export async function profileUsers(worldId: string, profileId: string) {
  const pattern = `%"seasonProfile":"${profileId}"%`;
  const [territoryRows, articleRows, entryRows] = await Promise.all([
    db.select({ name: territories.name }).from(territories).where(and(eq(territories.worldId, worldId), isNull(territories.deletedAt), like(territories.info, pattern))),
    db.select({ name: articles.title }).from(articles).where(and(eq(articles.worldId, worldId), isNull(articles.deletedAt), like(articles.info, pattern))),
    db
      .select({ name: calendarEntries.title })
      .from(calendarEntries)
      .where(and(eq(calendarEntries.worldId, worldId), isNull(calendarEntries.deletedAt), like(calendarEntries.recurrence, `%"profileId":"${profileId}"%`))),
  ]);
  return { articles: [...territoryRows, ...articleRows].map((r) => r.name), events: entryRows.map((r) => r.name || "Untitled event") };
}
