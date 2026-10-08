/**
 * Strict parsers for session-log JSON coming from clients (pure; relative
 * imports only). Each returns the cleaned value or throws ParseError (a 400).
 * Shape errors only reach malformed requests, so they stay in English; what a
 * user can run into carries a `campaign` Problem. Roster and currency
 * membership are checked against the sets the caller passes in.
 */
import { ParseError } from "../calendars/parse";
import type { Problem } from "../calendars/engine";
import type { MessageKey } from "../../i18n/messages";
import { PARTY, type CoinLine, type Currency, type LootLine, type SessionNotes } from "./types";

const MAX_LINE = 500;
const MAX_LIST = 100;
const MAX_ROWS = 200;
const MAX_AMOUNT = 1_000_000_000;

const fail = (message: string | Problem): never => {
  throw new ParseError(message);
};

/** A `campaign` Problem. */
const problem = (key: MessageKey<"campaign">, params?: Problem["params"]): Problem => ({ ns: "campaign", key, params });

const obj = (v: unknown, what: string): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(`${what} is missing or malformed.`);

const list = (v: unknown, what: string, max: number): unknown[] => {
  if (!Array.isArray(v)) return fail(`${what} must be a list.`);
  if (v.length > max) fail(`${what} can have at most ${max} items.`);
  return v;
};

const ident = (v: unknown, what: string): string => (typeof v === "string" && v.length > 0 && v.length <= 64 ? v : fail(`${what} needs a valid id.`));

const text = (v: unknown, what: string, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : v == null ? "" : fail(`${what} must be text.`));

/** `what` is a Problem for the numbers a user types; the rest are shape errors. */
const int = (v: unknown, what: string | Problem, min: number, max: number): number =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max
    ? (v as number)
    : fail(typeof what === "string" ? `${what} must be a whole number from ${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")}.` : problem("problem.wholeNumber", { what, min, max }));

const recipient = (v: unknown, roster: ReadonlySet<string>): string => (v === PARTY || (typeof v === "string" && roster.has(v)) ? v : fail(problem("problem.recipient")));

/** A campaign's coins: 1–10, unique ids and short names, whole positive values. */
export function parseCurrencies(v: unknown): Currency[] {
  const out = list(v, "Coins", 10).map((c, i): Currency => {
    const x = obj(c, `Coin ${i + 1}`);
    const name = text(x.name, "A coin name", 40);
    if (!name) fail(problem("problem.coinName", { n: i + 1 }));
    return { id: ident(x.id, `Coin ${i + 1}`), name, short: text(x.short, "A coin's short name", 8) || name.slice(0, 3).toLowerCase(), value: int(x.value, problem("problem.what.coinValue", { name }), 1, MAX_AMOUNT) };
  });
  if (out.length === 0) fail(problem("problem.oneCoin"));
  if (new Set(out.map((c) => c.id)).size !== out.length) fail("Two coins share the same id.");
  if (new Set(out.map((c) => c.short.toLowerCase())).size !== out.length) fail(problem("problem.coinShortClash"));
  return out;
}

const lines = (v: unknown, what: string): string[] =>
  list(v ?? [], what, MAX_LIST)
    .map((x) => text(x, what, MAX_LINE))
    .filter(Boolean);

export function parseNotes(v: unknown): SessionNotes {
  const x = obj(v ?? {}, "The session notes");
  // Open threads are quests now (src/server/quests); an old `threads` key is ignored.
  return { events: lines(x.events, "Key events"), decisions: lines(x.decisions, "Decisions"), nextSession: text(x.nextSession, "Next session notes", 4000) };
}

/** PCs who played: roster members only, deduped, in the given order. */
export function parseAttendance(v: unknown, roster: ReadonlySet<string>): string[] {
  const ids = list(v ?? [], "Attendance", MAX_ROWS).map((x) => ident(x, "An attendee"));
  const unknown = ids.find((id) => !roster.has(id));
  if (unknown) fail(problem("problem.attendance"));
  return [...new Set(ids)];
}

export function parseXpTotal(v: unknown): number | null {
  return v === null || v === undefined || v === "" ? null : int(v, problem("problem.what.sessionXp"), 0, MAX_AMOUNT);
}

export function parseXpOverrides(v: unknown, roster: ReadonlySet<string>): Record<string, number> {
  const x = obj(v ?? {}, "XP per character");
  const out: Record<string, number> = {};
  for (const [id, xp] of Object.entries(x)) {
    if (!roster.has(id)) fail(problem("problem.xpRecipient"));
    out[id] = int(xp, problem("problem.what.characterXp"), 0, MAX_AMOUNT);
  }
  return out;
}

export function parseLoot(v: unknown, roster: ReadonlySet<string>, currencies: ReadonlySet<string>): LootLine[] {
  return list(v ?? [], "Loot", MAX_ROWS).map((l, i): LootLine => {
    const x = obj(l, `Loot line ${i + 1}`);
    const articleId = x.articleId == null || x.articleId === "" ? null : ident(x.articleId, "The linked item");
    const template = articleId ? ident(x.template, "The linked item's type") : null;
    const name = text(x.name, "An item name", 120);
    if (!name && !articleId) fail(problem("problem.lootLineName", { n: i + 1 }));
    let value: LootLine["value"] = null;
    if (x.value != null) {
      const y = obj(x.value, "An item's value");
      const currencyId = ident(y.currencyId, "The value's coin");
      if (!currencies.has(currencyId)) fail(problem("problem.itemValueCoin"));
      value = { currencyId, amount: int(y.amount, problem("problem.what.itemValue"), 0, MAX_AMOUNT) };
    }
    return { id: ident(x.id, `Loot line ${i + 1}`), name, template, articleId, quantity: int(x.quantity ?? 1, problem("problem.what.quantity"), 1, 100_000), value, recipient: recipient(x.recipient, roster) };
  });
}

export function parseCoins(v: unknown, roster: ReadonlySet<string>, currencies: ReadonlySet<string>): CoinLine[] {
  return list(v ?? [], "Coins", MAX_ROWS).map((c, i): CoinLine => {
    const x = obj(c, `Coin line ${i + 1}`);
    const currencyId = ident(x.currencyId, "A coin");
    if (!currencies.has(currencyId)) fail(problem("problem.coinLineCoin"));
    const amount = int(x.amount, problem("problem.what.coinAmount"), -MAX_AMOUNT, MAX_AMOUNT);
    if (amount === 0) fail(problem("problem.coinZero"));
    return { id: ident(x.id, `Coin line ${i + 1}`), currencyId, amount, recipient: recipient(x.recipient, roster) };
  });
}

/** Real-life play date: null or a real ISO calendar date (YYYY-MM-DD). */
export function parsePlayedOn(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const m = typeof v === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  if (!m) return fail(problem("problem.playDateFormat"));
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) fail(problem("problem.playDateMissing"));
  return v as string;
}

/** In-world span: both null, or start with an end on/after it (a missing end = one day). */
export function parseDays(start: unknown, end: unknown): { startDay: number | null; endDay: number | null } {
  if (start === null || start === undefined) return { startDay: null, endDay: null };
  const startDay = int(start, "The in-world start", -100_000_000, 100_000_000);
  const endDay = end === null || end === undefined ? startDay : int(end, "The in-world end", -100_000_000, 100_000_000);
  if (endDay < startDay) fail(problem("problem.sessionEndBeforeStart"));
  return { startDay, endDay };
}

export function parseSessionNumber(v: unknown): number {
  return int(v, problem("problem.what.sessionNumber"), 0, 100_000);
}
