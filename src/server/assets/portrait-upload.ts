import { createWriteStream } from "node:fs";
import { rm, stat, mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import { tempUploadPath } from "./paths";
import { portraitKey, portraitPath, type PortraitOwnerType } from "./portrait-paths";
import { validateImageFile, InvalidImageError } from "./validate";

export { InvalidImageError };

/** Portraits are small display icons, not pannable map art — no reason to allow the same 300 MiB ceiling maps do. */
const MAX_PORTRAIT_BYTES = 25 * 1024 * 1024;
const PORTRAIT_SIZE = 512;

/**
 * Streams the upload to a temp file, validates it's a real image, then
 * resizes/crops it to a fixed square webp (cover fit — fills the frame,
 * cropping any excess rather than letterboxing) and writes it to the
 * owner's fixed portrait path. A re-upload simply overwrites the same key.
 */
export async function processPortraitUpload(
  ownerType: PortraitOwnerType,
  ownerId: string,
  body: ReadableStream<Uint8Array>
): Promise<string> {
  const uploadId = crypto.randomUUID();
  const tempPath = tempUploadPath(uploadId);
  await mkdir(path.dirname(tempPath), { recursive: true });

  await pipeline(Readable.fromWeb(body as never), createWriteStream(tempPath));
  const { size } = await stat(tempPath);

  if (size > MAX_PORTRAIT_BYTES) {
    await rm(tempPath, { force: true });
    throw new InvalidImageError(`File is ${(size / 1024 / 1024).toFixed(1)} MiB, over the ${MAX_PORTRAIT_BYTES / 1024 / 1024} MiB portrait limit.`);
  }

  try {
    await validateImageFile(tempPath, size);
  } catch (err) {
    await rm(tempPath, { force: true });
    throw err;
  }

  const finalPath = portraitPath(ownerType, ownerId);
  await mkdir(path.dirname(finalPath), { recursive: true });
  try {
    await sharp(tempPath)
      .resize(PORTRAIT_SIZE, PORTRAIT_SIZE, { fit: "cover" })
      .webp({ quality: 90 })
      .toFile(finalPath);
  } finally {
    await rm(tempPath, { force: true });
  }

  return portraitKey(ownerType, ownerId);
}

export async function deletePortraitFile(ownerType: PortraitOwnerType, ownerId: string): Promise<void> {
  await rm(portraitPath(ownerType, ownerId), { force: true });
}
