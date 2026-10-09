import { randInt, type Rng } from "../random";
import type { Condition, Geography, SettlementType } from "./options";
import { rollRule, rollRules, type Rule, type SettlementContext } from "./rules";

/**
 * Step 3: the physical layout. Every fact is an English key rolled from the
 * settlement's context, so it agrees with geography, climate, type,
 * prosperity, tone, purposes and origins. Facts that can't exist here
 * (docks inland, bridges with nothing to cross) are null.
 */

type LayoutRule = Rule<string, SettlementContext>;

export const DIRECTIONS = ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export interface Road {
  from: Direction;
  kind: string;
}

export interface Layout {
  center: string;
  roads: Road[];
  waterSource: string;
  waterSupply: string;
  foodStore: string;
  workshops: string;
  market: string;
  burial: string;
  outlying: string[];
  limit: string;
  streets: string;
  density: string;
  materials: string;
  sanitation: string;
  lighting: string;
  bridges: string | null;
  docks: string | null;
}

// ── Shared conditions ───────────────────────────────────────────────────────

const inGeo =
  (...geos: Geography[]) =>
  (c: SettlementContext) =>
    geos.includes(c.geography);
const ofType =
  (...types: SettlementType[]) =>
  (c: SettlementContext) =>
    types.includes(c.type);
const TOWN_UP = ofType("Town", "City", "Metropolis");
const CITY_UP = ofType("City", "Metropolis");
const mines = (c: SettlementContext) => c.purposes.includes("Mining") || c.founding === "Mineral Deposit";

const RIVERS: Geography[] = ["Riverbank", "River Delta", "Valley", "Canyon", "Plains", "Forest", "Hills", "Mountains", "Swamp"];
const SEA: Geography[] = ["Coast", "Island", "River Delta"];
const WATERSIDE: Geography[] = ["Coast", "Island", "River Delta", "Riverbank", "Lake Shore", "Swamp"];
const ARID_LANDS: Geography[] = ["Desert", "Oasis", "Steppe"];
const STEEP: Geography[] = ["Mountains", "Hills", "Canyon", "Volcanic"];
const NO_SMALL = { Homestead: 0, Hamlet: 0, Encampment: 0 };

// ── 1. Center ───────────────────────────────────────────────────────────────

const CENTER: LayoutRule[] = [
  { key: "Market Square", weight: 2, by: { purposes: { Trade: 3, Crafting: 1.5 }, type: { ...NO_SMALL, Town: 2, City: 2, Metropolis: 1.5 } } },
  { key: "Temple", by: { purposes: { Religious: 4 }, founding: { "Holy Site": 5 }, type: { Homestead: 0, Encampment: 0.2 } } },
  { key: "Keep", by: { purposes: { Military: 3, Administrative: 1.5 }, founding: { Fortress: 6 }, tone: { Oppressive: 2 }, type: { Homestead: 0, Encampment: 0 } } },
  {
    key: "Palace",
    weight: 0.5,
    requires: CITY_UP,
    by: { prosperity: { Wealthy: 2, "Exceptionally Rich": 3 }, tone: { Decadent: 2 }, purposes: { Administrative: 3 } },
  },
  { key: "Harbor Front", requires: inGeo(...WATERSIDE), by: { purposes: { Port: 5, Fishing: 3 }, founding: { Harbor: 4 }, type: { Homestead: 0, Encampment: 0 } } },
  {
    key: "Village Green",
    by: { type: { Hamlet: 3, Village: 3, Town: 0.5, City: 0.1, Metropolis: 0, Homestead: 0, Encampment: 0 }, tone: { Peaceful: 2 }, purposes: { Farming: 1.5, Herding: 2 }, geography: { Underground: 0, Desert: 0.2 } },
  },
  { key: "Communal Well", by: { type: { Hamlet: 2, Village: 1.5, City: 0.3, Metropolis: 0.1, Homestead: 0, Encampment: 0 }, geography: { Desert: 3, Steppe: 1.5, Oasis: 0, Swamp: 0.2, Underground: 0.5 } } },
  { key: "Oasis Pool", requires: inGeo("Oasis"), weight: 6 },
  { key: "Mine Head", requires: mines, by: { purposes: { Mining: 4 }, type: { City: 0.5, Metropolis: 0.2 } } },
  { key: "Guildhall", by: { purposes: { Crafting: 3, Trade: 1.5 }, type: { ...NO_SMALL, Village: 0.3, Town: 1.5, City: 2, Metropolis: 2 } } },
  { key: "Crossroads Inn", by: { founding: { Crossroads: 5, Ford: 2 }, type: { Hamlet: 1.5, Village: 1.5, City: 0.2, Metropolis: 0, Homestead: 0, Encampment: 0 } } },
  { key: "Ancient Ruin", weight: 0.3, by: { founding: { Ruins: 6 }, age: { "Built Over Ruins": 4 }, tone: { Mysterious: 2 } } },
  {
    key: "Sacred Site",
    weight: 0.4,
    by: { founding: { "Holy Site": 3 }, foundingDetail: { "Standing Stones": 3, "Sacred Spring": 2, "Fallen Star": 3 }, tone: { Mysterious: 1.5 } },
  },
  { key: "Farmyard", requires: ofType("Homestead"), weight: 5, by: { purposes: { Farming: 2, Herding: 2 } } },
  { key: "Longhouse", requires: ofType("Homestead", "Hamlet"), by: { climate: { Polar: 3, Continental: 1.5 }, purposes: { Hunting: 2, Fishing: 1.5 } } },
  { key: "Command Tent", requires: ofType("Encampment"), by: { purposes: { Military: 4 } } },
  { key: "Fire Circle", requires: ofType("Encampment"), by: { purposes: { Refuge: 2, Herding: 2, Hunting: 2, Trade: 1.5 } } },
  { key: "Pleasure Gardens", weight: 0.3, by: { purposes: { Leisure: 6 }, tone: { Decadent: 3 }, type: NO_SMALL } },
  { key: "Great Cavern Hall", requires: inGeo("Underground"), weight: 3 },
];

// ── 2. Roads ────────────────────────────────────────────────────────────────

const ROAD_COUNT: Record<SettlementType, readonly [number, number]> = {
  Homestead: [1, 1],
  Hamlet: [1, 2],
  Village: [2, 3],
  Town: [3, 4],
  City: [4, 6],
  Metropolis: [6, 8],
  Encampment: [1, 2],
};

const ROAD_KIND: LayoutRule[] = [
  { key: "Footpath", by: { type: { Homestead: 3, Hamlet: 2, Village: 0.5, Town: 0.1, City: 0, Metropolis: 0 }, prosperity: { Destitute: 2, Poor: 1.5 } } },
  { key: "Track", weight: 2, by: { type: { City: 0.3, Metropolis: 0.1 }, prosperity: { Destitute: 1.5 }, geography: { Island: 0.3 } } },
  { key: "Cart Road", weight: 3, by: { type: { Homestead: 0.3 }, geography: { Island: 0.3, Underground: 0.5 } } },
  {
    key: "Paved Highway",
    weight: 0.5,
    by: {
      type: { Homestead: 0, Hamlet: 0, Encampment: 0, Village: 0.2, City: 3, Metropolis: 5 },
      prosperity: { Destitute: 0.1, Poor: 0.3, Wealthy: 2, "Exceptionally Rich": 3 },
      purposes: { Administrative: 2, Military: 1.5, Trade: 1.5 },
    },
  },
  { key: "Causeway", requires: inGeo("Swamp", "River Delta", "Lake Shore"), weight: 3 },
  { key: "Switchback", requires: inGeo(...STEEP), weight: 3 },
  { key: "Tunnel", requires: inGeo("Underground", "Mountains"), weight: 0.5, by: { geography: { Underground: 16 } } },
  { key: "Ferry Landing", requires: inGeo("Riverbank", "Lake Shore", "River Delta", "Island", "Coast"), by: { geography: { Island: 4 } } },
  { key: "Sea Lane", requires: inGeo("Island", "Coast"), by: { geography: { Island: 6 }, purposes: { Port: 2 } } },
  { key: "Caravan Trail", requires: inGeo(...ARID_LANDS), weight: 4 },
  { key: "Ice Road", requires: (c) => c.climate === "Polar" || c.geography === "Tundra", weight: 2 },
];

const DIRECTION_RULES: Rule<Direction, SettlementContext>[] = DIRECTIONS.map((key) => ({ key }));

function rollRoads(ctx: SettlementContext, rng: Rng): Road[] {
  const [min, max] = ROAD_COUNT[ctx.type];
  return rollRules(DIRECTION_RULES, ctx, randInt(min, max, rng), rng).map((from) => ({ from, kind: rollRule(ROAD_KIND, ctx, rng) }));
}

// ── 3 and 14. Water ─────────────────────────────────────────────────────────

const WATER_SOURCE: LayoutRule[] = [
  { key: "River", requires: inGeo(...RIVERS), by: { geography: { Riverbank: 5, "River Delta": 4, Valley: 2, Canyon: 1.5 } } },
  { key: "Lake", requires: inGeo("Lake Shore"), weight: 6 },
  { key: "Wells", weight: 3, by: { geography: { Plains: 2, Steppe: 2, Desert: 1.5, Swamp: 0.3, Tundra: 0.2 }, type: { Encampment: 0.3 } } },
  { key: "Cisterns", by: { geography: { Desert: 3, Island: 3, Canyon: 2, Volcanic: 1.5, Coast: 1.5 }, climate: { Arid: 2 }, type: { Homestead: 0.3 } } },
  { key: "Spring", by: { founding: { Spring: 6 }, foundingDetail: { "Fresh Spring": 6, "Sacred Spring": 4, "Hot Springs": 4 }, geography: { Hills: 1.5, Mountains: 2, Oasis: 0.05 } } },
  { key: "Oasis Pool", requires: inGeo("Oasis"), weight: 10 },
  {
    key: "Snowmelt",
    requires: (c) => c.climate === "Polar" || c.climate === "Continental" || ["Mountains", "Tundra"].includes(c.geography),
    by: { geography: { Mountains: 3, Tundra: 3 }, climate: { Polar: 3 } },
  },
  { key: "Underground Lake", requires: inGeo("Underground"), weight: 5 },
  { key: "Rain Barrels", weight: 0.5, by: { climate: { Tropical: 4, Arid: 0.1 }, geography: { Island: 2, Swamp: 1.5 } } },
  {
    key: "Aqueduct",
    requires: TOWN_UP,
    weight: 0.3,
    by: { type: { City: 2, Metropolis: 5 }, prosperity: { Destitute: 0.1, Poor: 0.3, Wealthy: 3, "Exceptionally Rich": 4 }, growth: { Planned: 2 } },
  },
];

const WATER_SUPPLY: LayoutRule[] = [
  {
    key: "Public Fountains",
    requires: TOWN_UP,
    by: { prosperity: { Destitute: 0.1, Poor: 0.3, Comfortable: 2, Wealthy: 3, "Exceptionally Rich": 4 }, type: { City: 2, Metropolis: 3 } },
  },
  { key: "Shared Wells", weight: 2, by: { type: { Metropolis: 0.3, Homestead: 0.3 } } },
  { key: "Water Carriers", by: { type: { City: 2, Metropolis: 2, Homestead: 0 }, prosperity: { Poor: 1.5 }, geography: { Desert: 2 } } },
  {
    key: "Fouled Water",
    weight: 0.7,
    by: {
      condition: { Overcrowded: 4, Declining: 1.5, "Partly Abandoned": 1.5 },
      prosperity: { Destitute: 3, Poor: 2, Wealthy: 0.2, "Exceptionally Rich": 0.1 },
      tone: { Grim: 2 },
    },
  },
  { key: "Strict Rationing", weight: 0.6, by: { climate: { Arid: 4 }, geography: { Desert: 3, Oasis: 2, Island: 1.5 }, tone: { Oppressive: 2 } } },
  { key: "Hauled by Hand", by: { type: { Homestead: 4, Hamlet: 3, Encampment: 3, City: 0.1, Metropolis: 0 } } },
  {
    key: "Piped Channels",
    requires: TOWN_UP,
    weight: 0.3,
    by: { prosperity: { Wealthy: 3, "Exceptionally Rich": 5 }, purposes: { Scholarly: 2 }, growth: { Planned: 2 } },
  },
  {
    key: "Never Short of Water",
    by: { geography: { Riverbank: 3, "Lake Shore": 3, Swamp: 2, Desert: 0, Oasis: 0.2 }, climate: { Tropical: 2, Arid: 0.1 } },
  },
];

// ── 4. Food stores, workshops, markets, burial grounds ──────────────────────

const FOOD_STORE: LayoutRule[] = [
  { key: "Granary", by: { purposes: { Farming: 4 }, type: { Homestead: 0.3 }, climate: { Tropical: 0.5 }, geography: { Underground: 0.2 } } },
  { key: "Root Cellars", by: { type: { Homestead: 3, Hamlet: 3, Village: 2 }, climate: { Continental: 2, Temperate: 1.5, Tropical: 0.3 } } },
  { key: "Ice House", weight: 0.6, by: { climate: { Polar: 4, Continental: 2, Tropical: 0, Arid: 0.2 }, prosperity: { Wealthy: 2 } } },
  { key: "Salting Sheds", by: { purposes: { Fishing: 5, Hunting: 2, Herding: 1.5 } } },
  { key: "Smokehouses", by: { purposes: { Hunting: 3, Fishing: 2 }, climate: { Polar: 2 } } },
  { key: "Warehouses", by: { purposes: { Trade: 4, Port: 4 }, type: { Homestead: 0, Encampment: 0, Hamlet: 0.2, Town: 1.5, City: 3, Metropolis: 4 } } },
  { key: "Supply Wagons", requires: ofType("Encampment"), weight: 6 },
  { key: "Fungus Vaults", requires: inGeo("Underground"), weight: 4 },
  { key: "Temple Storehouse", by: { purposes: { Religious: 3 }, tone: { Oppressive: 1.5 }, type: { Homestead: 0 } } },
];

const WORKSHOPS: LayoutRule[] = [
  { key: "Craft Quarter", requires: TOWN_UP, by: { purposes: { Crafting: 3, Trade: 1.5 } } },
  { key: "Downstream", requires: inGeo("Riverbank", "River Delta", "Valley"), weight: 2, by: { purposes: { Crafting: 2 } } },
  { key: "Along the Main Road", weight: 2, by: { type: { Homestead: 0 } } },
  { key: "In the Homes", by: { type: { Homestead: 4, Hamlet: 3, Village: 2, City: 0.3, Metropolis: 0.2 } } },
  { key: "By the Docks", requires: inGeo(...WATERSIDE), by: { purposes: { Port: 3, Fishing: 2 }, type: { Homestead: 0 } } },
  { key: "At the Mine", requires: mines, by: { purposes: { Mining: 4 } } },
  { key: "Outside the Walls", requires: TOWN_UP, by: { type: { City: 2, Metropolis: 2 }, tone: { Oppressive: 1.5 } } },
  { key: "Carved Galleries", requires: inGeo("Underground"), weight: 3 },
  { key: "Under Canvas", requires: ofType("Encampment"), weight: 5 },
];

const MARKET: LayoutRule[] = [
  { key: "Market Square", requires: ofType("Village", "Town", "City", "Metropolis"), by: { purposes: { Trade: 3 }, type: { Town: 2, City: 2, Metropolis: 2 } } },
  { key: "Weekly Fair Field", by: { type: { Homestead: 0, Encampment: 0, Hamlet: 2, Village: 3, Town: 1.5, City: 0.3, Metropolis: 0.2 }, purposes: { Herding: 2, Farming: 1.5 } } },
  { key: "Quay Stalls", requires: inGeo(...WATERSIDE), by: { purposes: { Fishing: 3, Port: 3 }, type: { Homestead: 0 } } },
  { key: "Roadside Stalls", weight: 2, by: { type: { Homestead: 0.3, Metropolis: 0.2 }, prosperity: { Poor: 1.5, Destitute: 2 } } },
  {
    key: "Covered Market Hall",
    requires: TOWN_UP,
    by: { prosperity: { Destitute: 0.1, Wealthy: 3, "Exceptionally Rich": 4 }, type: { City: 2, Metropolis: 3 } },
  },
  { key: "Bazaar Streets", requires: CITY_UP, by: { climate: { Arid: 3, Tropical: 2 }, purposes: { Trade: 2 }, tone: { Lively: 2, Decadent: 1.5 } } },
  { key: "Barter at the Door", by: { type: { Homestead: 6, Hamlet: 2, Encampment: 2, Village: 0.3, Town: 0, City: 0, Metropolis: 0 } } },
  {
    key: "Traveling Peddlers",
    by: { type: { Homestead: 3, Hamlet: 3, Encampment: 2, Village: 1, Town: 0.2, City: 0, Metropolis: 0 }, geography: { Tundra: 2, Mountains: 1.5 } },
  },
  { key: "Black Market", weight: 0.3, by: { purposes: { Smuggling: 6 }, tone: { Decadent: 3, Oppressive: 3 }, type: { Homestead: 0, Hamlet: 0 } } },
  { key: "Caravan Market", requires: inGeo(...ARID_LANDS), weight: 3, by: { type: { Homestead: 0 } } },
];

const BURIAL: LayoutRule[] = [
  { key: "Churchyard", weight: 3, by: { purposes: { Religious: 2 }, geography: { Underground: 0 }, type: { Homestead: 0.2, Encampment: 0 } } },
  { key: "Family Plot", by: { type: { Homestead: 8, Hamlet: 2, Village: 0.3, Town: 0, City: 0, Metropolis: 0, Encampment: 0 } } },
  {
    key: "Catacombs",
    by: { type: { Homestead: 0, Hamlet: 0, Encampment: 0, Village: 0.3, City: 3, Metropolis: 4 }, geography: { Underground: 8 }, prosperity: { Wealthy: 1.5 } },
  },
  {
    key: "Barrow Hill",
    weight: 0.6,
    by: { age: { Ancient: 3, Centuries: 1.5, Recent: 0.3 }, geography: { Plains: 2, Hills: 2, Steppe: 2, Underground: 0 }, tone: { Mysterious: 2 } },
  },
  { key: "Sea Burial", requires: inGeo(...SEA), by: { purposes: { Fishing: 3, Port: 2 } } },
  { key: "Pyre Field", weight: 0.7, by: { geography: { Desert: 2, Steppe: 2, Tundra: 0.5, Underground: 0 }, tone: { Harsh: 1.5, Grim: 1.5 } } },
  { key: "Sky Burial", requires: inGeo("Mountains", "Tundra", "Canyon", "Steppe"), weight: 0.4, by: { climate: { Polar: 2 } } },
  { key: "Cairns", requires: inGeo("Tundra", "Mountains", "Hills", "Steppe"), by: { climate: { Polar: 3 } } },
  { key: "Bog Burial", requires: inGeo("Swamp"), weight: 2 },
  {
    key: "Shallow Graves",
    requires: (c) => c.type === "Encampment" || c.prosperity === "Destitute" || c.tone === "Grim",
    by: { type: { Encampment: 6 }, prosperity: { Destitute: 3 }, tone: { Grim: 2 } },
  },
  { key: "City of the Dead", requires: CITY_UP, weight: 0.5, by: { age: { Ancient: 3 }, prosperity: { Wealthy: 2, "Exceptionally Rich": 2 } } },
];

// ── 5. Outlying buildings ───────────────────────────────────────────────────

const OUTLYING_COUNT: Record<SettlementType, readonly [number, number]> = {
  Homestead: [0, 1],
  Hamlet: [1, 2],
  Village: [1, 3],
  Town: [2, 3],
  City: [2, 4],
  Metropolis: [3, 4],
  Encampment: [0, 2],
};

const OUTLYING: LayoutRule[] = [
  { key: "Watermill", requires: inGeo("Riverbank", "River Delta", "Valley", "Hills", "Forest", "Plains"), weight: 2, by: { purposes: { Farming: 3, Crafting: 2 } } },
  {
    key: "Windmill",
    requires: (c) => !["Underground", "Forest", "Canyon", "Swamp"].includes(c.geography),
    by: { purposes: { Farming: 3 }, geography: { Plains: 2, Coast: 1.5, Hills: 1.5, Steppe: 1.5 } },
  },
  {
    key: "Outlying Farmsteads",
    by: { purposes: { Farming: 3, Herding: 2 }, type: { Homestead: 0, Encampment: 0, Metropolis: 2 }, geography: { Underground: 0, Desert: 0.2, Tundra: 0.1 } },
  },
  { key: "Wayside Shrine", weight: 1.5, by: { purposes: { Religious: 2 }, tone: { Peaceful: 1.5 } } },
  { key: "Gallows Hill", by: { type: { Homestead: 0, Hamlet: 0.3, Encampment: 0.5 }, tone: { Oppressive: 4, Grim: 2.5, Harsh: 2, Peaceful: 0.1 } } },
  { key: "Leper House", weight: 0.5, by: { type: NO_SMALL, recentChange: { Plague: 5 }, tone: { Grim: 2 } } },
  { key: "Mine Head", requires: mines, by: { purposes: { Mining: 4 } } },
  { key: "Quarry", weight: 0.8, by: { geography: { Hills: 2, Mountains: 2, Canyon: 2, Swamp: 0, "River Delta": 0, Underground: 0.3 }, foundingDetail: { Marble: 6 } } },
  { key: "Watchtower", by: { purposes: { Military: 3 }, tone: { Harsh: 2 }, geography: { Steppe: 1.5, Coast: 1.5 } } },
  { key: "Charcoal Burners", requires: inGeo("Forest", "Hills", "Mountains", "Valley"), by: { purposes: { Logging: 3, Crafting: 2, Mining: 1.5 } } },
  { key: "Lumber Camp", requires: inGeo("Forest", "Mountains", "Hills", "Valley", "Swamp"), by: { purposes: { Logging: 5 } } },
  { key: "Shepherd Huts", by: { purposes: { Herding: 5 }, geography: { Hills: 2, Mountains: 2, Steppe: 2, Underground: 0, Swamp: 0.2 } } },
  {
    key: "Toll House",
    requires: (c) => TOWN_UP(c) || c.founding === "Ford" || c.founding === "Crossroads",
    weight: 0.8,
    by: { founding: { Ford: 3, Crossroads: 3 }, tone: { Oppressive: 2 } },
  },
  { key: "Old Ruins", weight: 0.5, by: { founding: { Ruins: 3 }, tone: { Mysterious: 3 }, age: { Ancient: 2 } } },
  { key: "Lighthouse", requires: inGeo(...SEA), by: { purposes: { Port: 4, Fishing: 2 }, type: { Homestead: 0, Hamlet: 0.3 } } },
  { key: "Fishing Huts", requires: inGeo(...WATERSIDE), by: { purposes: { Fishing: 4 } } },
  { key: "Hermitage", weight: 0.4, by: { tone: { Mysterious: 2, Peaceful: 1.5 }, purposes: { Religious: 2 } } },
  {
    key: "Noble Manor",
    by: { type: { Homestead: 0, Encampment: 0, Hamlet: 0.5 }, prosperity: { Destitute: 0.3, Wealthy: 3, "Exceptionally Rich": 4 }, tone: { Oppressive: 2, Decadent: 2 } },
  },
  { key: "Caravan Camp", requires: (c) => ARID_LANDS.includes(c.geography) || c.purposes.includes("Trade"), by: { purposes: { Trade: 2 }, geography: { Oasis: 4, Desert: 3 } } },
  { key: "Fungus Farms", requires: inGeo("Underground"), weight: 3, by: { purposes: { Farming: 6 } } },
];

// ── 6. What limits expansion ────────────────────────────────────────────────

const LIMIT: LayoutRule[] = [
  { key: "The Sea", requires: inGeo(...SEA), by: { geography: { Island: 6, Coast: 4 } } },
  { key: "A River", requires: inGeo("Riverbank", "River Delta", "Valley"), weight: 3 },
  { key: "The Lake", requires: inGeo("Lake Shore"), weight: 6 },
  { key: "Cliffs", requires: inGeo("Coast", "Canyon", "Mountains", "Hills", "Island"), by: { geography: { Canyon: 6, Mountains: 3, Coast: 2, Island: 1.5 } } },
  { key: "Mountain Slopes", requires: inGeo("Mountains", "Valley", "Hills", "Volcanic"), by: { geography: { Mountains: 5, Valley: 4 } } },
  { key: "Marshland", requires: inGeo("Swamp", "River Delta", "Lake Shore", "Riverbank"), by: { geography: { Swamp: 6, "River Delta": 3 } } },
  { key: "Dense Forest", requires: inGeo("Forest", "Valley", "Hills", "Mountains", "Swamp"), by: { geography: { Forest: 6 } } },
  { key: "Dunes", requires: inGeo("Desert", "Oasis"), weight: 5 },
  { key: "Cavern Walls", requires: inGeo("Underground"), weight: 8 },
  { key: "Lava Fields", requires: inGeo("Volcanic"), weight: 6 },
  { key: "Permafrost", requires: (c) => c.geography === "Tundra" || c.climate === "Polar", by: { geography: { Tundra: 5 } } },
  { key: "Noble Estates", requires: TOWN_UP, weight: 0.6, by: { prosperity: { Wealthy: 3, "Exceptionally Rich": 4 }, tone: { Oppressive: 2, Decadent: 2 } } },
  { key: "Old Walls", requires: TOWN_UP, by: { purposes: { Military: 2 }, age: { Centuries: 1.5, Ancient: 2, Recent: 0.2 }, tone: { Oppressive: 1.5 } } },
  { key: "Hostile Neighbors", weight: 0.4, by: { tone: { Harsh: 3, Grim: 2, Peaceful: 0.2 } } },
  { key: "Open Land", requires: inGeo("Plains", "Steppe", "Desert", "Tundra", "Hills"), by: { geography: { Plains: 4, Steppe: 5 } } },
  { key: "Sacred Ground", weight: 0.3, by: { founding: { "Holy Site": 4 }, tone: { Mysterious: 2 } } },
];

// ── 7–11. Streets, density, materials, sanitation, lighting ─────────────────

const STREETS: LayoutRule[] = [
  { key: "Organic", weight: 4, by: { growth: { Gradual: 2, Merged: 1.5, Planned: 0.1 }, type: { Homestead: 0, Encampment: 0 } } },
  { key: "Grid", weight: 0.6, by: { growth: { Planned: 15, Occupation: 3 }, founding: { Decree: 3 }, type: { Homestead: 0, Hamlet: 0.3 } } },
  { key: "Radial", weight: 0.6, by: { founding: { "Holy Site": 2, Fortress: 2 }, type: { Homestead: 0, Hamlet: 0.2, Encampment: 0, Town: 1.5, City: 2, Metropolis: 2 } } },
  {
    key: "Linear",
    weight: 1.5,
    by: { geography: { Riverbank: 3, Coast: 2, Valley: 3, Canyon: 4, "Lake Shore": 2 }, type: { Homestead: 0, Hamlet: 2, Village: 2, Metropolis: 0.2 } },
  },
  { key: "Terraced", requires: inGeo("Mountains", "Hills", "Volcanic", "Canyon", "Island", "Valley"), by: { geography: { Mountains: 6, Canyon: 3, Hills: 2 }, type: { Homestead: 0 } } },
  { key: "Ring", weight: 0.5, by: { founding: { Fortress: 5 }, purposes: { Military: 2 }, type: { Homestead: 0, Hamlet: 0.3 } } },
  { key: "Stilt Walkways", requires: inGeo("Swamp", "River Delta", "Lake Shore", "Coast"), by: { geography: { Swamp: 8, "River Delta": 3 }, type: { Homestead: 0 } } },
  { key: "Tunnels and Galleries", requires: inGeo("Underground"), weight: 30 },
  { key: "Scattered", by: { type: { Homestead: 10, Hamlet: 3, Encampment: 1, Village: 0.5, Town: 0, City: 0, Metropolis: 0 }, condition: { "Partly Abandoned": 2 } } },
  { key: "Tent Rows", requires: ofType("Encampment"), weight: 6, by: { purposes: { Military: 3 } } },
  { key: "Canals", requires: (c) => TOWN_UP(c) && ["River Delta", "Lake Shore", "Coast", "Swamp"].includes(c.geography), by: { geography: { "River Delta": 4 } } },
];

export const DENSITIES = ["Scattered", "Loose", "Moderate", "Dense", "Packed"] as const;
type Density = (typeof DENSITIES)[number];
const DENSITY_BY_TYPE: Record<SettlementType, Record<Density, number>> = {
  Homestead: { Scattered: 10, Loose: 1, Moderate: 0, Dense: 0, Packed: 0 },
  Hamlet: { Scattered: 2, Loose: 4, Moderate: 1, Dense: 0, Packed: 0 },
  Village: { Scattered: 0.3, Loose: 3, Moderate: 3, Dense: 0.3, Packed: 0 },
  Town: { Scattered: 0, Loose: 1, Moderate: 3, Dense: 2, Packed: 0.3 },
  City: { Scattered: 0, Loose: 0.2, Moderate: 1.5, Dense: 3, Packed: 1.5 },
  Metropolis: { Scattered: 0, Loose: 0, Moderate: 0.5, Dense: 3, Packed: 3 },
  Encampment: { Scattered: 0.3, Loose: 1, Moderate: 2, Dense: 2, Packed: 2 },
};
const DENSITY_BY_CONDITION: Partial<Record<Condition, Partial<Record<Density, number>>>> = {
  Overcrowded: { Scattered: 0.1, Loose: 0.2, Dense: 2, Packed: 6 },
  "Partly Abandoned": { Scattered: 2, Loose: 3, Dense: 0.3, Packed: 0.1 },
  Declining: { Loose: 1.5 },
  Growing: { Dense: 1.3 },
};
/** One density's column of a row table, as a factor table by row key. */
const column = <R extends string>(table: Partial<Record<R, Partial<Record<Density, number>>>>, key: Density) =>
  Object.fromEntries(Object.entries(table).map(([row, values]) => [row, (values as Partial<Record<Density, number>>)[key] ?? 1]));
const DENSITY: LayoutRule[] = DENSITIES.map((key) => ({ key, by: { type: column(DENSITY_BY_TYPE, key), condition: column(DENSITY_BY_CONDITION, key) } }));

const MATERIALS: LayoutRule[] = [
  {
    key: "Timber and Thatch",
    weight: 3,
    by: {
      climate: { Temperate: 2, Continental: 1.5, Arid: 0.2, Polar: 0.3 },
      geography: { Forest: 3, Desert: 0, Oasis: 0.1, Tundra: 0, Underground: 0, Steppe: 0.3 },
      prosperity: { Wealthy: 0.5, "Exceptionally Rich": 0.2 },
    },
  },
  {
    key: "Wattle and Daub",
    weight: 2,
    by: { prosperity: { Destitute: 2, Poor: 2, Wealthy: 0.3, "Exceptionally Rich": 0.1 }, climate: { Temperate: 1.5, Polar: 0.2 }, geography: { Underground: 0, Desert: 0.2 } },
  },
  { key: "Fieldstone", weight: 2, by: { geography: { Hills: 3, Mountains: 2, Underground: 0, Swamp: 0.2, "River Delta": 0.2 }, climate: { Polar: 1.5 } } },
  {
    key: "Dressed Stone",
    weight: 0.5,
    by: {
      prosperity: { Destitute: 0.05, Poor: 0.2, Comfortable: 2, Wealthy: 4, "Exceptionally Rich": 6 },
      type: { Homestead: 0.1, Encampment: 0, City: 3, Metropolis: 4 },
      foundingDetail: { Marble: 4 },
    },
  },
  { key: "Brick", weight: 0.8, by: { geography: { "River Delta": 3, Riverbank: 2, Plains: 1.5, Valley: 1.5 }, type: { Encampment: 0, Town: 1.5, City: 2, Metropolis: 2.5 } } },
  { key: "Mud Brick", by: { climate: { Arid: 6, Tropical: 1, Temperate: 0.1, Continental: 0.2, Polar: 0 }, geography: { Desert: 4, Oasis: 5, Steppe: 1.5, Underground: 0 } } },
  {
    key: "Sod and Turf",
    by: {
      climate: { Polar: 4, Continental: 1.5, Tropical: 0, Arid: 0.1 },
      geography: { Tundra: 5, Steppe: 3, Plains: 1.5, Forest: 0.3, Underground: 0 },
      prosperity: { Wealthy: 0.2, "Exceptionally Rich": 0.1 },
    },
  },
  {
    key: "Hide Tents",
    by: { type: { Encampment: 10, Homestead: 0.5, Hamlet: 0.3, Village: 0.05, Town: 0, City: 0, Metropolis: 0 }, geography: { Steppe: 3, Tundra: 3, Desert: 2, Underground: 0.2 } },
  },
  { key: "Carved Rock", requires: inGeo("Underground", "Canyon", "Mountains", "Volcanic"), by: { geography: { Underground: 12, Canyon: 5, Mountains: 1.5 } } },
  { key: "Reed on Stilts", requires: inGeo("Swamp", "River Delta", "Lake Shore", "Coast", "Island"), by: { geography: { Swamp: 8, "River Delta": 3 }, climate: { Tropical: 2, Polar: 0 } } },
  { key: "Volcanic Stone", requires: inGeo("Volcanic"), weight: 8 },
  { key: "Driftwood and Stone", requires: inGeo("Coast", "Island"), by: { prosperity: { Poor: 2, Destitute: 2, Wealthy: 0.3 }, climate: { Polar: 2 } } },
  { key: "Bamboo and Palm", requires: (c) => c.climate === "Tropical" && c.geography !== "Underground", weight: 4 },
];

const SANITATION: LayoutRule[] = [
  { key: "Cesspits", weight: 3, by: { type: { Homestead: 0.5, Encampment: 0.3 } } },
  {
    key: "Open Gutters",
    weight: 2,
    by: { type: { Homestead: 0, Hamlet: 0.3, Town: 2, City: 2, Metropolis: 1.5 }, prosperity: { Poor: 1.5, Destitute: 2 }, condition: { Overcrowded: 2 } },
  },
  { key: "Night-Soil Carts", requires: TOWN_UP, by: { type: { City: 2, Metropolis: 2 }, prosperity: { Modest: 1.5, Comfortable: 1.5 } } },
  {
    key: "Sewers",
    requires: TOWN_UP,
    weight: 0.3,
    by: {
      prosperity: { Destitute: 0, Poor: 0.2, Wealthy: 4, "Exceptionally Rich": 6 },
      type: { City: 2, Metropolis: 4 },
      growth: { Planned: 2 },
      geography: { Underground: 2 },
    },
  },
  { key: "Privies over Water", requires: inGeo(...WATERSIDE), weight: 2, by: { geography: { Swamp: 3, "River Delta": 2, Coast: 1.5 } } },
  {
    key: "Latrine Trenches",
    by: { type: { Encampment: 10, Homestead: 0, Hamlet: 0.3, Village: 0.2, Town: 0, City: 0, Metropolis: 0 }, purposes: { Military: 2 } },
  },
  { key: "Outhouses", by: { type: { Homestead: 6, Hamlet: 4, Village: 2, City: 0.2, Metropolis: 0 } } },
  { key: "Dung Collectors", weight: 0.6, by: { purposes: { Farming: 3 }, type: { Homestead: 0 } } },
  {
    key: "Public Bathhouses",
    requires: TOWN_UP,
    weight: 0.4,
    by: { purposes: { Leisure: 4 }, prosperity: { Wealthy: 2, "Exceptionally Rich": 3 }, tone: { Decadent: 2 }, foundingDetail: { "Hot Springs": 6 } },
  },
  {
    key: "None to Speak Of",
    weight: 0.4,
    by: { prosperity: { Destitute: 4, Poor: 1.5, Wealthy: 0, "Exceptionally Rich": 0 }, tone: { Grim: 2 }, condition: { Overcrowded: 2 } },
  },
];

const LIGHTING: LayoutRule[] = [
  {
    key: "Hearth Light Only",
    by: { type: { Homestead: 6, Hamlet: 4, Encampment: 1, Village: 1.5, Town: 0.3, City: 0, Metropolis: 0 }, prosperity: { Destitute: 3, Poor: 2 } },
  },
  { key: "Campfires", requires: ofType("Encampment"), weight: 6 },
  { key: "Gate Torches", weight: 2, by: { type: { Homestead: 0, Hamlet: 0.5, Village: 2, Town: 2, City: 0.5, Metropolis: 0.2 }, purposes: { Military: 1.5 } } },
  {
    key: "Street Lanterns",
    requires: TOWN_UP,
    weight: 1.5,
    by: { prosperity: { Destitute: 0.1, Poor: 0.4, Comfortable: 2, Wealthy: 3, "Exceptionally Rich": 2 }, type: { City: 2, Metropolis: 3 } },
  },
  { key: "Oil Lamps", by: { purposes: { Fishing: 2, Port: 1.5 }, type: { Homestead: 0.3 }, prosperity: { Destitute: 0.3 } } },
  {
    key: "Magical Lights",
    requires: TOWN_UP,
    weight: 0.2,
    by: { purposes: { Scholarly: 6 }, prosperity: { Destitute: 0, Poor: 0.1, Wealthy: 3, "Exceptionally Rich": 6 }, tone: { Mysterious: 2 } },
  },
  { key: "Glowing Fungi", requires: inGeo("Underground"), weight: 6 },
  { key: "Braziers", requires: TOWN_UP, weight: 0.6, by: { tone: { Oppressive: 2, Harsh: 1.5 }, purposes: { Military: 2 } } },
  { key: "Candles in Windows", by: { type: { Homestead: 0.5, Hamlet: 1.5, Village: 2, Metropolis: 0.3 }, tone: { Peaceful: 2, Mysterious: 1.5 } } },
  { key: "Curfew Darkness", weight: 0.3, by: { tone: { Oppressive: 6, Grim: 2 }, type: { Homestead: 0 } } },
];

// ── 12–13. Bridges and docks ────────────────────────────────────────────────

const BRIDGE_GEOS: Geography[] = ["Riverbank", "River Delta", "Valley", "Canyon", "Swamp", "Underground", "Mountains"];
const hasBridges = (c: SettlementContext) => BRIDGE_GEOS.includes(c.geography) || c.founding === "Ford" || c.recentChange === "Destroyed Bridge";

const BRIDGES: LayoutRule[] = [
  {
    key: "Ford Stones",
    by: { type: { City: 0.1, Metropolis: 0 }, prosperity: { Destitute: 2, Poor: 2 }, foundingDetail: { "Shallow Ford": 5 }, geography: { Canyon: 0, Underground: 0, Mountains: 0.3 } },
  },
  { key: "Timber Bridge", weight: 3, by: { prosperity: { Wealthy: 0.5, "Exceptionally Rich": 0.3 }, geography: { Canyon: 0.5, Underground: 0.1 } } },
  {
    key: "Stone Bridge",
    by: {
      prosperity: { Destitute: 0.1, Poor: 0.3, Comfortable: 2, Wealthy: 3, "Exceptionally Rich": 4 },
      type: { Homestead: 0, Hamlet: 0.3, City: 2, Metropolis: 2 },
      foundingDetail: { "Ancient Bridge": 8 },
    },
  },
  { key: "Many Bridges", requires: TOWN_UP, by: { geography: { "River Delta": 4, Swamp: 3 }, type: { Town: 0.5, City: 2, Metropolis: 3 } } },
  { key: "Rope Bridges", requires: inGeo("Canyon", "Mountains", "Underground"), by: { geography: { Canyon: 8, Mountains: 3, Underground: 3 }, prosperity: { Wealthy: 0.3 } } },
  { key: "Ferry Instead", requires: inGeo("River Delta", "Riverbank", "Lake Shore"), weight: 0.5, by: { foundingDetail: { "Ferry Crossing": 8 } } },
  { key: "Broken Bridge", requires: (c) => c.recentChange === "Destroyed Bridge" },
  { key: "Carved Stone Spans", requires: inGeo("Underground"), weight: 4 },
];

const DOCKS: LayoutRule[] = [
  { key: "Fishing Jetty", weight: 3, by: { purposes: { Fishing: 2 }, type: { City: 0.3, Metropolis: 0.1 } } },
  { key: "River Landing", requires: inGeo("Riverbank", "River Delta", "Swamp"), weight: 3 },
  { key: "Lake Pier", requires: inGeo("Lake Shore"), weight: 4 },
  { key: "Stone Quay", requires: TOWN_UP, by: { purposes: { Port: 3, Trade: 2 }, founding: { Harbor: 2 }, prosperity: { Wealthy: 2, "Exceptionally Rich": 2 } } },
  { key: "Harbor Piers", requires: (c) => TOWN_UP(c) && SEA.includes(c.geography), by: { purposes: { Port: 5 }, founding: { Harbor: 3 }, type: { City: 2, Metropolis: 3 } } },
  { key: "Canal Docks", requires: (c) => CITY_UP(c) && ["River Delta", "Swamp", "Lake Shore"].includes(c.geography), by: { geography: { "River Delta": 3 } } },
  { key: "Beached Boats", by: { type: { Homestead: 4, Hamlet: 3, Encampment: 2, Village: 1, Town: 0.2, City: 0, Metropolis: 0 }, prosperity: { Destitute: 2, Poor: 2 } } },
  { key: "Smugglers' Cove", requires: inGeo("Coast", "Island"), weight: 0.3, by: { purposes: { Smuggling: 8 } } },
  { key: "Ruined Docks", weight: 0.2, by: { condition: { "Partly Abandoned": 8, Declining: 3 }, recentChange: { Flood: 5 } } },
];
const hasDocks = (c: SettlementContext) => WATERSIDE.includes(c.geography);

/** Every fact's options, for labels and tests. Roads use ROAD_KIND and DIRECTIONS. */
export const LAYOUT_OPTIONS = {
  center: CENTER,
  roadKind: ROAD_KIND,
  waterSource: WATER_SOURCE,
  waterSupply: WATER_SUPPLY,
  foodStore: FOOD_STORE,
  workshops: WORKSHOPS,
  market: MARKET,
  burial: BURIAL,
  outlying: OUTLYING,
  limit: LIMIT,
  streets: STREETS,
  density: DENSITY,
  materials: MATERIALS,
  sanitation: SANITATION,
  lighting: LIGHTING,
  bridges: BRIDGES,
  docks: DOCKS,
} as const satisfies Record<string, readonly LayoutRule[]>;

export function rollLayout(ctx: SettlementContext, rng: Rng): Layout {
  const roll = (rules: readonly LayoutRule[]) => rollRule(rules, ctx, rng);
  const [min, max] = OUTLYING_COUNT[ctx.type];
  return {
    center: roll(CENTER),
    roads: rollRoads(ctx, rng),
    waterSource: roll(WATER_SOURCE),
    waterSupply: roll(WATER_SUPPLY),
    foodStore: roll(FOOD_STORE),
    workshops: roll(WORKSHOPS),
    market: roll(MARKET),
    burial: roll(BURIAL),
    outlying: rollRules(OUTLYING, ctx, randInt(min, max, rng), rng),
    limit: roll(LIMIT),
    streets: roll(STREETS),
    density: roll(DENSITY),
    materials: roll(MATERIALS),
    sanitation: roll(SANITATION),
    lighting: roll(LIGHTING),
    // A bridge destroyed lately is the bridge everyone talks about.
    bridges: ctx.recentChange === "Destroyed Bridge" ? "Broken Bridge" : hasBridges(ctx) ? roll(BRIDGES) : null,
    docks: hasDocks(ctx) ? roll(DOCKS) : null,
  };
}
