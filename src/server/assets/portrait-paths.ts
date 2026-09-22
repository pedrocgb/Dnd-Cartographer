import { makeAssetKey, resolveAssetPath } from "../storage/storage-adapter";

export type PortraitOwnerType = "territory" | "person" | "organization";

/** Always webp, always one fixed key per owner — a re-upload just overwrites it. */
export function portraitKey(ownerType: PortraitOwnerType, ownerId: string): string {
  return makeAssetKey(ownerType, `${ownerId}.webp`);
}

export function portraitPath(ownerType: PortraitOwnerType, ownerId: string): string {
  return resolveAssetPath("portraits", portraitKey(ownerType, ownerId));
}
