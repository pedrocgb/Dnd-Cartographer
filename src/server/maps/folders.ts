/**
 * Maps-list folder hierarchy (pure, no DB) — shared by the folder routes
 * and the client tree so both agree on what "inside a folder" means.
 */
export interface FolderNode {
  id: string;
  parentId: string | null;
}

export const MAX_FOLDER_NAME_LENGTH = 80;

/** `folderId` and every folder nested under it, at any depth. */
export function folderSubtree(folders: readonly FolderNode[], folderId: string): Set<string> {
  const ids = new Set([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return ids;
}

/**
 * Why `folderId` can't move under `newParentId`, or null when it can: the
 * parent must exist and not be the folder itself or one of its subfolders.
 */
export function folderMoveError(folders: readonly FolderNode[], folderId: string, newParentId: string | null): "folderUnknownParent" | "folderIntoItself" | null {
  if (newParentId === null) return null;
  if (!folders.some((f) => f.id === newParentId)) return "folderUnknownParent";
  if (folderSubtree(folders, folderId).has(newParentId)) return "folderIntoItself";
  return null;
}

/** A folder color from an untrusted body: "#RRGGBB" (uppercased), null to reset, undefined when invalid. */
export function cleanFolderColor(raw: unknown): string | null | undefined {
  if (raw === null || raw === "") return null;
  return typeof raw === "string" && /^#[0-9a-f]{6}$/i.test(raw) ? raw.toUpperCase() : undefined;
}

/** A trimmed, length-capped folder name, or null when empty. */
export function cleanFolderName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().slice(0, MAX_FOLDER_NAME_LENGTH);
  return name || null;
}
