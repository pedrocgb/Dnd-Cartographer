/**
 * Session-log persistence: campaigns, their party roster and sessions, and
 * the client shapes they're served as. Routes validate with ./parse first.
 */
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaignCharacters, campaigns, people, sessions } from "@/server/db/schema";
import { safeJson } from "@/server/calendars/parse";
import { parseInfo } from "@/server/articles/info-fields";
import type { QuestLogLine } from "@/server/quests/types";
import { normalizeLogLine } from "@/server/quests/logic";
import { EMPTY_NOTES, type CoinLine, type Currency, type LootLine, type SessionNotes } from "./types";

export type CampaignRow = typeof campaigns.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;

export async function campaignOf(worldId: string, id: string) {
  const [row] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.worldId, worldId)));
  return row ?? null;
}

export async function sessionOf(worldId: string, id: string) {
  const [row] = await db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.worldId, worldId), isNull(sessions.deletedAt)));
  return row ?? null;
}

/** A player character's Controlling Player (its required info field), or "". */
const controllingPlayer = (info: string | null) => {
  const value = info ? parseInfo(info).controllingPlayer : null;
  return typeof value === "string" ? value : "";
};

/**
 * A campaign's party, in roster order, with each character's current name,
 * portrait and player (its article's Controlling Player); null name = the
 * article was deleted.
 */
export async function rosterOf(campaignId: string) {
  const rows = await db
    .select({ member: campaignCharacters, name: people.name, portraitKey: people.portraitKey, info: people.info, deletedAt: people.deletedAt })
    .from(campaignCharacters)
    .leftJoin(people, eq(people.id, campaignCharacters.personId))
    .where(eq(campaignCharacters.campaignId, campaignId))
    .orderBy(asc(campaignCharacters.sortOrder), asc(campaignCharacters.createdAt));
  return rows.map((r) => ({
    id: r.member.id,
    personId: r.member.personId,
    playerName: r.deletedAt ? "" : controllingPlayer(r.info),
    status: r.member.status,
    name: r.deletedAt ? null : r.name,
    portraitKey: r.deletedAt ? null : r.portraitKey,
  }));
}

export type ClientRosterMember = Awaited<ReturnType<typeof rosterOf>>[number];

export const toClientCampaign = (row: CampaignRow, roster: ClientRosterMember[]) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  calendarId: row.calendarId,
  currencies: safeJson<Currency[]>(row.currencies, []),
  status: row.status,
  archived: row.archivedAt !== null,
  roster,
});

/** The session notes, without keys from older shapes (e.g. `threads`, now quests). */
const notesOf = (raw: string): SessionNotes => {
  const x = { ...EMPTY_NOTES, ...safeJson<Partial<SessionNotes>>(raw, {}) };
  return { events: x.events, decisions: x.decisions, nextSession: x.nextSession };
};

export const toClientSession = (row: SessionRow) => ({
  id: row.id,
  campaignId: row.campaignId,
  number: row.number,
  title: row.title,
  playedOn: row.playedOn,
  startDay: row.startDay,
  endDay: row.endDay,
  recapDocumentId: row.recapDocumentId,
  notes: notesOf(row.notes),
  articleLinks: safeJson<{ template: string; articleId: string }[]>(row.articleLinks, []),
  attendance: safeJson<string[]>(row.attendance, []),
  xpTotal: row.xpTotal,
  xpOverrides: safeJson<Record<string, number>>(row.xpOverrides, {}),
  loot: safeJson<LootLine[]>(row.loot, []),
  coins: safeJson<CoinLine[]>(row.coins, []),
  questLog: safeJson<QuestLogLine[]>(row.questLog, []).map(normalizeLogLine),
  version: row.version,
});

export type ClientSession = ReturnType<typeof toClientSession>;

/** Live sessions of a campaign, by number. */
export async function sessionsOf(campaignId: string) {
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.campaignId, campaignId), isNull(sessions.deletedAt)))
    .orderBy(asc(sessions.number));
  return rows.map(toClientSession);
}

/** Sessions of the campaign that give this character anything (attendance, XP, loot, coins). */
export function sessionsUsingPerson(list: ClientSession[], personId: string) {
  return list.filter((s) => s.attendance.includes(personId) || personId in s.xpOverrides || s.loot.some((l) => l.recipient === personId) || s.coins.some((c) => c.recipient === personId));
}

/** Sessions of the campaign that use one of these coins (coin lines or item values). */
export function sessionsUsingCurrency(list: ClientSession[], currencyIds: ReadonlySet<string>) {
  return list.filter((s) => s.coins.some((c) => currencyIds.has(c.currencyId)) || s.loot.some((l) => l.value && currencyIds.has(l.value.currencyId)));
}
