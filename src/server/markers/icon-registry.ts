/**
 * Stable, app-owned icon keys mapped to a Lucide export name. Stored data
 * (markers.icon_key) references these keys, never a Lucide name directly —
 * if Lucide renames/removes an export, only this file's `lucide` value
 * needs to change, and every saved marker keeps working.
 */
export interface IconDefinition {
  key: string;
  lucide: string;
  label: string;
  group: "Settlements" | "Structures" | "Nature" | "Adventure" | "Services" | "Magic";
  synonyms: string[];
}

export const ICONS: IconDefinition[] = [
  { key: "map-pin", lucide: "MapPin", label: "Point of interest", group: "Adventure", synonyms: ["marker", "pin", "poi"] },
  { key: "house", lucide: "House", label: "Village / home", group: "Settlements", synonyms: ["home", "village", "cottage"] },
  { key: "building-complex", lucide: "Building2", label: "City / dense settlement", group: "Settlements", synonyms: ["city", "town", "metropolis"] },
  { key: "crown", lucide: "Crown", label: "Capital / royal seat", group: "Settlements", synonyms: ["capital", "royal", "throne"] },
  { key: "castle", lucide: "Castle", label: "Castle / fort / stronghold", group: "Structures", synonyms: ["fort", "fortress", "stronghold", "keep"] },
  { key: "tent", lucide: "Tent", label: "Camp / nomad settlement", group: "Settlements", synonyms: ["camp", "nomad", "campsite"] },
  { key: "church", lucide: "Church", label: "Temple / shrine", group: "Structures", synonyms: ["temple", "shrine", "chapel"] },
  { key: "landmark", lucide: "Landmark", label: "Ancient monument / ruins", group: "Adventure", synonyms: ["monument", "ruins", "ancient"] },
  { key: "door-open", lucide: "DoorOpen", label: "Dungeon / cave entrance", group: "Adventure", synonyms: ["dungeon entrance", "cave", "entrance"] },
  { key: "skull", lucide: "Skull", label: "Tomb / dangerous lair", group: "Adventure", synonyms: ["tomb", "lair", "danger", "crypt"] },
  { key: "swords", lucide: "Swords", label: "Battlefield / encounter", group: "Adventure", synonyms: ["battle", "encounter", "fight"] },
  { key: "trees", lucide: "Trees", label: "Forest / sacred grove", group: "Nature", synonyms: ["forest", "grove", "woods"] },
  { key: "mountain", lucide: "Mountain", label: "Mountain / pass", group: "Nature", synonyms: ["peak", "pass", "cliff"] },
  { key: "waves-horizontal", lucide: "Waves", label: "Lake / river / coast", group: "Nature", synonyms: ["lake", "river", "coast", "water"] },
  { key: "anchor", lucide: "Anchor", label: "Port / harbor", group: "Services", synonyms: ["port", "harbor", "dock"] },
  { key: "beer", lucide: "Beer", label: "Inn / tavern", group: "Services", synonyms: ["tavern", "inn", "pub"] },
  { key: "store", lucide: "Store", label: "Market / trading post", group: "Services", synonyms: ["market", "shop", "trade"] },
  { key: "pickaxe", lucide: "Pickaxe", label: "Mine / quarry", group: "Services", synonyms: ["mine", "quarry"] },
  { key: "hammer", lucide: "Hammer", label: "Forge / workshop", group: "Services", synonyms: ["forge", "workshop", "smithy"] },
  { key: "book-open", lucide: "BookOpen", label: "Library / academy", group: "Services", synonyms: ["library", "academy", "school"] },
  { key: "sparkles", lucide: "Sparkles", label: "Magical site / portal", group: "Magic", synonyms: ["magic", "portal", "arcane"] },
  { key: "flame", lucide: "Flame", label: "Volcano / elemental site", group: "Magic", synonyms: ["volcano", "fire", "elemental"] },
  { key: "gem", lucide: "Gem", label: "Treasure / rare resource", group: "Magic", synonyms: ["treasure", "loot", "gem"] },
  { key: "footprints", lucide: "Footprints", label: "Trail / crossing", group: "Adventure", synonyms: ["trail", "path", "crossing"] },
];

export const ICON_KEYS = new Set(ICONS.map((i) => i.key));
export const DEFAULT_ICON_KEY = "map-pin";

export function isValidIconKey(key: string): boolean {
  return ICON_KEYS.has(key);
}

export const COLOR_PRESETS = [
  "#FFFFFF",
  "#9CA3AF",
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#FACC15",
  "#22C55E",
  "#14B8A6",
  "#3B82F6",
  "#A855F7",
  "#EC4899",
  "#000000",
];
export const DEFAULT_COLOR = "#FFFFFF";
export const DEFAULT_BACKGROUND_COLOR = "#141416";
export const DEFAULT_OUTLINE_COLOR = "#0D0E10";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** Normalizes to opaque #RRGGBB — a transparency setting can't hide a marker by accident. */
export function normalizeColor(input: string, fallback: string = DEFAULT_COLOR): string {
  const trimmed = input.trim();
  if (!HEX_COLOR.test(trimmed)) return fallback;
  return trimmed.toUpperCase();
}

export const BACKGROUND_SHAPES = [
  { key: "circle", label: "Circle" },
  { key: "square", label: "Square" },
  { key: "none", label: "None" },
] as const;

export type BackgroundShape = (typeof BACKGROUND_SHAPES)[number]["key"];

const BACKGROUND_SHAPE_KEYS = new Set<string>(BACKGROUND_SHAPES.map((s) => s.key));
export const DEFAULT_BACKGROUND_SHAPE: BackgroundShape = "circle";

export function isValidBackgroundShape(key: string): key is BackgroundShape {
  return BACKGROUND_SHAPE_KEYS.has(key);
}

/**
 * A marker's category is independent of its icon — it defaults to
 * DEFAULT_MARKER_CATEGORY at creation time but is stored on the marker
 * itself thereafter, so changing the icon later never silently changes it.
 */
export const MARKER_CATEGORIES = [
  "Settlement",
  "Fortification",
  "Dungeon",
  "Ruin",
  "Point of Interest",
  "Landmark",
  "Natural Feature",
  "Travel",
  "Religious",
  "Magical",
  "Commerce",
  "Danger",
] as const;
export type MarkerCategory = (typeof MARKER_CATEGORIES)[number];
const MARKER_CATEGORY_SET = new Set<string>(MARKER_CATEGORIES);
export function isValidMarkerCategory(key: string): key is MarkerCategory {
  return MARKER_CATEGORY_SET.has(key);
}
export const DEFAULT_MARKER_CATEGORY: MarkerCategory = "Point of Interest";
