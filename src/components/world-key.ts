"use client";

/**
 * A browser-storage key for the open world (the root layout puts its id on
 * `<body data-world>`), so what one world remembers (its active campaign,
 * drafts) never shows up in another.
 */
export function worldKey(key: string): string {
  const world = typeof document === "undefined" ? "" : (document.body.dataset.world ?? "");
  return world ? `${key}@${world}` : key;
}
