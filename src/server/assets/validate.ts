import sharp from "sharp";
import { translate, type TranslateParams } from "../../i18n/translate";
import type { MessageKey } from "../../i18n/messages";

export const LIMITS = {
  maxBytes: 300 * 1024 * 1024, // 300 MiB
  maxDimension: 20_000,
  maxPixels: 120_000_000, // headroom above the confirmed 7,680x4,320 (~33.2M) benchmark
};

const ALLOWED_FORMATS = new Set(["png", "jpeg", "webp"]);

/** A rejected upload. `key`/`params` word it for the user (errors namespace); `message` is the en-US text, for logs. */
export class InvalidImageError extends Error {
  constructor(
    readonly key: MessageKey<"errors">,
    readonly params?: TranslateParams,
  ) {
    super(translate("en-US", "errors", key, params));
  }
}

const mib = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;

export interface ValidatedImage {
  format: string;
  width: number;
  height: number;
  extension: string;
}

export async function validateImageFile(filePath: string, byteSize: number): Promise<ValidatedImage> {
  if (byteSize <= 0) {
    throw new InvalidImageError("imageEmpty");
  }
  if (byteSize > LIMITS.maxBytes) {
    throw new InvalidImageError("imageTooLarge", { size: mib(byteSize), max: mib(LIMITS.maxBytes) });
  }

  let metadata;
  try {
    metadata = await sharp(filePath, { limitInputPixels: LIMITS.maxPixels }).metadata();
  } catch {
    throw new InvalidImageError("imageUnreadable");
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new InvalidImageError("imageFormat", { format: metadata.format ?? "?" });
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new InvalidImageError("imageAnimated");
  }
  if (!metadata.width || !metadata.height) {
    throw new InvalidImageError("imageNoDimensions");
  }
  if (metadata.width > LIMITS.maxDimension || metadata.height > LIMITS.maxDimension) {
    throw new InvalidImageError("imageTooWide", { width: String(metadata.width), height: String(metadata.height), max: LIMITS.maxDimension });
  }
  const pixels = metadata.width * metadata.height;
  if (pixels > LIMITS.maxPixels) {
    throw new InvalidImageError("imageTooManyPixels", { pixels });
  }

  const extension = metadata.format === "jpeg" ? ".jpg" : `.${metadata.format}`;
  return { format: metadata.format, width: metadata.width, height: metadata.height, extension };
}
