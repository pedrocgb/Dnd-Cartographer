/** Session log shapes shared by the server and the UI (pure; relative imports only). */
import { activeT } from "../../i18n/active";
import type { Translator } from "../../i18n/translate";

/** Loot and coins given to the whole party rather than one PC. */
export const PARTY = "party";

/** A campaign coin; `value` is in the campaign's smallest unit (so the smallest coin is 1). */
export interface Currency {
  id: string;
  name: string;
  short: string;
  value: number;
}

export interface SessionNotes {
  events: string[];
  decisions: string[];
  nextSession: string;
}

export interface LootLine {
  id: string;
  /** Shown name; for a linked Item article, its name at the time (the link is what counts). */
  name: string;
  template: string | null;
  articleId: string | null;
  quantity: number;
  /** Value of one, in one of the campaign's coins. */
  value: { currencyId: string; amount: number } | null;
  /** A roster personId, or PARTY. */
  recipient: string;
}

export interface CoinLine {
  id: string;
  currencyId: string;
  /** Negative when spent or lost. */
  amount: number;
  recipient: string;
}

export const EMPTY_NOTES: SessionNotes = { events: [], decisions: [], nextSession: "" };

const D_AND_D_VALUES = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 } as const;

/**
 * The standard D&D coins (copper, silver, electrum, gold, platinum), named in
 * `t`'s language (the active one by default). Once a campaign stores them
 * they are user content.
 */
export function dndCoins(t: Translator<"campaign"> = activeT("campaign")): Currency[] {
  return (Object.keys(D_AND_D_VALUES) as (keyof typeof D_AND_D_VALUES)[]).map((id) => ({ id, name: t(`coin.${id}.name`), short: t(`coin.${id}.short`), value: D_AND_D_VALUES[id] }));
}
