// Hierarchy profiles, territory-type catalog, and pure validation helpers.
// Kept dependency-free of the DB so both server routes and tests can call
// these functions directly against plain objects.

/** A suggested territory type + title, purely for the creation picker. */
export interface TerritoryTypeCatalogEntry {
  type: string;
  suggestedTitle: string;
  placementGuidance: string;
}

export const TERRITORY_TYPE_CATALOG: TerritoryTypeCatalogEntry[] = [
  { type: "Empire", suggestedTitle: "Emperor / Empress", placementGuidance: "Optional superior realm." },
  { type: "Kingdom", suggestedTitle: "King / Queen", placementGuidance: "Default realm." },
  { type: "Duchy", suggestedTitle: "Duke / Duchess", placementGuidance: "Required default regional level." },
  { type: "County", suggestedTitle: "Count / Countess; Earl as an alternative", placementGuidance: "Required default local level." },
  { type: "Barony", suggestedTitle: "Baron / Baroness", placementGuidance: "Optional subdivision." },
  { type: "Lordship / Seigneury", suggestedTitle: "Lord / Lady; Seigneur", placementGuidance: "Configure jurisdiction and position." },
  { type: "Manor", suggestedTitle: "Lord / Lady of the manor", placementGuidance: "Estate, distinct from manor house or village; not a compulsory tier." },
  { type: "Viscounty", suggestedTitle: "Viscount / Viscountess", placementGuidance: "Optional territorial office." },
  { type: "March / Margraviate", suggestedTitle: "Margrave / Margravine; Marcher Lord", placementGuidance: "Optional frontier jurisdiction." },
  { type: "Marquessate / Marquisate", suggestedTitle: "Marquess / Marchioness", placementGuidance: "Optional type; not a compulsory intermediate tier." },
  { type: "Principality", suggestedTitle: "Prince / Princess", placementGuidance: "Independent or subordinate under an explicit profile." },
  { type: "Grand Duchy", suggestedTitle: "Grand Duke / Grand Duchess", placementGuidance: "Alternative realm type." },
  { type: "Palatinate / County Palatine", suggestedTitle: "Count Palatine or custom", placementGuidance: "Special authority/autonomy." },
  { type: "Royal Domain / Crownlands", suggestedTitle: "Monarch / Administrator", placementGuidance: "Requires explicit rules for direct administration." },
  { type: "Province / Governorate", suggestedTitle: "Governor", placementGuidance: "Administrative hierarchy option." },
  { type: "Shire", suggestedTitle: "Custom / Sheriff for administration", placementGuidance: "Alternative county label, not an extra default tier." },
  { type: "District / Bailiwick", suggestedTitle: "Administrator / Bailiff", placementGuidance: "Optional administrative subdivision." },
  { type: "City-State", suggestedTitle: "Ruler / Council", placementGuidance: "Political record linked to the city." },
  { type: "Free Imperial City", suggestedTitle: "Civic authority", placementGuidance: "Explicit direct imperial branch." },
  { type: "Prince-Bishopric", suggestedTitle: "Prince-Bishop", placementGuidance: "Temporal jurisdiction, distinct from a spiritual diocese." },
  { type: "Abbey Lordship", suggestedTitle: "Abbot / Abbess", placementGuidance: "Religious institutional lordship." },
  { type: "Chiefdom / Clan Territory", suggestedTitle: "Chief / Custom", placementGuidance: "Configured cultural hierarchy." },
  { type: "Emirate", suggestedTitle: "Emir", placementGuidance: "Cultural territory type." },
  { type: "Sultanate", suggestedTitle: "Sultan", placementGuidance: "Cultural realm type." },
  { type: "Khanate", suggestedTitle: "Khan", placementGuidance: "Cultural realm type." },
  { type: "Enclave", suggestedTitle: "Custom", placementGuidance: "Custom setting label; no constitution implied by the name." },
  { type: "Citadel", suggestedTitle: "Custom", placementGuidance: "Custom setting label; no constitution implied by the name." },
  { type: "Clan", suggestedTitle: "Custom", placementGuidance: "Custom setting label; no constitution implied by the name." },
  { type: "Republic", suggestedTitle: "Custom", placementGuidance: "Custom setting label; no constitution implied by the name." },
  { type: "Bossdom", suggestedTitle: "Custom", placementGuidance: "Custom setting label; no constitution implied by the name." },
  { type: "Custom", suggestedTitle: "Custom", placementGuidance: "Configured labels and relationships." },
];

// A territory's government form (older free-form values are kept until edited).
export const GOVERNMENT_FORMS = [
  "Monarchy",
  "Republic",
  "Oligarchy",
  "Theocracy",
  "Tribal Government",
  "Military Government",
  "Confederation",
  "Other",
] as const;

/** Organization types (the `organizations.kind` column), in Organizations-folder order. */
export const ORGANIZATION_KINDS = [
  "Noble House",
  "Guild",
  "Council",
  "Military Order",
  "Religious Order",
  "Clan",
  "Company",
  "Academy",
  "Criminal Organization",
  "Secret Society",
  "Other",
] as const;
export const PERSON_STATUSES = ["Alive", "Deceased", "Missing", "Unknown"] as const;
export const AUTHORITY_ROLES = [
  "Ruler",
  "Co-Ruler",
  "Regent",
  "Council Member",
  "Council Head",
  "Steward",
  "Claimant",
  "Advisor",
  "Chancellor",
  "Treasurer",
  "Chamberlain",
  "Marshal",
  "Justiciar",
  "Bishop",
  "Custom",
] as const;

/**
 * One rung of a hierarchy profile. `allowedParentTypes` lists territory
 * *types* (plain catalog strings, not profile-scoped ids) that may be this
 * level's parent — an empty list means "root only". A territory's own
 * `hierarchyProfileId` decides which profile's levels govern IT, so
 * validating "can P be C's parent" always consults C's own profile: this
 * is what lets a subordinate kingdom configure its own internal
 * subdivisions independently of its parent empire's profile.
 */
export interface HierarchyLevel {
  type: string;
  canBeRoot: boolean;
  required: boolean;
  attachable: boolean;
  allowedParentTypes: string[];
}

export const DEFAULT_HIERARCHY_LEVELS: HierarchyLevel[] = [
  { type: "Empire", canBeRoot: true, required: false, attachable: false, allowedParentTypes: [] },
  { type: "Kingdom", canBeRoot: true, required: true, attachable: false, allowedParentTypes: ["Empire"] },
  { type: "Duchy", canBeRoot: false, required: true, attachable: false, allowedParentTypes: ["Kingdom"] },
  { type: "County", canBeRoot: false, required: true, attachable: true, allowedParentTypes: ["Duchy"] },
  { type: "Barony", canBeRoot: false, required: false, attachable: true, allowedParentTypes: ["County"] },
];

export const DEFAULT_PROFILE_NAME = "Default";

export function parseHierarchyLevels(raw: string): HierarchyLevel[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is HierarchyLevel =>
        l &&
        typeof l.type === "string" &&
        typeof l.canBeRoot === "boolean" &&
        typeof l.required === "boolean" &&
        typeof l.attachable === "boolean" &&
        Array.isArray(l.allowedParentTypes)
    );
  } catch {
    return [];
  }
}

export function encodeHierarchyLevels(levels: HierarchyLevel[]): string {
  return JSON.stringify(levels);
}

export interface TerritoryLike {
  id: string;
  type: string;
  parentId: string | null;
  hierarchyProfileId: string;
}

/** Is `type` allowed to be a root under the given profile? */
export function isValidRootType(type: string, levels: HierarchyLevel[]): boolean {
  return levels.some((l) => l.type === type && l.canBeRoot);
}

/** Is `parentType` an allowed parent for a territory of `childType`, per the child's own profile? */
export function isValidParentType(parentType: string, childType: string, childLevels: HierarchyLevel[]): boolean {
  const level = childLevels.find((l) => l.type === childType);
  if (!level) return true; // custom/unrecognized type not on the profile's ladder — not constrained
  return level.allowedParentTypes.includes(parentType);
}

/** Can a marker attach directly to a territory of this type, per its profile? */
export function isAttachableType(type: string, levels: HierarchyLevel[]): boolean {
  const level = levels.find((l) => l.type === type);
  return level ? level.attachable : true; // types outside the ladder (custom) are attachable by default
}

/** Type names this profile marks as required for a "complete" affiliation. */
export function requiredTypes(levels: HierarchyLevel[]): string[] {
  return levels.filter((l) => l.required).map((l) => l.type);
}

export interface ChainValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates an entire root-to-leaf chain of territories (each with its own
 * profile's levels resolved), checking: no cycles, valid root type, and
 * each parent/child edge permitted by the child's own profile.
 */
export function validateChain(
  chain: TerritoryLike[],
  levelsByProfileId: Map<string, HierarchyLevel[]>
): ChainValidationResult {
  const seen = new Set<string>();
  for (const t of chain) {
    if (seen.has(t.id)) return { valid: false, error: `Cycle detected at territory ${t.id}.` };
    seen.add(t.id);
  }
  if (chain.length === 0) return { valid: true };

  const root = chain[0];
  const rootLevels = levelsByProfileId.get(root.hierarchyProfileId) ?? [];
  if (!isValidRootType(root.type, rootLevels)) {
    return { valid: false, error: `"${root.type}" is not a permitted root type for its hierarchy profile.` };
  }

  for (let i = 1; i < chain.length; i++) {
    const parent = chain[i - 1];
    const child = chain[i];
    const childLevels = levelsByProfileId.get(child.hierarchyProfileId) ?? [];
    if (!isValidParentType(parent.type, child.type, childLevels)) {
      return {
        valid: false,
        error: `"${child.type}" cannot have a parent of type "${parent.type}" under its hierarchy profile.`,
      };
    }
  }
  return { valid: true };
}

/** Which required types (per the leaf's own profile-derived chain) are missing from a chain. */
export function computeMissingRequiredTypes(chain: TerritoryLike[], levelsByProfileId: Map<string, HierarchyLevel[]>): string[] {
  const presentTypes = new Set(chain.map((t) => t.type));
  const missing = new Set<string>();
  for (const t of chain) {
    const levels = levelsByProfileId.get(t.hierarchyProfileId) ?? [];
    for (const required of requiredTypes(levels)) {
      if (!presentTypes.has(required)) missing.add(required);
    }
  }
  return Array.from(missing);
}
