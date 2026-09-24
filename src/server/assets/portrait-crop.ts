/**
 * The visible area of an article image, chosen in the crop dialog. Pure
 * data shared by client and server (no sharp / fs imports here).
 *
 * x/y/width/height are percentages (0–100) of the original image *after*
 * `rotation` is applied — the same shape react-easy-crop reports as
 * `croppedArea`, so it restores without drift. Rotation is limited to
 * quarter turns so the rotated bounding box is exact on both sides.
 */
export interface PortraitCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: PortraitRotation;
}

export const PORTRAIT_ROTATIONS = [0, 90, 180, 270] as const;
export type PortraitRotation = (typeof PORTRAIT_ROTATIONS)[number];

/** Portraits are small display images, not pannable map art — no reason to allow the 300 MiB maps do. */
export const MAX_PORTRAIT_BYTES = 25 * 1024 * 1024;
export const PORTRAIT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Rounding slack: the cropper's percentages can overshoot 100 by a hair. */
const EPSILON = 0.01;

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Validates an untrusted crop. Returns null when absent or malformed, so a
 * bad crop falls back to the centered default instead of failing the upload.
 */
export function parsePortraitCrop(raw: unknown): PortraitCrop | null {
  if (!raw || typeof raw !== "object") return null;
  const { x, y, width, height, rotation = 0 } = raw as Record<string, unknown>;
  if (![x, y, width, height].every(isNumber)) return null;
  const [cx, cy, cw, ch] = [x, y, width, height] as number[];
  if (!PORTRAIT_ROTATIONS.includes(rotation as PortraitRotation)) return null;
  if (cx < -EPSILON || cy < -EPSILON || cw <= 0 || ch <= 0) return null;
  if (cx + cw > 100 + EPSILON || cy + ch > 100 + EPSILON) return null;
  return { x: Math.max(0, cx), y: Math.max(0, cy), width: Math.min(100, cw), height: Math.min(100, ch), rotation: rotation as PortraitRotation };
}

/** The crop's pixel rectangle inside a (rotated) image of `width`×`height`, clamped to its bounds. */
export function cropToPixels(crop: PortraitCrop, width: number, height: number) {
  const left = Math.min(width - 1, Math.max(0, Math.round((crop.x / 100) * width)));
  const top = Math.min(height - 1, Math.max(0, Math.round((crop.y / 100) * height)));
  return {
    left,
    top,
    width: Math.max(1, Math.min(width - left, Math.round((crop.width / 100) * width))),
    height: Math.max(1, Math.min(height - top, Math.round((crop.height / 100) * height))),
  };
}

/** Client-side pre-check so an oversized or wrong-type file is refused before the crop dialog opens. */
export function portraitFileError(file: { type: string; size: number }): string | null {
  if (!(PORTRAIT_TYPES as readonly string[]).includes(file.type)) return "Use a PNG, JPEG or WebP image.";
  if (file.size > MAX_PORTRAIT_BYTES) {
    return `The image is ${(file.size / 1024 / 1024).toFixed(1)} MiB, over the ${MAX_PORTRAIT_BYTES / 1024 / 1024} MiB limit.`;
  }
  return null;
}
