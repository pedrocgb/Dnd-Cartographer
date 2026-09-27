/** Session log shapes shared by the server and the UI (pure; relative imports only). */

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

/** The standard D&D coins: copper, silver, electrum, gold, platinum. */
export const D_AND_D_COINS: Currency[] = [
  { id: "cp", name: "Copper piece", short: "cp", value: 1 },
  { id: "sp", name: "Silver piece", short: "sp", value: 10 },
  { id: "ep", name: "Electrum piece", short: "ep", value: 50 },
  { id: "gp", name: "Gold piece", short: "gp", value: 100 },
  { id: "pp", name: "Platinum piece", short: "pp", value: 1000 },
];
