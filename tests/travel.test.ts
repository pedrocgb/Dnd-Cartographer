import { describe, it, expect } from "vitest";
import { baseMph, DEFAULT_TRAVEL, formatDuration, planTravel, type TravelSettings } from "../src/server/travel/travel";

const s = (patch: Partial<TravelSettings>): TravelSettings => ({ ...DEFAULT_TRAVEL, ...patch });

describe("travel", () => {
  it("uses the 5e pace table on foot: 24 miles a day at a normal pace", () => {
    const plan = planTravel(48, s({}))!;
    expect(plan.milesPerDay).toBe(24);
    expect(plan).toMatchObject({ fullDays: 2, extraHours: 0, daysOnRoad: 2 });
    expect(plan.foodKg).toBeCloseTo(8 * 0.4536);
    expect(plan.waterL).toBeCloseTo(8 * 3.785);
    expect(planTravel(30, s({ pace: "fast" }))!.milesPerDay).toBe(32);
    expect(planTravel(18, s({ pace: "slow" }))!.totalHours).toBe(9);
  });

  it("a horse moves at the party's pace unless the creature-speed houserule is on", () => {
    expect(baseMph(s({ mode: "riding-horse" }))).toBe(3);
    expect(baseMph(s({ mode: "riding-horse", useCreatureSpeed: true }))).toBe(6);
  });

  it("a gallop covers twice the fast pace for one hour", () => {
    expect(planTravel(100, s({ mode: "riding-horse", gallop: true }))!.milesPerDay).toBe(3 * 7 + 8);
  });

  it("difficult terrain halves speed over its share", () => {
    expect(planTravel(24, s({ difficultShare: 1 }))!.totalHours).toBe(16);
    expect(planTravel(24, s({ mode: "galley", difficultShare: 1, hoursPerDay: 24 }))!.mph).toBe(4);
  });

  it("ships add the current and hot weather doubles water", () => {
    expect(baseMph(s({ mode: "keelboat", currentMph: 3 }))).toBe(4);
    expect(planTravel(24, s({ hotWeather: true, partySize: 3 }))!.waterL).toBeCloseTo(6 * 3.785);
  });

  it("formats durations", () => {
    expect(formatDuration(2, 5)).toBe("2 days 5 h");
    expect(formatDuration(0, 1.5)).toBe("1 h 30 min");
    expect(formatDuration(0, 0)).toBe("0 min");
  });
});
