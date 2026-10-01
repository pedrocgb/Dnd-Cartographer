import { rm } from "node:fs/promises";
import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  articleFolderItems,
  articles,
  authorityAssignments,
  calendarEntries,
  calendars,
  campaignCharacters,
  campaigns,
  celestialObjects,
  definitionRevisions,
  documentMentions,
  lineGroups,
  mapAssets,
  mapGrids,
  mapLayers,
  mapLegends,
  mapLines,
  mapRoutes,
  mapScaleBars,
  mapTexts,
  maps,
  markerAffiliations,
  markerArticleLinks,
  markers,
  organizations,
  people,
  politicalLinks,
  politicalReferences,
  processingJobs,
  relations,
  richDocuments,
  routeGroups,
  seasonProfiles,
  seasons,
  territories,
  territorySeats,
  textGroups,
  worldChronology,
  zoneRegions,
  zones,
} from "../db/schema";
import type { Executor } from "../relations/store";
import { resolveAssetPath } from "../storage/storage-adapter";
import { portraitCropPath, portraitOriginalPath, portraitPath, type PortraitOwnerType } from "../assets/portrait-paths";
import { trashedDescendants, type TrashRef } from "./trash";

/**
 * Permanent delete of trashed items. Nothing cascades in the schema, so
 * every dependent row is removed here, children before the rows their
 * foreign keys point at, in one transaction. Files (map images, portraits)
 * go after the commit; a failure there is logged, never thrown — the rows
 * are already gone and `npm run cleanup` sweeps leftovers.
 *
 * Only trashed items are purged: a ref to a live (or missing) row is skipped.
 */

/** Keeps each IN (...) list well under SQLite's variable limit. */
const CHUNK = 400;

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

/** Runs `fn` on each chunk of `ids` (no-op for none). */
async function eachChunk(ids: string[], fn: (chunk: string[]) => Promise<unknown>) {
  for (const chunk of chunks(ids)) await fn(chunk);
}

const compact = (ids: (string | null | undefined)[]) => [...new Set(ids.filter((id): id is string => !!id))];

/** Deletes rich documents and the mention index rows they own. */
async function deleteDocuments(tx: Executor, documentIds: string[]) {
  await eachChunk(documentIds, (c) => tx.delete(documentMentions).where(inArray(documentMentions.documentId, c)));
  await eachChunk(documentIds, (c) => tx.delete(richDocuments).where(inArray(richDocuments.id, c)));
}

/** Rows anywhere that point at these ids without a foreign key: backlinks, relations, political links. */
async function deleteLooseReferences(tx: Executor, ids: string[]) {
  await eachChunk(ids, (c) => tx.delete(documentMentions).where(inArray(documentMentions.targetId, c)));
  await eachChunk(ids, (c) => tx.delete(relations).where(or(inArray(relations.fromId, c), inArray(relations.toId, c))));
  await eachChunk(ids, (c) => tx.delete(politicalLinks).where(or(inArray(politicalLinks.ownerId, c), inArray(politicalLinks.targetId, c))));
  await eachChunk(ids, (c) => tx.delete(politicalReferences).where(or(inArray(politicalReferences.sourceId, c), inArray(politicalReferences.targetId, c))));
}

export interface PurgeResult {
  purged: number;
  /** Maps left in the Trash because an image of theirs is being processed right now. */
  skipped: { ref: TrashRef; reason: string }[];
}

/** Map roots and their trashed sub-maps: the rows to delete and the asset directories to remove afterwards. */
async function purgeMaps(tx: Executor, rootIds: string[], result: PurgeResult): Promise<string[]> {
  if (rootIds.length === 0) return [];
  const all = await tx.select({ id: maps.id, parentId: maps.parentId, deletedAt: maps.deletedAt }).from(maps);
  const nodes = all.map((m) => ({ id: m.id, parentId: m.parentId, deletedAt: m.deletedAt ? m.deletedAt.getTime() : null }));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const mapIds: string[] = [];
  for (const rootId of rootIds) {
    if (byId.get(rootId)?.deletedAt == null) continue;
    const subtree = [rootId, ...trashedDescendants(nodes, rootId).map((n) => n.id)];
    const busy = await tx
      .select({ id: processingJobs.id })
      .from(processingJobs)
      .innerJoin(mapAssets, eq(processingJobs.assetId, mapAssets.id))
      .where(and(inArray(mapAssets.mapId, subtree), eq(processingJobs.state, "processing")))
      .limit(1);
    if (busy.length > 0) {
      result.skipped.push({ ref: { kind: "map", id: rootId }, reason: "An image of this map is still being processed. Try again in a moment." });
      continue;
    }
    mapIds.push(...subtree);
  }
  if (mapIds.length === 0) return [];

  const assetIds: string[] = [];
  const markerIds: string[] = [];
  const documentIds: string[] = [];
  for (const c of chunks(mapIds)) {
    assetIds.push(...(await tx.select({ id: mapAssets.id }).from(mapAssets).where(inArray(mapAssets.mapId, c))).map((r) => r.id));
    const markerRows = await tx.select({ id: markers.id, doc: markers.descriptionDocumentId }).from(markers).where(inArray(markers.mapId, c));
    markerIds.push(...markerRows.map((r) => r.id));
    documentIds.push(...compact(markerRows.map((r) => r.doc)));
    documentIds.push(...compact((await tx.select({ doc: maps.descriptionDocumentId }).from(maps).where(inArray(maps.id, c))).map((r) => r.doc)));
  }

  // Image pipeline, then the drawn items and per-map settings.
  await eachChunk(assetIds, (c) => tx.delete(processingJobs).where(inArray(processingJobs.assetId, c)));
  await eachChunk(mapIds, async (c) => {
    await tx.delete(mapAssets).where(inArray(mapAssets.mapId, c));
    await tx.delete(zones).where(inArray(zones.mapId, c));
    await tx.delete(zoneRegions).where(inArray(zoneRegions.mapId, c));
    await tx.delete(mapTexts).where(inArray(mapTexts.mapId, c));
    await tx.delete(textGroups).where(inArray(textGroups.mapId, c));
    await tx.delete(mapLines).where(inArray(mapLines.mapId, c));
    await tx.delete(lineGroups).where(inArray(lineGroups.mapId, c));
    await tx.delete(mapRoutes).where(inArray(mapRoutes.mapId, c));
    await tx.delete(routeGroups).where(inArray(routeGroups.mapId, c));
    await tx.delete(mapGrids).where(inArray(mapGrids.mapId, c));
    await tx.delete(mapLegends).where(inArray(mapLegends.mapId, c));
    await tx.delete(mapScaleBars).where(inArray(mapScaleBars.mapId, c));
  });

  // Markers: their political ties and article links first.
  await eachChunk(markerIds, async (c) => {
    await tx.delete(territorySeats).where(inArray(territorySeats.markerId, c));
    await tx.delete(markerAffiliations).where(inArray(markerAffiliations.markerId, c));
    await tx.delete(markerArticleLinks).where(inArray(markerArticleLinks.markerId, c));
  });
  await deleteLooseReferences(tx, [...markerIds, ...mapIds]);
  // Markers elsewhere that open one of these maps stop linking to it; live sub-maps move to the root.
  await eachChunk(mapIds, async (c) => {
    await tx.update(markers).set({ linkedMapId: null }).where(inArray(markers.linkedMapId, c));
    await tx.update(maps).set({ parentId: null }).where(inArray(maps.parentId, c));
  });
  await eachChunk(mapIds, async (c) => {
    await tx.delete(markers).where(inArray(markers.mapId, c));
    await tx.delete(mapLayers).where(inArray(mapLayers.mapId, c));
    await tx.delete(maps).where(inArray(maps.id, c));
  });
  await deleteDocuments(tx, compact(documentIds));

  result.purged += rootIds.filter((id) => mapIds.includes(id)).length;
  return assetIds.flatMap((id) => [resolveAssetPath("originals", id), resolveAssetPath("tiles", id), resolveAssetPath("thumbnails", id)]);
}

const portraitFiles = (ownerType: PortraitOwnerType, ids: string[]) =>
  ids.flatMap((id) => [portraitPath(ownerType, id), portraitOriginalPath(ownerType, id), portraitCropPath(ownerType, id)]);

/** Calendar entries: their document, then the entries. */
async function purgeEntryRows(tx: Executor, entryIds: string[]) {
  const documentIds: string[] = [];
  for (const c of chunks(entryIds)) {
    documentIds.push(...compact((await tx.select({ doc: calendarEntries.documentId }).from(calendarEntries).where(inArray(calendarEntries.id, c))).map((r) => r.doc)));
  }
  await eachChunk(entryIds, (c) => tx.delete(calendarEntries).where(inArray(calendarEntries.id, c)));
  await deleteDocuments(tx, documentIds);
}

/** The trashed rows among `ids` of one article table, with their documents. */
async function trashedArticleRows(tx: Executor, kind: TrashRef["kind"], ids: string[]): Promise<{ ids: string[]; documentIds: string[] }> {
  if (ids.length === 0) return { ids: [], documentIds: [] };
  const found: { id: string; docs: (string | null)[] }[] = [];
  for (const c of chunks(ids)) {
    if (kind === "article") {
      const rows = await tx.select().from(articles).where(and(inArray(articles.id, c), isNotNull(articles.deletedAt)));
      found.push(...rows.map((r) => ({ id: r.id, docs: [r.bodyDocumentId, r.sidebarDocumentId, r.footerDocumentId] })));
    } else if (kind === "person") {
      const rows = await tx.select().from(people).where(and(inArray(people.id, c), isNotNull(people.deletedAt)));
      found.push(...rows.map((r) => ({ id: r.id, docs: [r.descriptionDocumentId, r.sidebarDocumentId, r.footerDocumentId] })));
    } else if (kind === "organization") {
      const rows = await tx.select().from(organizations).where(and(inArray(organizations.id, c), isNotNull(organizations.deletedAt)));
      found.push(...rows.map((r) => ({ id: r.id, docs: [r.descriptionDocumentId, r.sidebarDocumentId, r.footerDocumentId] })));
    } else if (kind === "territory") {
      const rows = await tx.select().from(territories).where(and(inArray(territories.id, c), isNotNull(territories.deletedAt)));
      found.push(...rows.map((r) => ({ id: r.id, docs: [r.descriptionDocumentId, r.sidebarDocumentId, r.footerDocumentId] })));
    }
  }
  return { ids: found.map((f) => f.id), documentIds: compact(found.flatMap((f) => f.docs)) };
}

/** Every article table at once: the ties each kind has, then the rows, documents and portrait files. */
async function purgeArticles(tx: Executor, refs: TrashRef[], result: PurgeResult): Promise<string[]> {
  const of = (kind: TrashRef["kind"]) => refs.filter((r) => r.kind === kind).map((r) => r.id);
  const generic = await trashedArticleRows(tx, "article", of("article"));
  const persons = await trashedArticleRows(tx, "person", of("person"));
  const orgs = await trashedArticleRows(tx, "organization", of("organization"));
  const lands = await trashedArticleRows(tx, "territory", of("territory"));
  const allIds = [...generic.ids, ...persons.ids, ...orgs.ids, ...lands.ids];
  if (allIds.length === 0) return [];

  // Rulers, roster places and house membership.
  const holders = [...persons.ids, ...orgs.ids];
  await eachChunk(holders, (c) => tx.delete(authorityAssignments).where(inArray(authorityAssignments.holderId, c)));
  await eachChunk(persons.ids, (c) => tx.delete(campaignCharacters).where(inArray(campaignCharacters.personId, c)));
  await eachChunk(orgs.ids, (c) => tx.update(people).set({ houseId: null }).where(inArray(people.houseId, c)));
  // Territories: seats, rulers, marker affiliations; zones and sub-territories just lose the link.
  await eachChunk(lands.ids, async (c) => {
    await tx.delete(territorySeats).where(inArray(territorySeats.territoryId, c));
    await tx.delete(authorityAssignments).where(inArray(authorityAssignments.territoryId, c));
    await tx.delete(markerAffiliations).where(inArray(markerAffiliations.territoryId, c));
    await tx.update(zones).set({ territoryId: null }).where(inArray(zones.territoryId, c));
    await tx.update(territories).set({ parentId: null }).where(inArray(territories.parentId, c));
  });

  await eachChunk(allIds, (c) => tx.delete(markerArticleLinks).where(inArray(markerArticleLinks.articleId, c)));
  await eachChunk(allIds, (c) => tx.delete(articleFolderItems).where(inArray(articleFolderItems.articleId, c)));
  await deleteLooseReferences(tx, allIds);
  // Calendar links to the article would point at nothing.
  const linkEntries: string[] = [];
  for (const c of chunks(allIds)) {
    linkEntries.push(...(await tx.select({ id: calendarEntries.id }).from(calendarEntries).where(and(eq(calendarEntries.kind, "link"), inArray(calendarEntries.articleId, c)))).map((r) => r.id));
  }
  await purgeEntryRows(tx, linkEntries);

  await eachChunk(generic.ids, (c) => tx.delete(articles).where(inArray(articles.id, c)));
  await eachChunk(persons.ids, (c) => tx.delete(people).where(inArray(people.id, c)));
  await eachChunk(orgs.ids, (c) => tx.delete(organizations).where(inArray(organizations.id, c)));
  await eachChunk(lands.ids, (c) => tx.delete(territories).where(inArray(territories.id, c)));
  await deleteDocuments(tx, [...generic.documentIds, ...persons.documentIds, ...orgs.documentIds, ...lands.documentIds]);

  result.purged += allIds.length;
  return [...portraitFiles("article", generic.ids), ...portraitFiles("person", persons.ids), ...portraitFiles("organization", orgs.ids), ...portraitFiles("territory", lands.ids)];
}

async function purgeEntries(tx: Executor, ids: string[], result: PurgeResult) {
  const trashed: string[] = [];
  for (const c of chunks(ids)) {
    trashed.push(...(await tx.select({ id: calendarEntries.id }).from(calendarEntries).where(and(inArray(calendarEntries.id, c), isNotNull(calendarEntries.deletedAt)))).map((r) => r.id));
  }
  await purgeEntryRows(tx, trashed);
  result.purged += trashed.length;
}

/** What still reads its dates in this calendar: a campaign, a season profile or a repeat rule (by name, for the skip reason). */
async function calendarUsers(tx: Executor, id: string): Promise<string[]> {
  const campaignRows = await tx.select({ name: campaigns.name }).from(campaigns).where(eq(campaigns.calendarId, id));
  const profileRows = await tx.select({ name: seasonProfiles.name }).from(seasonProfiles).where(eq(seasonProfiles.calendarId, id));
  // Repeat rules name their calendar inside the JSON; ids are UUIDs, so a substring match is exact enough.
  const ruleRows = await tx.select({ id: calendarEntries.id }).from(calendarEntries).where(sql`instr(${calendarEntries.recurrence}, ${id}) > 0`).limit(1);
  return [
    ...campaignRows.map((r) => `campaign “${r.name}”`),
    ...profileRows.map((r) => `season profile “${r.name}”`),
    ...(ruleRows.length > 0 ? ["repeating calendar entries"] : []),
  ];
}

/**
 * Trashed calendars nothing uses any more; one still used stays in the
 * Trash (skipped, saying by what). Seasons tied to it become shared, sky
 * objects stop listing it, and its definition revisions go with it.
 */
async function purgeCalendars(tx: Executor, ids: string[], result: PurgeResult) {
  const purged: string[] = [];
  for (const id of ids) {
    const [row] = await tx.select({ id: calendars.id, name: calendars.name }).from(calendars).where(and(eq(calendars.id, id), isNotNull(calendars.deletedAt)));
    if (!row) continue;
    const users = await calendarUsers(tx, id);
    if (users.length > 0) {
      result.skipped.push({ ref: { kind: "calendar", id }, reason: `“${row.name}” is still used by ${users.join(", ")}. Switch them to another calendar first.` });
      continue;
    }
    purged.push(id);
  }
  if (purged.length === 0) return;

  await tx.update(seasons).set({ calendarId: null }).where(inArray(seasons.calendarId, purged));
  await tx.update(worldChronology).set({ defaultCalendarId: null }).where(inArray(worldChronology.defaultCalendarId, purged));
  const objects = await tx.select({ id: celestialObjects.id, calendarIds: celestialObjects.calendarIds }).from(celestialObjects).where(isNotNull(celestialObjects.calendarIds));
  for (const o of objects) {
    let list: unknown;
    try {
      list = JSON.parse(o.calendarIds!);
    } catch {
      continue;
    }
    if (!Array.isArray(list) || !list.some((c) => purged.includes(c))) continue;
    await tx.update(celestialObjects).set({ calendarIds: JSON.stringify(list.filter((c) => !purged.includes(c))) }).where(eq(celestialObjects.id, o.id));
  }
  await tx.delete(definitionRevisions).where(and(eq(definitionRevisions.subjectType, "calendar"), inArray(definitionRevisions.subjectId, purged)));
  await deleteLooseReferences(tx, purged);
  await tx.delete(calendars).where(inArray(calendars.id, purged));
  result.purged += purged.length;
}

async function removeFiles(paths: string[]) {
  for (const path of paths) {
    try {
      await rm(path, { recursive: true, force: true });
    } catch (err) {
      console.error(`[trash] couldn't remove ${path}:`, err);
    }
  }
}

/** Permanently deletes trashed items; see the module comment. */
export async function purgeItems(refs: TrashRef[]): Promise<PurgeResult> {
  const result: PurgeResult = { purged: 0, skipped: [] };
  const files = await db.transaction(async (tx) => {
    const mapFiles = await purgeMaps(
      tx,
      refs.filter((r) => r.kind === "map").map((r) => r.id),
      result,
    );
    const portraitPaths = await purgeArticles(tx, refs, result);
    await purgeEntries(
      tx,
      refs.filter((r) => r.kind === "calendarEntry").map((r) => r.id),
      result,
    );
    // After the entries: purging a repeating entry together with its calendar frees the calendar.
    await purgeCalendars(
      tx,
      refs.filter((r) => r.kind === "calendar").map((r) => r.id),
      result,
    );
    return [...mapFiles, ...portraitPaths];
  });
  await removeFiles(files);
  return result;
}
