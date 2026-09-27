/**
 * Session-log arithmetic (pure; relative imports only): XP shares, campaign
 * totals per character and for the party stash.
 */
import { PARTY, type CoinLine, type Currency, type LootLine, type SessionNotes } from "./types";

export interface SessionTotalsInput {
  id: string;
  number: number;
  attendance: string[];
  xpTotal: number | null;
  xpOverrides: Record<string, number>;
  loot: LootLine[];
  coins: CoinLine[];
  notes: SessionNotes;
}

/**
 * XP each attendee gets: overrides are kept as given; what's left of the
 * total (never below 0) is split evenly among the other attendees, the
 * remainder going one each to the first of them in `order` (roster order).
 */
export function xpShares(attendance: readonly string[], xpTotal: number | null, overrides: Readonly<Record<string, number>>, order: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of attendance) if (id in overrides) out[id] = overrides[id];
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const rest = attendance.filter((id) => !(id in overrides)).sort((a, b) => rank(a) - rank(b));
  if (xpTotal === null || rest.length === 0) return out;
  const pool = Math.max(0, xpTotal - Object.values(out).reduce((n, x) => n + x, 0));
  const each = Math.floor(pool / rest.length);
  rest.forEach((id, i) => (out[id] = each + (i < pool % rest.length ? 1 : 0)));
  return out;
}

export interface HolderTotals {
  xp: number;
  /** Net amount per currency id. */
  coins: Record<string, number>;
  /** All coins in the smallest unit. */
  base: number;
  loot: { sessionId: string; sessionNumber: number; line: LootLine }[];
}

const emptyHolder = (): HolderTotals => ({ xp: 0, coins: {}, base: 0, loot: [] });

/** Running totals for every roster member and the party stash (`PARTY`), in session-number order. */
export function campaignTotals(sessions: readonly SessionTotalsInput[], roster: readonly string[], currencies: readonly Currency[]): Record<string, HolderTotals> {
  const out: Record<string, HolderTotals> = { [PARTY]: emptyHolder() };
  for (const id of roster) out[id] = emptyHolder();
  const valueOf = new Map(currencies.map((c) => [c.id, c.value]));
  for (const s of [...sessions].sort((a, b) => a.number - b.number)) {
    for (const [id, xp] of Object.entries(xpShares(s.attendance, s.xpTotal, s.xpOverrides, roster))) (out[id] ??= emptyHolder()).xp += xp;
    for (const c of s.coins) {
      const h = (out[c.recipient] ??= emptyHolder());
      h.coins[c.currencyId] = (h.coins[c.currencyId] ?? 0) + c.amount;
      h.base += c.amount * (valueOf.get(c.currencyId) ?? 0);
    }
    for (const line of s.loot) (out[line.recipient] ??= emptyHolder()).loot.push({ sessionId: s.id, sessionNumber: s.number, line });
  }
  return out;
}

/** `amount` smallest units as the fewest coins, largest first (e.g. 1234 cp as 1 pp 2 gp 3 sp 4 cp). */
export function inCoins(amount: number, currencies: readonly Currency[]): { currency: Currency; count: number }[] {
  const sign = amount < 0 ? -1 : 1;
  let left = Math.abs(amount);
  const out: { currency: Currency; count: number }[] = [];
  for (const c of [...currencies].sort((a, b) => b.value - a.value)) {
    const count = Math.floor(left / c.value);
    if (count > 0) {
      out.push({ currency: c, count: count * sign });
      left -= count * c.value;
    }
  }
  return out;
}

/** The next session number: one after the highest (1 for the first). */
export const nextSessionNumber = (numbers: readonly number[]) => (numbers.length ? Math.max(...numbers) + 1 : 1);
