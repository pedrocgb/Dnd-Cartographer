import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { resolveAssetPath } from "../storage/storage-adapter";
import { receiveImageUpload } from "./receive-upload";

const MAX_ARTICLE_IMAGE_BYTES = 25 * 1024 * 1024;
/** Longest side kept; larger images are scaled down (never up). */
const MAX_SIDE = 2000;

/** `<uuid>.webp` — one immutable file per upload. */
export function articleImagePath(key: string): string {
  return resolveAssetPath("articleImages", key);
}

/**
 * Streams the upload to a temp file, validates it, and stores it as a webp
 * scaled to fit inside MAX_SIDE (aspect ratio kept, no cropping). Resolves
 * the new key; keys are never reused, so the file can be cached forever.
 */
export async function processArticleImageUpload(body: ReadableStream<Uint8Array>): Promise<string> {
  const tempPath = await receiveImageUpload(body, MAX_ARTICLE_IMAGE_BYTES, "image");
  const key = `${crypto.randomUUID()}.webp`;
  const finalPath = articleImagePath(key);
  await mkdir(path.dirname(finalPath), { recursive: true });
  try {
    await sharp(tempPath)
      .rotate() // honor EXIF orientation from phone photos
      .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toFile(finalPath);
  } finally {
    await rm(tempPath, { force: true });
  }
  return key;
}
