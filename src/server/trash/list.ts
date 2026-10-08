import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../db/client";
import { articles, calendarEntries, calendars, campaignCharacters, maps, organizations, people, territories } from "../db/schema";
import { TEMPLATE_LABELS, isGenericTemplate, personTemplate } from "../articles/templates";
import { trashedDescendantsLookup, trashedMapRoots, type TrashItem, type TrashRef } from "./trash";
import { serverT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/messages";

const ENTRY_KIND_LABELS: Record<string, MessageKey<"trash">> = { note: "kind.calendarNote", event: "kind.calendarEvent", link: "kind.calendarLink" };

const ms = (d: Date | null) => (d ? d.getTime() : 0);

/** Every trashed item of the world, unsorted (see filterSortTrash). */
export async function listTrash(worldId: string): Promise<TrashItem[]> {
  const t = await serverT("trash");
  const [mapRows, articleRows, personRows, orgRows, territoryRows, calendarRows, entryRows, rosterRows] = await Promise.all([
    db.select({ id: maps.id, name: maps.name, parentId: maps.parentId, deletedAt: maps.deletedAt }).from(maps).where(eq(maps.worldId, worldId)),
    db.select({ id: articles.id, title: articles.title, template: articles.template, deletedAt: articles.deletedAt }).from(articles).where(and(eq(articles.worldId, worldId), isNotNull(articles.deletedAt))),
    db.select({ id: people.id, name: people.name, kind: people.kind, deletedAt: people.deletedAt }).from(people).where(and(eq(people.worldId, worldId), isNotNull(people.deletedAt))),
    db.select({ id: organizations.id, name: organizations.name, deletedAt: organizations.deletedAt }).from(organizations).where(and(eq(organizations.worldId, worldId), isNotNull(organizations.deletedAt))),
    db.select({ id: territories.id, name: territories.name, deletedAt: territories.deletedAt }).from(territories).where(and(eq(territories.worldId, worldId), isNotNull(territories.deletedAt))),
    db.select({ id: calendars.id, name: calendars.name, deletedAt: calendars.deletedAt }).from(calendars).where(and(eq(calendars.worldId, worldId), isNotNull(calendars.deletedAt))),
    db
      .select({ id: calendarEntries.id, kind: calendarEntries.kind, title: calendarEntries.title, description: calendarEntries.description, deletedAt: calendarEntries.deletedAt })
      .from(calendarEntries)
      .where(and(eq(calendarEntries.worldId, worldId), isNotNull(calendarEntries.deletedAt))),
    db.select({ personId: campaignCharacters.personId }).from(campaignCharacters),
  ]);

  const mapNodes = mapRows.map((m) => ({ id: m.id, parentId: m.parentId, deletedAt: m.deletedAt ? m.deletedAt.getTime() : null }));
  const mapNames = new Map(mapRows.map((m) => [m.id, m.name]));
  const descendantsOf = trashedDescendantsLookup(mapNodes);
  const rosterCounts = new Map<string, number>();
  for (const r of rosterRows) rosterCounts.set(r.personId, (rosterCounts.get(r.personId) ?? 0) + 1);

  const base = { childCount: 0, campaignCount: 0 };
  return [
    ...trashedMapRoots(mapNodes).map((m): TrashItem => ({
      ...base,
      kind: "map",
      id: m.id,
      name: mapNames.get(m.id) || t("untitled.map"),
      subtype: t("kind.map"),
      deletedAt: m.deletedAt ?? 0,
      childCount: descendantsOf(m.id).length,
    })),
    ...articleRows.map((a): TrashItem => ({
      ...base,
      kind: "article",
      id: a.id,
      name: a.title || t("untitled.article"),
      subtype: isGenericTemplate(a.template) ? TEMPLATE_LABELS[a.template] : t("kind.article"),
      deletedAt: ms(a.deletedAt),
    })),
    ...personRows.map((p): TrashItem => ({
      ...base,
      kind: "person",
      id: p.id,
      name: p.name || t("untitled.person"),
      subtype: TEMPLATE_LABELS[personTemplate(p.kind)],
      deletedAt: ms(p.deletedAt),
      campaignCount: rosterCounts.get(p.id) ?? 0,
    })),
    ...orgRows.map((o): TrashItem => ({ ...base, kind: "organization", id: o.id, name: o.name || t("untitled.organization"), subtype: TEMPLATE_LABELS.organization, deletedAt: ms(o.deletedAt) })),
    ...territoryRows.map((tr): TrashItem => ({ ...base, kind: "territory", id: tr.id, name: tr.name || t("untitled.territory"), subtype: TEMPLATE_LABELS.territory, deletedAt: ms(tr.deletedAt) })),
    ...calendarRows.map((c): TrashItem => ({ ...base, kind: "calendar", id: c.id, name: c.name || t("untitled.calendar"), subtype: t("kind.calendar"), deletedAt: ms(c.deletedAt) })),
    ...entryRows.map((e): TrashItem => ({
      ...base,
      kind: "calendarEntry",
      id: e.id,
      name: e.title.trim() || e.description.trim().slice(0, 60) || t("untitled.note"),
      subtype: t(ENTRY_KIND_LABELS[e.kind] ?? "kind.calendarEntry"),
      deletedAt: ms(e.deletedAt),
    })),
  ];
}

/** The refs that are in this world's Trash; anything else (another world's, or not trashed) is dropped. */
export async function inWorldTrash(worldId: string, refs: TrashRef[]): Promise<TrashRef[]> {
  const listed = new Set((await listTrash(worldId)).map((item) => `${item.kind}:${item.id}`));
  return refs.filter((ref) => listed.has(`${ref.kind}:${ref.id}`));
}
