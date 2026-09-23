import { parseLayerIds } from "../layers/layer-ids";
// Marker tag systems: Status (multi-select), Environment (single-select),
// and Ownership (single-select). None of these have icons — they're plain
// text labels used for filtering/searching markers.

export const STATUS_TAGS = [
  "Active",
  "Abandoned",
  "Ancient",
  "Buried",
  "Closed",
  "Contested",
  "Corrupted",
  "Cursed",
  "Destroyed",
  "Dormant",
  "Flooded",
  "Fortified",
  "Haunted",
  "Hidden",
  "Hostile",
  "Inhabited",
  "Occupied",
  "Overgrown",
  "Partially ruined",
  "Sealed",
  "Submerged",
  "Under construction",
  "Under siege",
  "Unknown",
  "Unstable",
] as const;

export type StatusTag = (typeof STATUS_TAGS)[number];
const STATUS_TAG_SET = new Set<string>(STATUS_TAGS);
export function isValidStatusTag(value: string): value is StatusTag {
  return STATUS_TAG_SET.has(value);
}

export const ENVIRONMENT_TAGS = [
  "Coastal",
  "Desert",
  "Forest",
  "Frozen",
  "Highland",
  "Jungle",
  "Mountain",
  "Plains",
  "Riverfront",
  "Swamp",
  "Marsh",
  "Underground",
  "Underwater",
  "Aerial",
  "Extraplanar",
  "Urban",
  "Rural",
  "Remote",
  "Roadside",
  "Island",
  "Borderland",
] as const;

export type EnvironmentTag = (typeof ENVIRONMENT_TAGS)[number];
const ENVIRONMENT_TAG_SET = new Set<string>(ENVIRONMENT_TAGS);
export function isValidEnvironmentTag(value: string): value is EnvironmentTag {
  return ENVIRONMENT_TAG_SET.has(value);
}

export const OWNERSHIP_TAGS = [
  "Human",
  "Elf",
  "Dwarf",
  "Orc",
  "Goblin",
  "Gnome",
  "Halfling",
  "Giant",
  "Dragon",
  "Fey",
  "Undead",
  "Fiend",
  "Celestial",
  "Independent",
  "Imperial",
  "Religious",
  "Criminal",
  "Disputed",
  "Unknown",
] as const;

export type OwnershipTag = (typeof OWNERSHIP_TAGS)[number];
const OWNERSHIP_TAG_SET = new Set<string>(OWNERSHIP_TAGS);
export function isValidOwnershipTag(value: string): value is OwnershipTag {
  return OWNERSHIP_TAG_SET.has(value);
}

/** Parses the JSON-encoded statusTags column, tolerating malformed/legacy data. */
export function parseStatusTags(raw: string): StatusTag[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is StatusTag => typeof v === "string" && isValidStatusTag(v));
  } catch {
    return [];
  }
}

/** Validates and JSON-encodes a status tag array for storage. */
export function encodeStatusTags(values: unknown): string {
  if (!Array.isArray(values)) return "[]";
  const valid = values.filter((v): v is StatusTag => typeof v === "string" && isValidStatusTag(v));
  return JSON.stringify(valid);
}

/**
 * Converts a marker DB row's JSON-encoded `statusTags` text column into a
 * real array for API responses, so the client never has to parse JSON
 * itself — every route that returns a marker to the client runs it through
 * this first.
 */
export function toClientMarker<T extends { statusTags: string; extraLayerIds?: string }>(
  row: T
): Omit<T, "statusTags" | "extraLayerIds"> & { statusTags: StatusTag[]; extraLayerIds: string[] } {
  return { ...row, statusTags: parseStatusTags(row.statusTags), extraLayerIds: parseLayerIds(row.extraLayerIds) };
}
