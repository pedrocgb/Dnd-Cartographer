import sharp from "sharp";

export const LIMITS = {
  maxBytes: 300 * 1024 * 1024, // 300 MiB
  maxDimension: 20_000,
  maxPixels: 120_000_000, // headroom above the confirmed 7,680x4,320 (~33.2M) benchmark
};

const ALLOWED_FORMATS = new Set(["png", "jpeg", "webp"]);

export class InvalidImageError extends Error {}

export interface ValidatedImage {
  format: string;
  width: number;
  height: number;
  extension: string;
}

export async function validateImageFile(filePath: string, byteSize: number): Promise<ValidatedImage> {
  if (byteSize <= 0) {
    throw new InvalidImageError("Empty upload.");
  }
  if (byteSize > LIMITS.maxBytes) {
    throw new InvalidImageError(
      `File is ${(byteSize / 1024 / 1024).toFixed(1)} MiB, over the ${LIMITS.maxBytes / 1024 / 1024} MiB limit.`
    );
  }

  let metadata;
  try {
    metadata = await sharp(filePath, { limitInputPixels: LIMITS.maxPixels }).metadata();
  } catch {
    throw new InvalidImageError("File is not a readable PNG, JPEG, or WebP image.");
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new InvalidImageError(
      `Unsupported image format: ${metadata.format ?? "unknown"}. Accepted: PNG, JPEG, WebP.`
    );
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new InvalidImageError("Animated images are not supported.");
  }
  if (!metadata.width || !metadata.height) {
    throw new InvalidImageError("Could not determine image dimensions.");
  }
  if (metadata.width > LIMITS.maxDimension || metadata.height > LIMITS.maxDimension) {
    throw new InvalidImageError(
      `Image dimensions ${metadata.width}x${metadata.height} exceed the ${LIMITS.maxDimension}px limit per side.`
    );
  }
  const pixels = metadata.width * metadata.height;
  if (pixels > LIMITS.maxPixels) {
    throw new InvalidImageError(`Image has ${pixels.toLocaleString()} pixels, over the configured limit.`);
  }

  const extension = metadata.format === "jpeg" ? ".jpg" : `.${metadata.format}`;
  return { format: metadata.format, width: metadata.width, height: metadata.height, extension };
}
