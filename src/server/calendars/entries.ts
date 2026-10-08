/**
 * Dated entries: parsing a create/edit body and checking every reference
 * against the world (calendars, profiles, seasons, celestial objects,
 * articles). Entries bind to an absolute worldDay; recurrence is stored as
 * a rule and never materialized.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { calendarEntries, calendars, celestialObjects, seasonProfiles } from "@/server/db/schema";
import { isArticleTemplate } from "@/server/articles/templates";
import { resolveArticleNames } from "@/server/articles/lookup";
import { MAX_DURATION_DAYS, type Recurrence } from "./recurrence";
import { cleanColor, cleanName, parseArticleLinks, parseRecurrence, ParseError } from "./parse";
import { InvalidError } from "./mutations";

export const ENTRY_KINDS = ["note", "event", "link"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

function recurrenceRefs(rule: Recurrence) {
  const calendarIds = new Set<string>();
  const profileIds = new Set<string>();
  const objectIds = new Set<string>();
  if ("calendarId" in rule) calendarIds.add(rule.calendarId);
  if (rule.kind === "condition") {
    for (const c of rule.group.conditions) {
      if (c.type === "season") profileIds.add(c.profileId);
      else if (c.type === "celestial") objectIds.add(c.objectId);
      else calendarIds.add(c.calendarId);
    }
  }
  return { calendarIds: [...calendarIds], profileIds: [...profileIds], objectIds: [...objectIds] };
}

/** Throws InvalidError when a rule points outside the world. */
export async function checkRecurrence(worldId: string, rule: Recurrence) {
  const refs = recurrenceRefs(rule);
  const [cal, prof, obj] = await Promise.all([
    refs.calendarIds.length ? db.select({ id: calendars.id }).from(calendars).where(and(eq(calendars.worldId, worldId), inArray(calendars.id, refs.calendarIds))) : [],
    refs.profileIds.length ? db.select({ id: seasonProfiles.id }).from(seasonProfiles).where(and(eq(seasonProfiles.worldId, worldId), inArray(seasonProfiles.id, refs.profileIds))) : [],
    refs.objectIds.length ? db.select({ id: celestialObjects.id }).from(celestialObjects).where(and(eq(celestialObjects.worldId, worldId), inArray(celestialObjects.id, refs.objectIds))) : [],
  ]);
  if (cal.length !== refs.calendarIds.length) throw new InvalidError({ key: "problem.repeatCalendarGone" });
  if (prof.length !== refs.profileIds.length) throw new InvalidError({ key: "problem.profileGone" });
  if (obj.length !== refs.objectIds.length) throw new InvalidError({ key: "problem.objectGone" });
}

/** Live articles of the world only; a link to a deleted, missing or other-world article is refused. */
export async function checkArticles(worldId: string, links: { template: string; articleId: string }[]) {
  if (links.some((l) => !isArticleTemplate(l.template))) throw new InvalidError({ key: "problem.unknownArticleType" });
  const names = await resolveArticleNames(worldId, links);
  if (links.some((l) => !names.has(l.articleId))) throw new InvalidError({ key: "problem.linkedArticleGone" });
}

/** The links that point at live articles of the world (others, e.g. since deleted, are dropped), as stored JSON. */
export async function worldArticleLinksJson(worldId: string, links: { template: string; articleId: string }[]): Promise<string> {
  const names = await resolveArticleNames(worldId, links);
  return JSON.stringify(links.filter((l) => names.has(l.articleId)));
}

const dayInt = (v: unknown, what: string) => {
  if (!Number.isSafeInteger(v) || Math.abs(v as number) > 100_000_000) throw new ParseError(`${what} must be a whole day number.`);
  return v as number;
};

export interface EntryFields {
  worldDay?: number;
  durationDays?: number;
  title?: string;
  description?: string;
  category?: string;
  color?: string;
  articleTemplate?: string | null;
  articleId?: string | null;
  articleLinks?: string;
  recurrence?: string;
  untilDay?: number | null;
  source?: string | null;
}

/** The fields present in `body`, cleaned (kind-specific rules checked by the caller's `kind`). */
export async function parseEntryFields(worldId: string, kind: EntryKind, body: Record<string, unknown>): Promise<EntryFields> {
  const out: EntryFields = {};
  if ("worldDay" in body) out.worldDay = dayInt(body.worldDay, "The date");
  if ("durationDays" in body) {
    const d = dayInt(body.durationDays, "The duration");
    if (d < 1 || d > MAX_DURATION_DAYS) throw new ParseError({ key: "problem.eventLength", params: { max: MAX_DURATION_DAYS } });
    out.durationDays = kind === "event" ? d : 1;
  }
  if ("title" in body) out.title = cleanName(body.title, 200);
  if ("description" in body) out.description = cleanName(body.description, 4000);
  if ("category" in body) out.category = cleanName(body.category, 60);
  if ("color" in body) out.color = cleanColor(body.color) ?? "";
  if ("articleLinks" in body && kind === "event") {
    const links = parseArticleLinks(body.articleLinks);
    await checkArticles(worldId, links);
    out.articleLinks = JSON.stringify(links);
  }
  if (kind === "link" && ("articleId" in body || "articleTemplate" in body)) {
    const template = typeof body.articleTemplate === "string" ? body.articleTemplate : "";
    const articleId = typeof body.articleId === "string" ? body.articleId : "";
    if (!template || !articleId) throw new ParseError({ key: "problem.pickArticle" });
    await checkArticles(worldId, [{ template, articleId }]);
    out.articleTemplate = template;
    out.articleId = articleId;
  }
  if ("recurrence" in body && kind === "event") {
    const rule = parseRecurrence(body.recurrence);
    await checkRecurrence(worldId, rule);
    out.recurrence = JSON.stringify(rule);
  }
  if ("untilDay" in body && kind === "event") out.untilDay = body.untilDay === null ? null : dayInt(body.untilDay, "The last date");
  if ("source" in body && body.source && typeof body.source === "object") {
    const s = body.source as Record<string, unknown>;
    if (typeof s.calendarId === "string" && Number.isSafeInteger(s.version)) out.source = JSON.stringify({ calendarId: s.calendarId, version: s.version });
  }
  return out;
}

/** An identical live article link on the same day already exists. */
export async function duplicateLink(worldId: string, worldDay: number, articleId: string, exceptId?: string) {
  const rows = await db
    .select({ id: calendarEntries.id })
    .from(calendarEntries)
    .where(
      and(eq(calendarEntries.worldId, worldId), eq(calendarEntries.kind, "link"), eq(calendarEntries.worldDay, worldDay), eq(calendarEntries.articleId, articleId), isNull(calendarEntries.deletedAt))
    );
  return rows.some((r) => r.id !== exceptId);
}

/** Display names for every article the entries point at; missing ones are absent (shown as "(removed)"). */
export async function linkedNames(worldId: string, entries: { articleTemplate: string | null; articleId: string | null; articleLinks: { template: string; articleId: string }[] }[]) {
  const refs = entries.flatMap((e) => [...(e.articleId && e.articleTemplate ? [{ template: e.articleTemplate, articleId: e.articleId }] : []), ...e.articleLinks]);
  return Object.fromEntries(await resolveArticleNames(worldId, refs));
}
