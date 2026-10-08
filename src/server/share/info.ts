import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/server/db/client";
import { articles, calendars, organizations, people, relations, seasonProfiles, shareLinks, territories } from "@/server/db/schema";
import { INFO_SECRETS_KEY, addedInfo, infoSecrets, isNameSecret, parseWorldDay, type InfoValues } from "@/server/articles/info-fields";
import { INFO_FIELD_SETS } from "@/server/articles/info-sets";
import type { ArticleTemplateKey } from "@/server/articles/templates";
import { relationFieldValues } from "@/server/relations/info-backing";
import { chronologyOf } from "@/server/calendars/store";
import { dayLabel } from "@/components/calendars/evaluate";
import type { CalendarDefinition } from "@/server/calendars/engine";
import { sharePath } from "./load";

/**
 * A shared article's Info Bar, resolved on the server: the viewer has no
 * session, so every link name and date label comes ready to show. Secret
 * fields and secret relations stay out, like unrevealed secrets in the text,
 * and so does a link to a record whose name is secret.
 */
export interface SharedInfo {
  values: InfoValues;
  /** Each linked id in `values` that still exists: its name, and its own share's path (null when it has none). */
  links: Record<string, { name: string; href: string | null }>;
  /** Each date value (by world day) labelled in the world's default calendar; empty without one. */
  dates: Record<string, string>;
}

/** The article's Info Bar, or null when its template has none. `row` is its database row (info JSON and columns). */
export async function loadSharedInfo(worldId: string, token: string, template: ArticleTemplateKey, id: string, row: { info?: string }): Promise<SharedInfo | null> {
  const set = INFO_FIELD_SETS[template];
  if (!set) return null;

  const backing = set.fields.some((f) => f.relation)
    ? await db
        .select({ type: relations.type, fromId: relations.fromId, toId: relations.toId, oneWay: relations.oneWay })
        .from(relations)
        .where(and(eq(relations.worldId, worldId), isNull(relations.deletedAt), eq(relations.secret, false), or(eq(relations.fromId, id), eq(relations.toId, id))))
    : [];
  const candidateIds = [...new Set(backing.flatMap((r) => [r.fromId, r.toId]).filter((x) => x !== id))];
  const linkIdsOf = (values: InfoValues) =>
    set.fields.flatMap((f) => {
      if (f.kind !== "link") return [];
      const v = values[f.key];
      return (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === "string" && x.length > 0);
    });

  // Names and templates of everything the values (or relation ends) can point at.
  const stored = addedInfo(set, row);
  const ids = [...new Set([...candidateIds, ...linkIdsOf(stored)])];
  const found = new Map<string, { name: string; template: ArticleTemplateKey | "seasonProfile"; info?: string }>();
  if (ids.length) {
    const [ps, os, ts, as, sp] = await Promise.all([
      db.select({ id: people.id, name: people.name, kind: people.kind, info: people.info }).from(people).where(and(eq(people.worldId, worldId), inArray(people.id, ids), isNull(people.deletedAt))),
      db.select({ id: organizations.id, name: organizations.name, info: organizations.info }).from(organizations).where(and(eq(organizations.worldId, worldId), inArray(organizations.id, ids), isNull(organizations.deletedAt))),
      db.select({ id: territories.id, name: territories.name, info: territories.info }).from(territories).where(and(eq(territories.worldId, worldId), inArray(territories.id, ids), isNull(territories.deletedAt))),
      db.select({ id: articles.id, name: articles.title, template: articles.template, info: articles.info }).from(articles).where(and(eq(articles.worldId, worldId), inArray(articles.id, ids), isNull(articles.deletedAt))),
      db.select({ id: seasonProfiles.id, name: seasonProfiles.name }).from(seasonProfiles).where(and(eq(seasonProfiles.worldId, worldId), inArray(seasonProfiles.id, ids))),
    ]);
    for (const p of ps) found.set(p.id, { name: p.name, template: p.kind === "player" ? "playerCharacter" : "character", info: p.info });
    for (const o of os) found.set(o.id, { name: o.name, template: "organization", info: o.info });
    for (const t of ts) found.set(t.id, { name: t.name, template: "territory", info: t.info });
    for (const a of as) found.set(a.id, { name: a.name, template: a.template as ArticleTemplateKey, info: a.info });
    for (const s of sp) found.set(s.id, { name: s.name, template: "seasonProfile" });
  }
  const templateOf = (other: string) => {
    const t = found.get(other)?.template;
    return t && t !== "seasonProfile" ? t : null;
  };
  const values = withoutSecrets(addedInfo(set, row, relationFieldValues(set, id, backing, templateOf)), (other) => isNameSecret(found.get(other)?.info));

  // Only links whose target has its own active share open anything.
  const linked = linkIdsOf(values).filter((x) => found.has(x));
  const shared = linked.length
    ? await db
        .select({ token: shareLinks.token, targetId: shareLinks.targetId })
        .from(shareLinks)
        .where(and(eq(shareLinks.worldId, worldId), eq(shareLinks.targetKind, "article"), inArray(shareLinks.targetId, linked), isNull(shareLinks.revokedAt)))
    : [];
  const tokenOf = new Map(shared.map((s) => [s.targetId, s.token]));
  const links: SharedInfo["links"] = {};
  for (const x of linked) {
    const other = tokenOf.get(x);
    links[x] = { name: found.get(x)!.name, href: found.get(x)!.template !== "seasonProfile" && other && other !== token ? sharePath(other) : null };
  }

  const days = set.fields.flatMap((f) => (f.kind === "date" ? [parseWorldDay(values[f.key])] : [])).filter((d): d is number => d !== null);
  const dates: SharedInfo["dates"] = {};
  if (days.length) {
    const def = await defaultCalendar(worldId);
    if (def) for (const d of days) dates[String(d)] = dayLabel(def, d, { weekday: false });
  }
  return { values, links, dates };
}

/** The values without secret fields, and without links to records whose name is secret (a field left empty is dropped). */
function withoutSecrets(values: InfoValues, hiddenLink: (id: string) => boolean): InfoValues {
  const secrets = infoSecrets(values);
  const out: InfoValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === INFO_SECRETS_KEY || secrets.includes(key)) continue;
    if (Array.isArray(value)) {
      const kept = value.filter((v) => !hiddenLink(v));
      if (kept.length || !value.length) out[key] = kept;
    } else if (value === null || !hiddenLink(value)) out[key] = value;
  }
  return out;
}

/** The world's default calendar (else its first live one), as the app's Info Bar picks it. */
async function defaultCalendar(worldId: string): Promise<CalendarDefinition | null> {
  const [chronology, rows] = await Promise.all([
    chronologyOf(worldId),
    db.select({ id: calendars.id, definition: calendars.definition, deletedAt: calendars.deletedAt }).from(calendars).where(eq(calendars.worldId, worldId)).orderBy(calendars.sortOrder, calendars.createdAt),
  ]);
  const row = rows.find((r) => r.id === chronology.defaultCalendarId) ?? rows.find((r) => !r.deletedAt);
  if (!row) return null;
  try {
    return JSON.parse(row.definition) as CalendarDefinition;
  } catch {
    return null;
  }
}
