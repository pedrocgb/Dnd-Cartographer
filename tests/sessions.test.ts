import { describe, expect, it } from "vitest";
import { parseAttendance, parseCoins, parseCurrencies, parseDays, parseLoot, parseNotes, parsePlayedOn, parseXpOverrides } from "../src/server/sessions/parse";
import { campaignTotals, inCoins, nextSessionNumber, xpShares, type SessionTotalsInput } from "../src/server/sessions/totals";
import { D_AND_D_COINS, EMPTY_NOTES, PARTY } from "../src/server/sessions/types";

const roster = new Set(["ana", "bo", "cy"]);
const coins = new Set(D_AND_D_COINS.map((c) => c.id));

describe("xp shares", () => {
  it("splits evenly, remainder to the first in roster order", () => {
    expect(xpShares(["cy", "ana", "bo"], 100, {}, ["ana", "bo", "cy"])).toEqual({ ana: 34, bo: 33, cy: 33 });
  });
  it("keeps overrides and splits the rest", () => {
    expect(xpShares(["ana", "bo", "cy"], 100, { ana: 50 }, ["ana", "bo", "cy"])).toEqual({ ana: 50, bo: 25, cy: 25 });
    expect(xpShares(["ana", "bo"], 10, { ana: 50 }, ["ana", "bo"])).toEqual({ ana: 50, bo: 0 });
  });
  it("gives nothing without XP or attendees", () => {
    expect(xpShares(["ana"], null, {}, ["ana"])).toEqual({});
    expect(xpShares([], 100, {}, ["ana"])).toEqual({});
  });
});

describe("campaign totals", () => {
  const session = (over: Partial<SessionTotalsInput>): SessionTotalsInput => ({ id: "s", number: 1, attendance: [], xpTotal: null, xpOverrides: {}, loot: [], coins: [], notes: EMPTY_NOTES, ...over });
  it("adds XP, coins (spending included) and loot per holder", () => {
    const ring = { id: "l1", name: "Ring", template: null, articleId: null, quantity: 1, value: null, recipient: "ana" };
    const totals = campaignTotals(
      [
        session({ id: "s1", number: 1, attendance: ["ana", "bo"], xpTotal: 300, coins: [{ id: "c1", currencyId: "gp", amount: 10, recipient: PARTY }], loot: [ring] }),
        session({ id: "s2", number: 2, attendance: ["ana"], xpTotal: 50, coins: [{ id: "c2", currencyId: "gp", amount: -3, recipient: PARTY }, { id: "c3", currencyId: "sp", amount: 5, recipient: "bo" }] }),
      ],
      ["ana", "bo"],
      D_AND_D_COINS
    );
    expect(totals.ana.xp).toBe(200);
    expect(totals.bo.xp).toBe(150);
    expect(totals[PARTY].coins).toEqual({ gp: 7 });
    expect(totals[PARTY].base).toBe(700);
    expect(totals.bo.base).toBe(50);
    expect(totals.ana.loot.map((l) => [l.sessionNumber, l.line.name])).toEqual([[1, "Ring"]]);
  });
  it("breaks an amount into the fewest coins", () => {
    expect(inCoins(1234, D_AND_D_COINS).map((c) => `${c.count}${c.currency.short}`)).toEqual(["1pp", "2gp", "3sp", "4cp"]);
    expect(inCoins(-150, D_AND_D_COINS).map((c) => `${c.count}${c.currency.short}`)).toEqual(["-1gp", "-1ep"]);
  });
  it("numbers sessions", () => {
    expect([nextSessionNumber([]), nextSessionNumber([1, 4, 2])]).toEqual([1, 5]);
  });
});

describe("session parsers", () => {
  it("validates coins", () => {
    expect(parseCurrencies(D_AND_D_COINS)).toHaveLength(5);
    expect(() => parseCurrencies([])).toThrow(/at least one coin/);
    expect(() => parseCurrencies([{ id: "a", name: "A", short: "x", value: 1 }, { id: "b", name: "B", short: "X", value: 2 }])).toThrow(/short name/);
    expect(() => parseCurrencies([{ id: "a", name: "A", short: "a", value: 0 }])).toThrow(/value/);
  });
  it("checks recipients, coins and roster members", () => {
    expect(() => parseLoot([{ id: "1", name: "Ring", recipient: "zed" }], roster, coins)).toThrow(/party/);
    expect(() => parseCoins([{ id: "1", currencyId: "doubloon", amount: 5, recipient: PARTY }], roster, coins)).toThrow(/coin/);
    expect(() => parseCoins([{ id: "1", currencyId: "gp", amount: 0, recipient: PARTY }], roster, coins)).toThrow(/zero/);
    expect(() => parseAttendance(["ana", "zed"], roster)).toThrow(/party/);
    expect(parseAttendance(["ana", "ana", "bo"], roster)).toEqual(["ana", "bo"]);
    expect(() => parseXpOverrides({ zed: 5 }, roster)).toThrow(/party/);
    expect(parseLoot([{ id: "1", name: " Ring ", recipient: PARTY, value: { currencyId: "gp", amount: 50 } }], roster, coins)[0]).toMatchObject({ name: "Ring", quantity: 1, articleId: null, value: { currencyId: "gp", amount: 50 } });
  });
  it("caps lists, drops empty lines and checks dates", () => {
    expect(() => parseNotes({ events: Array(101).fill("x") })).toThrow(/at most 100/);
    expect(parseNotes({ events: ["  Met the duke ", ""], threads: [{ id: "t", text: "", resolved: false }] })).toEqual({ events: ["Met the duke"], decisions: [], nextSession: "" });
    expect(parsePlayedOn("2026-09-27")).toBe("2026-09-27");
    expect(() => parsePlayedOn("2026-02-30")).toThrow(/exist/);
    expect(() => parsePlayedOn("27/09/2026")).toThrow(/look like/);
    expect(parseDays(5, undefined)).toEqual({ startDay: 5, endDay: 5 });
    expect(() => parseDays(5, 4)).toThrow(/before/);
    expect(parseDays(null, 9)).toEqual({ startDay: null, endDay: null });
  });
});
