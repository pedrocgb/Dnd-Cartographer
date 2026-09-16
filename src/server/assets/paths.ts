import { makeAssetKey, resolveAssetPath } from "../storage/storage-adapter";

/**
 * Every asset generation gets its own tile/thumbnail output directory so a
 * replacement upload can never overwrite a still-referenced version, and a
 * stale (superseded) processing job can't clobber the current one.
 */
function generationDir(assetId: string, generation: number): string {
  return `${assetId}/g${generation}`;
}

export function originalKey(assetId: string, extension: string): string {
  return makeAssetKey(assetId, `original${extension}`);
}

export function originalPath(assetId: string, extension: string): string {
  return resolveAssetPath("originals", originalKey(assetId, extension));
}

export function tilesDzKey(assetId: string, generation: number): string {
  return `${generationDir(assetId, generation)}/manifest.dzi`;
}

export function tilesDir(assetId: string, generation: number): string {
  return resolveAssetPath("tiles", generationDir(assetId, generation));
}

export function tilesBasenamePath(assetId: string, generation: number): string {
  return resolveAssetPath("tiles", `${generationDir(assetId, generation)}/manifest`);
}

export function thumbnailKey(assetId: string, generation: number): string {
  return `${generationDir(assetId, generation)}/thumbnail.webp`;
}

export function thumbnailPath(assetId: string, generation: number): string {
  return resolveAssetPath("thumbnails", thumbnailKey(assetId, generation));
}

export function tempUploadPath(uploadId: string): string {
  return resolveAssetPath("temp", uploadId);
}
