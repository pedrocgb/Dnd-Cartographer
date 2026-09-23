import { describe, expect, it } from "vitest";
import { defaultLineStyle, sanitizeLinePatch, sanitizePoints, toClientLine, translatePoints } from "../src/server/lines/line-config";

const frame = { width: 1000, height: 500 };

describe("sanitizeLinePatch", () => {
  it("drops invalid enum/boolean values and unknown keys", () => {
    expect(sanitizeLinePatch({ style: "wavy", cap: "butt", shadowEnabled: "yes", junk: 1 }, frame)).toEqual({});
    expect(sanitizeLinePatch({ style: "dot", cap: "square", shadowEnabled: true }, frame)).toEqual({ style: "dot", cap: "square", shadowEnabled: true });
  });

  it("clamps numbers and normalizes angle/colors", () => {
    expect(
      sanitizeLinePatch({ width: 9999, opacity: -1, dashLength: 0, gapLength: 99, shadowBlur: 9, shadowAngle: 270, color: "bad", shadowColor: "#abcdef" }, frame)
    ).toEqual({ width: 100, opacity: 0, dashLength: 0.5, gapLength: 20, shadowBlur: 5, shadowAngle: -90, color: "#E11D48", shadowColor: "#ABCDEF" });
  });

  it("defaults scale the width with the frame", () => {
    expect(defaultLineStyle(8000, 4000).width).toBe(10);
    expect(defaultLineStyle(100, 100).width).toBe(1);
  });
});

describe("sanitizePoints", () => {
  it("needs at least 2 finite points and clamps them into the frame", () => {
    expect(sanitizePoints("free", [{ x: 1, y: 1 }], frame)).toBeNull();
    expect(sanitizePoints("free", [{ x: 1, y: Number.NaN }, { x: 2, y: 2 }], frame)).toBeNull();
    expect(sanitizePoints("free", [{ x: -10, y: 5, cin: { x: 0, y: 0 } }, { x: 2000, y: 600 }], frame)).toEqual([
      { x: 0, y: 5 },
      { x: 1000, y: 500 },
    ]);
  });

  it("keeps pen handles (even outside the frame) and drops malformed ones", () => {
    const pts = sanitizePoints("pen", [{ x: 10, y: 10, cout: { x: -50, y: 20 } }, { x: 20, y: 20, cin: { x: "a", y: 1 } }], frame);
    expect(pts).toEqual([{ x: 10, y: 10, cout: { x: -50, y: 20 } }, { x: 20, y: 20 }]);
  });
});

describe("translatePoints", () => {
  it("moves points and handles, clamping so the points stay in the frame", () => {
    const moved = translatePoints([{ x: 900, y: 10, cout: { x: 950, y: 0 } }, { x: 950, y: 50 }], 100, -20, frame);
    expect(moved).toEqual([{ x: 950, y: 0, cout: { x: 1000, y: -10 } }, { x: 1000, y: 40 }]);
  });
});

describe("toClientLine", () => {
  it("parses points and tolerates corrupt JSON", () => {
    expect(toClientLine({ id: "a", points: '[{"x":1,"y":2}]' }).points).toEqual([{ x: 1, y: 2 }]);
    expect(toClientLine({ id: "a", points: "{oops" }).points).toEqual([]);
  });
});
