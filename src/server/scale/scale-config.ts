import { sanitizePosition, type HudPosition } from "../legends/legend-config";
import { formatDecimal } from "../settings/number-format";

/**
 * A map's scale bar, stored as JSON in map_scale_bars.config: the
 * calibration (how many frame pixels one unit is — set by measuring two
 * points on the map) and the bar's look. Pure (relative imports only): the
 * client draws the bar and the measure tool with the same math.
 */

export const SCALE_UNITS = ["km", "m", "mi", "ft", "yd", "leagues", "custom"] as const;
export type ScaleUnit = (typeof SCALE_UNITS)[number];

export const SCALE_UNIT_LABELS: Record<ScaleUnit, string> = {
  km: "Kilometers (km)",
  m: "Meters (m)",
  mi: "Miles (mi)",
  ft: "Feet (ft)",
  yd: "Yards (yd)",
  leagues: "Leagues",
  custom: "Custom unit",
};

const UNIT_SUFFIX: Record<Exclude<ScaleUnit, "custom">, string> = { km: "km", m: "m", mi: "mi", ft: "ft", yd: "yd", leagues: "leagues" };

export const SCALE_STYLES = ["alternating", "double", "ticks", "hollow"] as const;
export type ScaleStyle = (typeof SCALE_STYLES)[number];

export const SCALE_TONES = ["light", "dark"] as const;
export type ScaleTone = (typeof SCALE_TONES)[number];

export const SUBDIVISIONS = [0, 2, 4, 5, 10] as const;

export const SCALE_LIMITS = {
  steps: [1, 10],
  stepValue: [0.001, 1_000_000],
  framePxPerUnit: [1e-6, 1e6],
  labelSize: [9, 20],
  customLabel: 20,
} as const;

export interface ScaleConfig {
  /** Frame pixels per unit; null until calibrated (the bar stays hidden). */
  framePxPerUnit: number | null;
  unit: ScaleUnit;
  customLabel: string;
  /** Distance of one step, in `unit`. */
  stepValue: number;
  steps: number;
  /** Splits the first step into this many ticks (0 = none). */
  subdivideFirst: (typeof SUBDIVISIONS)[number];
  /** Picks a rounder step (1-2-5 series) when zooming makes the bar too short or too long. */
  autoStep: boolean;
  style: ScaleStyle;
  tone: ScaleTone;
  labelSize: number;
  /** A backing plate behind the bar. */
  plate: boolean;
  position: HudPosition;
}

export const DEFAULT_SCALE: ScaleConfig = {
  framePxPerUnit: null,
  unit: "km",
  customLabel: "",
  stepValue: 50,
  steps: 4,
  subdivideFirst: 0,
  autoStep: true,
  style: "alternating",
  tone: "light",
  labelSize: 11,
  plate: true,
  // Bottom-right corner (pushed back into view on screen).
  position: { x: 1, y: 1 },
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** `current` with every valid key of `patch` applied; invalid keys are dropped, numbers clamped. */
export function applyScalePatch(current: ScaleConfig, patch: unknown): ScaleConfig {
  if (!isObject(patch)) return current;
  const next: ScaleConfig = { ...current };
  if (patch.framePxPerUnit === null) next.framePxPerUnit = null;
  const ppu = num(patch.framePxPerUnit);
  if (ppu !== null && ppu > 0) next.framePxPerUnit = clamp(ppu, ...SCALE_LIMITS.framePxPerUnit);
  if (oneOf(SCALE_UNITS, patch.unit)) next.unit = patch.unit;
  if (typeof patch.customLabel === "string") next.customLabel = patch.customLabel.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, SCALE_LIMITS.customLabel);
  const stepValue = num(patch.stepValue);
  if (stepValue !== null && stepValue > 0) next.stepValue = clamp(stepValue, ...SCALE_LIMITS.stepValue);
  const steps = num(patch.steps);
  if (steps !== null) next.steps = Math.round(clamp(steps, ...SCALE_LIMITS.steps));
  if (SUBDIVISIONS.includes(patch.subdivideFirst as (typeof SUBDIVISIONS)[number])) next.subdivideFirst = patch.subdivideFirst as (typeof SUBDIVISIONS)[number];
  if (typeof patch.autoStep === "boolean") next.autoStep = patch.autoStep;
  if (oneOf(SCALE_STYLES, patch.style)) next.style = patch.style;
  if (oneOf(SCALE_TONES, patch.tone)) next.tone = patch.tone;
  const labelSize = num(patch.labelSize);
  if (labelSize !== null) next.labelSize = Math.round(clamp(labelSize, ...SCALE_LIMITS.labelSize));
  if (typeof patch.plate === "boolean") next.plate = patch.plate;
  if ("position" in patch) next.position = sanitizePosition(patch.position, current.position);
  return next;
}

export function parseScaleConfig(json: string): ScaleConfig {
  try {
    return applyScalePatch(DEFAULT_SCALE, JSON.parse(json));
  } catch {
    return DEFAULT_SCALE;
  }
}

/** The unit as shown after a number ("km", "leagues", or the custom label). */
export function unitSuffix(config: Pick<ScaleConfig, "unit" | "customLabel">): string {
  return config.unit === "custom" ? config.customLabel || "units" : UNIT_SUFFIX[config.unit];
}

/** A distance with up to 3 significant digits (no trailing zeros). */
/** About three significant digits (whole numbers kept), in the user's number format. */
export function formatNumber(value: number): string {
  if (value === 0) return "0";
  const digits = Math.min(6, Math.max(0, 2 - Math.floor(Math.log10(Math.abs(value)))));
  return formatDecimal(Number(value.toFixed(digits)), { maximumFractionDigits: digits });
}

export function formatDistance(value: number, config: Pick<ScaleConfig, "unit" | "customLabel">): string {
  return `${formatNumber(value)} ${unitSuffix(config)}`;
}

/** The largest 1-2-5 series value (…, 0.5, 1, 2, 5, 10, 20, …) not above `v`. */
export function niceFloor(v: number): number {
  const exp = Math.floor(Math.log10(v));
  const base = 10 ** exp;
  const f = v / base;
  const m = f >= 5 ? 5 : f >= 2 ? 2 : 1;
  return Number((m * base).toPrecision(12));
}

export interface ScaleBarLayout {
  stepValue: number;
  steps: number;
  /** Screen pixels per step. */
  stepPx: number;
  totalPx: number;
  /** Label at each step edge, "0" first. */
  labels: string[];
}

export const MIN_BAR_PX = 60;

/**
 * The bar for the current zoom (`screenPxPerUnit` = screen pixels one unit
 * spans now): the configured step, or — with autoStep, when that would be
 * shorter than MIN_BAR_PX or longer than `maxPx` — the largest 1-2-5 step
 * that fits. Null when there's nothing sensible to draw.
 */
export function scaleBarLayout(screenPxPerUnit: number, config: Pick<ScaleConfig, "stepValue" | "steps" | "autoStep">, maxPx: number): ScaleBarLayout | null {
  if (!(screenPxPerUnit > 0) || !Number.isFinite(screenPxPerUnit) || !(maxPx > 0)) return null;
  const { steps } = config;
  let stepValue = config.stepValue;
  const total = () => stepValue * steps * screenPxPerUnit;
  if (config.autoStep && (total() > maxPx || total() < MIN_BAR_PX)) {
    stepValue = niceFloor(maxPx / steps / screenPxPerUnit);
  }
  const stepPx = stepValue * screenPxPerUnit;
  if (!(stepPx >= 1)) return null;
  const labels = Array.from({ length: steps + 1 }, (_, i) => formatNumber(Number((stepValue * i).toPrecision(12))));
  return { stepValue, steps, stepPx, totalPx: stepPx * steps, labels };
}
