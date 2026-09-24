import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { portraitCropPath, portraitKey, portraitOriginalKey, portraitOriginalPath, portraitPath, type PortraitOwnerType } from "./portrait-paths";
import { cropToPixels, MAX_PORTRAIT_BYTES, parsePortraitCrop, type PortraitCrop } from "./portrait-crop";
import { InvalidImageError } from "./validate";
import { receiveImageUpload } from "./receive-upload";

export { InvalidImageError };

const PORTRAIT_SIZE = 512;
/** Enough for a 4× zoom at full portrait resolution, without keeping camera-sized files. */
const ORIGINAL_MAX_SIDE = 2048;

async function exists(file: string): Promise<boolean> {
  return stat(file).then(
    () => true,
    () => false
  );
}

/**
 * Renders the displayed square portrait from the kept original: rotate,
 * cut out the crop, scale to PORTRAIT_SIZE. Without a crop it's a centered
 * cover fit (the pre-crop behavior).
 */
async function renderPortrait(ownerType: PortraitOwnerType, ownerId: string, crop: PortraitCrop | null): Promise<void> {
  // From a buffer, not the path: libvips keeps opened files cached, and on Windows that locks them against delete.
  const original = await readFile(portraitOriginalPath(ownerType, ownerId));
  let image = sharp(original);
  if (crop) {
    const { width = 0, height = 0 } = await sharp(original).metadata();
    const quarter = crop.rotation === 90 || crop.rotation === 270;
    // rotate() then extract() in one pipeline: sharp applies the rotation first.
    image = image.rotate(crop.rotation).extract(cropToPixels(crop, quarter ? height : width, quarter ? width : height));
  }
  await image.resize(PORTRAIT_SIZE, PORTRAIT_SIZE, { fit: "cover" }).webp({ quality: 90 }).toFile(portraitPath(ownerType, ownerId));
  const cropFile = portraitCropPath(ownerType, ownerId);
  if (crop) await writeFile(cropFile, JSON.stringify(crop));
  else await rm(cropFile, { force: true });
}

/**
 * Streams the upload to a temp file and validates it's a real image. Keeps
 * an oriented, size-capped webp of it as the original, then renders the
 * portrait from the chosen crop. A re-upload overwrites the same keys.
 */
export async function processPortraitUpload(
  ownerType: PortraitOwnerType,
  ownerId: string,
  body: ReadableStream<Uint8Array>,
  crop: PortraitCrop | null
): Promise<string> {
  const tempPath = await receiveImageUpload(body, MAX_PORTRAIT_BYTES, "portrait");
  const original = portraitOriginalPath(ownerType, ownerId);
  await mkdir(path.dirname(original), { recursive: true });
  try {
    // rotate() with no angle applies the EXIF orientation — the browser showed the image that way in the crop dialog.
    await sharp(tempPath)
      .rotate()
      .resize(ORIGINAL_MAX_SIDE, ORIGINAL_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 92 })
      .toFile(original);
  } finally {
    await rm(tempPath, { force: true });
  }
  await renderPortrait(ownerType, ownerId, crop);
  return portraitKey(ownerType, ownerId);
}

/**
 * Re-crops the kept original. Portraits uploaded before originals were
 * kept use the displayed portrait itself as the original.
 * Resolves false when there's no image at all.
 */
export async function adjustPortrait(ownerType: PortraitOwnerType, ownerId: string, crop: PortraitCrop): Promise<boolean> {
  const original = portraitOriginalPath(ownerType, ownerId);
  if (!(await exists(original))) {
    const portrait = portraitPath(ownerType, ownerId);
    if (!(await exists(portrait))) return false;
    await mkdir(path.dirname(original), { recursive: true });
    await copyFile(portrait, original);
  }
  await renderPortrait(ownerType, ownerId, crop);
  return true;
}

/** Where the crop dialog loads its source from, and the crop to restore. */
export async function portraitSource(ownerType: PortraitOwnerType, ownerId: string): Promise<{ sourceKey: string | null; crop: PortraitCrop | null }> {
  if (await exists(portraitOriginalPath(ownerType, ownerId))) {
    const saved = await readFile(portraitCropPath(ownerType, ownerId), "utf8").catch(() => null);
    return { sourceKey: portraitOriginalKey(ownerType, ownerId), crop: saved ? parsePortraitCrop(JSON.parse(saved)) : null };
  }
  const hasPortrait = await exists(portraitPath(ownerType, ownerId));
  return { sourceKey: hasPortrait ? portraitKey(ownerType, ownerId) : null, crop: null };
}

export async function deletePortraitFile(ownerType: PortraitOwnerType, ownerId: string): Promise<void> {
  await Promise.all([portraitPath, portraitOriginalPath, portraitCropPath].map((file) => rm(file(ownerType, ownerId), { force: true })));
}
