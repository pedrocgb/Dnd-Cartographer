import { normalizeColor } from "../markers/icon-registry";
import { DEFAULT_MAP_FONT, isMapFontKey, type MapFontKey } from "./fonts";

export const TEXT_ALIGNS = ["left", "center", "right"] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

export const MAX_TEXT_LENGTH = 2000;

/** Style of a map text — everything except its content, position and layer. */
export interface TextStyle {
  rotation: number; // degrees, -180..180
  fontSize: number; // frame pixels
  fontKey: MapFontKey;
  bold: boolean;
  color: string;
  letterSpacing: number; // em
  align: TextAlign;
  curve: number; // -100 (bowl) .. 100 (arch)
  outlineEnabled: boolean;
  outlineColor: string;
  outlineOpacity: number; // 0..1
  outlineWidth: number; // em
  shadowEnabled: boolean;
  shadowAngle: number; // degrees, world direction the shadow falls towards
  shadowDistance: number; // em
  shadowColor: string;
  shadowOpacity: number; // 0..1
}

export interface TextFields extends TextStyle {
  text: string;
  x: number; // center, frame pixels
  y: number;
}

export const LIMITS = {
  letterSpacing: [-0.2, 2],
  curve: [-100, 100],
  outlineWidth: [0, 0.5],
  shadowDistance: [0, 1],
} as const;

export function defaultTextStyle(frameWidth: number, frameHeight: number): TextStyle {
  return {
    rotation: 0,
    fontSize: Math.max(8, Math.round(Math.max(frameWidth, frameHeight) / 60)),
    fontKey: DEFAULT_MAP_FONT,
    bold: false,
    color: "#FFFFFF",
    letterSpacing: 0,
    align: "center",
    curve: 0,
    outlineEnabled: true,
    outlineColor: "#000000",
    outlineOpacity: 0.8,
    outlineWidth: 0.08,
    shadowEnabled: false,
    shadowAngle: 45,
    shadowDistance: 0.08,
    shadowColor: "#000000",
    shadowOpacity: 0.6,
  };
}

/** Maps any angle to -180..180. */
export function normalizeAngle(deg: number): number {
  const a = ((deg % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Validates and clamps the text fields present in `body`, ignoring unknown or
 * invalid ones — the returned object only has keys that were sent and valid.
 */
export function sanitizeTextPatch(body: Record<string, unknown>, frame: { width: number; height: number }): Partial<TextFields> {
  const out: Partial<TextFields> = {};
  if (typeof body.text === "string") out.text = body.text.slice(0, MAX_TEXT_LENGTH);
  const x = num(body.x);
  if (x !== null) out.x = clamp(x, 0, frame.width);
  const y = num(body.y);
  if (y !== null) out.y = clamp(y, 0, frame.height);
  const rotation = num(body.rotation);
  if (rotation !== null) out.rotation = normalizeAngle(rotation);
  const fontSize = num(body.fontSize);
  if (fontSize !== null) out.fontSize = clamp(fontSize, 1, Math.max(frame.width, frame.height));
  if (isMapFontKey(body.fontKey)) out.fontKey = body.fontKey;
  if (typeof body.bold === "boolean") out.bold = body.bold;
  if (typeof body.color === "string") out.color = normalizeColor(body.color, "#FFFFFF");
  const spacing = num(body.letterSpacing);
  if (spacing !== null) out.letterSpacing = clamp(spacing, ...LIMITS.letterSpacing);
  if (typeof body.align === "string" && (TEXT_ALIGNS as readonly string[]).includes(body.align)) out.align = body.align as TextAlign;
  const curve = num(body.curve);
  if (curve !== null) out.curve = clamp(curve, ...LIMITS.curve);
  if (typeof body.outlineEnabled === "boolean") out.outlineEnabled = body.outlineEnabled;
  if (typeof body.outlineColor === "string") out.outlineColor = normalizeColor(body.outlineColor, "#000000");
  const outlineOpacity = num(body.outlineOpacity);
  if (outlineOpacity !== null) out.outlineOpacity = clamp(outlineOpacity, 0, 1);
  const outlineWidth = num(body.outlineWidth);
  if (outlineWidth !== null) out.outlineWidth = clamp(outlineWidth, ...LIMITS.outlineWidth);
  if (typeof body.shadowEnabled === "boolean") out.shadowEnabled = body.shadowEnabled;
  const shadowAngle = num(body.shadowAngle);
  if (shadowAngle !== null) out.shadowAngle = normalizeAngle(shadowAngle);
  const shadowDistance = num(body.shadowDistance);
  if (shadowDistance !== null) out.shadowDistance = clamp(shadowDistance, ...LIMITS.shadowDistance);
  if (typeof body.shadowColor === "string") out.shadowColor = normalizeColor(body.shadowColor, "#000000");
  const shadowOpacity = num(body.shadowOpacity);
  if (shadowOpacity !== null) out.shadowOpacity = clamp(shadowOpacity, 0, 1);
  return out;
}
