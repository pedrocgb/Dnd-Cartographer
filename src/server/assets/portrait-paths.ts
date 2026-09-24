import { makeAssetKey, resolveAssetPath } from "../storage/storage-adapter";

export type PortraitOwnerType = "territory" | "person" | "organization" | "article";

/** Always webp, always one fixed key per owner — a re-upload just overwrites it. */
export function portraitKey(ownerType: PortraitOwnerType, ownerId: string): string {
  return makeAssetKey(ownerType, `${ownerId}.webp`);
}

export function portraitPath(ownerType: PortraitOwnerType, ownerId: string): string {
  return resolveAssetPath("portraits", portraitKey(ownerType, ownerId));
}

/** The uploaded image (oriented, size-capped), kept so the crop can be re-adjusted without a re-upload. */
export function portraitOriginalKey(ownerType: PortraitOwnerType, ownerId: string): string {
  return makeAssetKey(ownerType, `originals/${ownerId}.webp`);
}

export function portraitOriginalPath(ownerType: PortraitOwnerType, ownerId: string): string {
  return resolveAssetPath("portraits", portraitOriginalKey(ownerType, ownerId));
}

/** The last crop applied to the original (PortraitCrop JSON). */
export function portraitCropPath(ownerType: PortraitOwnerType, ownerId: string): string {
  return resolveAssetPath("portraits", makeAssetKey(ownerType, `originals/${ownerId}.json`));
}
