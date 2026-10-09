import { weightedPick, type Rng } from "../random";

/** A settlement name and the themes it suits (geographies, climates, purposes…), lower case. */
export interface SettlementName {
  name: string;
  tags: readonly string[];
}

/** Stand-in pool until the tagged name list is imported. */
export const PLACEHOLDER_NAMES: readonly SettlementName[] = [
  { name: "Saltmere", tags: ["coast", "fishing", "port"] },
  { name: "Gullhaven", tags: ["coast", "island", "port"] },
  { name: "Ironhollow", tags: ["mountains", "hills", "mining"] },
  { name: "Greyspire", tags: ["mountains", "military"] },
  { name: "Millford", tags: ["riverbank", "farming", "crafting"] },
  { name: "Reedwater", tags: ["swamp", "river delta", "fishing"] },
  { name: "Thornwood", tags: ["forest", "logging", "hunting"] },
  { name: "Sunwell", tags: ["oasis", "desert", "arid", "trade"] },
  { name: "Frosthold", tags: ["tundra", "polar", "hunting"] },
  { name: "Ashfall", tags: ["volcanic", "mining"] },
  { name: "Deepdelve", tags: ["underground", "mining"] },
  { name: "Brightmeadow", tags: ["plains", "valley", "farming", "peaceful"] },
  { name: "Windrest", tags: ["steppe", "plains", "herding"] },
  { name: "Stillwater", tags: ["lake shore", "fishing", "peaceful"] },
  { name: "Redcliff", tags: ["canyon", "hills"] },
  { name: "Kingsbridge", tags: ["riverbank", "trade", "administrative"] },
];

/** How much more likely a name is for each of its tags that matches the settlement. */
const MATCH_BONUS = 3;

/** Picks a name, favoring those whose tags match the settlement's themes; any name can still come up. */
export function pickName(pool: readonly SettlementName[], themes: readonly string[], rng: Rng): string {
  const wanted = new Set(themes.map((t) => t.toLowerCase()));
  return weightedPick(
    pool.map((n) => [n.name, 1 + MATCH_BONUS * n.tags.filter((t) => wanted.has(t)).length] as const),
    rng
  );
}
