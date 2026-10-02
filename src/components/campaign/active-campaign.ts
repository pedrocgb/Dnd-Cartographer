"use client";

/**
 * The campaign the Campaign area (Sessions, Writer) works on: shared by its
 * tabs through the `?campaign=` address parameter, and remembered per
 * browser so opening a tab without one lands on the last campaign used.
 */

import { worldKey } from "@/components/world-key";

/** Per world: each world remembers its own last campaign. */
const STORAGE_KEY = "active-campaign";
/** Window event fired when campaigns are created, renamed or archived (the header's picker reloads). */
export const CAMPAIGNS_CHANGED = "campaigns-changed";

export function readActiveCampaign(): string | null {
  try {
    return window.localStorage.getItem(worldKey(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function rememberActiveCampaign(id: string | null) {
  try {
    if (id) window.localStorage.setItem(worldKey(STORAGE_KEY), id);
  } catch {
    // storage unavailable: the address still carries it
  }
}

export function announceCampaignsChanged() {
  window.dispatchEvent(new Event(CAMPAIGNS_CHANGED));
}
