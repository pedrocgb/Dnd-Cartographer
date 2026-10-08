/**
 * Structural calendar changes: impact preview, atomic apply with a
 * restorable revision, and revision restore. Shared time never moves here.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { serverT } from "@/i18n/server";
import { calendarEntries, calendars, celestialObjects, definitionRevisions, seasonProfiles, seasons } from "@/server/db/schema";
import { CalendarError, validateDefinition, type CalendarDefinition, type Problem } from "./engine";
import { calendarImpact, shiftEntryNamed, type Impact } from "./impact";
import { safeJson } from "./parse";
import { chronologyOf, liveEntries, recordRevision, StaleError, toClientCalendar, type CalendarRow } from "./store";
import type { OccurrenceException, Recurrence } from "./recurrence";
import type { CelestialConfig } from "./celestial";
import type { SeasonProfileData } from "./seasons";

export class ReviewError extends CalendarError {
  constructor(
    problem: Problem,
    readonly impact: Impact
  ) {
    super(problem);
  }
}

export class InvalidError extends CalendarError {}

export interface Migration {
  mode: "physical" | "named";
  /** Named mode: entries whose date no longer exists, explicitly kept at their physical day. */
  keepPhysical: string[];
  /** Broken rule/profile/schedule references were shown and accepted (they're kept, not deleted). */
  acknowledgeReferences: boolean;
}

export function parseMigration(v: unknown): Migration | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Record<string, unknown>;
  return {
    mode: m.mode === "named" ? "named" : "physical",
    keepPhysical: Array.isArray(m.keepPhysical) ? m.keepPhysical.filter((x): x is string => typeof x === "string").slice(0, 5000) : [],
    acknowledgeReferences: m.acknowledgeReferences === true,
  };
}

export async function previewImpact(worldId: string, row: CalendarRow, next: CalendarDefinition): Promise<Impact> {
  const prev = safeJson<CalendarDefinition>(row.definition, next);
  const [chronology, entries, profiles, celestial, seasonRows] = await Promise.all([
    chronologyOf(worldId),
    liveEntries(worldId),
    db.select().from(seasonProfiles).where(eq(seasonProfiles.worldId, worldId)),
    db.select().from(celestialObjects).where(eq(celestialObjects.worldId, worldId)),
    db.select({ id: seasons.id, name: seasons.name }).from(seasons).where(eq(seasons.worldId, worldId)),
  ]);
  const seasonNames = new Map(seasonRows.map((s) => [s.id, s.name]));
  const t = await serverT("calendars");
  return calendarImpact({
    calendarId: row.id,
    prev,
    next,
    currentDay: chronology.currentDay,
    entries: entries.map((e) => ({
      id: e.id,
      title: e.title || t(e.kind === "link" ? "views.articleLink" : e.kind === "note" ? "views.note" : "views.event"),
      worldDay: e.worldDay,
      recurrence: safeJson<Recurrence>(e.recurrence, { kind: "none" }),
      exceptions: safeJson<Record<string, OccurrenceException>>(e.exceptions, {}),
    })),
    profiles: profiles.map((p) => ({ id: p.id, name: p.name, calendarId: p.calendarId, data: safeJson<Omit<SeasonProfileData, "calendarId">>(p.data, { mode: "sequential", allowGaps: false, allowOverlaps: false, memberships: [] }) })),
    celestial: celestial.map((c) => ({ id: c.id, name: c.name, config: safeJson<CelestialConfig>(c.config, {}) })),
    seasonName: (id) => seasonNames.get(id) ?? t("default.aSeason"),
  });
}

/**
 * Replaces a calendar's definition. Anything beyond a harmless change needs
 * an explicit `migration` (else ReviewError carries the impact to show).
 * The old definition and every entry value it changes go into one
 * restorable revision, in the same transaction as the change.
 */
export async function applyDefinition(worldId: string, row: CalendarRow, next: CalendarDefinition, migration: Migration | null, extra: Partial<typeof calendars.$inferInsert>) {
  const issues = validateDefinition(next);
  if (issues.length) throw new InvalidError(issues[0].problem);
  const prev = safeJson<CalendarDefinition>(row.definition, next);
  const impact = await previewImpact(worldId, row, next);
  if (!impact.harmless && !migration) throw new ReviewError({ key: "problem.reviewChange" }, impact);
  if (impact.references.length && !migration?.acknowledgeReferences) throw new ReviewError({ key: "problem.reviewReferences" }, impact);

  const named = migration?.mode === "named";
  const unresolved = named ? impact.entries.filter((e) => "error" in e.named && !migration!.keepPhysical.includes(e.id)) : [];
  if (unresolved.length) throw new ReviewError({ key: "problem.unresolved", params: { count: unresolved.length, n: unresolved.length } }, impact);
  if (named && impact.entryCount > impact.entries.length) throw new ReviewError({ key: "problem.tooManyNamed" }, impact);

  return db.transaction(async (tx) => {
    const changedEntries: { id: string; worldDay: number; exceptions: string }[] = [];
    if (named) {
      const ids = new Set(impact.entries.filter((e) => "worldDay" in e.named).map((e) => e.id));
      const rows = await tx.select().from(calendarEntries).where(eq(calendarEntries.worldId, worldId));
      for (const entry of rows.filter((r) => ids.has(r.id))) {
        const shifted = shiftEntryNamed(prev, next, { worldDay: entry.worldDay, exceptions: safeJson(entry.exceptions, {}) });
        changedEntries.push({ id: entry.id, worldDay: entry.worldDay, exceptions: entry.exceptions });
        await tx.update(calendarEntries).set({ worldDay: shifted.worldDay, exceptions: JSON.stringify(shifted.exceptions), updatedAt: new Date() }).where(eq(calendarEntries.id, entry.id));
      }
    }
    await recordRevision(tx, worldId, "calendar", row.id, row.version, { definition: prev, entries: changedEntries }, named ? "Definition change (named dates kept)" : "Definition change");
    const updated = await tx
      .update(calendars)
      .set({ ...extra, definition: JSON.stringify(next), version: row.version + 1, updatedAt: new Date() })
      .where(and(eq(calendars.id, row.id), eq(calendars.version, row.version)))
      .returning();
    if (updated.length === 0) throw new StaleError({ key: "problem.calendarStale" });
    return toClientCalendar(updated[0]);
  });
}

/** Restores a calendar revision as a NEW version (the current one is itself snapshotted first). */
export async function restoreCalendarRevision(worldId: string, row: CalendarRow, revisionId: string) {
  const [revision] = await db
    .select()
    .from(definitionRevisions)
    .where(and(eq(definitionRevisions.id, revisionId), eq(definitionRevisions.worldId, worldId), eq(definitionRevisions.subjectId, row.id)));
  if (!revision) throw new InvalidError({ key: "problem.revisionMissing" });
  const snapshot = safeJson<{ definition: CalendarDefinition; entries?: { id: string; worldDay: number; exceptions: string }[] } | null>(revision.snapshot, null);
  if (!snapshot?.definition) throw new InvalidError({ key: "problem.revisionUnreadable" });

  return db.transaction(async (tx) => {
    const current: { id: string; worldDay: number; exceptions: string }[] = [];
    for (const e of snapshot.entries ?? []) {
      const [live] = await tx.select().from(calendarEntries).where(and(eq(calendarEntries.id, e.id), eq(calendarEntries.worldId, worldId)));
      if (!live) continue;
      current.push({ id: live.id, worldDay: live.worldDay, exceptions: live.exceptions });
      await tx.update(calendarEntries).set({ worldDay: e.worldDay, exceptions: e.exceptions, updatedAt: new Date() }).where(eq(calendarEntries.id, e.id));
    }
    await recordRevision(tx, worldId, "calendar", row.id, row.version, { definition: safeJson(row.definition, null), entries: current }, `Before restoring version ${revision.version}`);
    const updated = await tx
      .update(calendars)
      .set({ definition: JSON.stringify(snapshot.definition), version: row.version + 1, updatedAt: new Date() })
      .where(and(eq(calendars.id, row.id), eq(calendars.version, row.version)))
      .returning();
    if (updated.length === 0) throw new StaleError({ key: "problem.calendarStale" });
    return toClientCalendar(updated[0]);
  });
}
