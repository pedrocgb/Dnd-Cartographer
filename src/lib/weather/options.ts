/**
 * Options of the Weather Generator. Real-world seasons and climates (the
 * Köppen groups), unrelated to the app's calendars and their seasons.
 */

export const CLIMATES = ["Tropical", "Dry", "Temperate", "Continental", "Polar"] as const;
export type Climate = (typeof CLIMATES)[number];

export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;
export type Season = (typeof SEASONS)[number];

/** Parts of the day; each hour belongs to one (see HOUR_TIMES). */
export const TIMES_OF_DAY = ["Midnight", "Night", "Dawn", "Sunrise", "Morning", "Noon", "Afternoon", "Sunset", "Dusk", "Evening"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export const DARK_TIMES: ReadonlySet<TimeOfDay> = new Set(["Dusk", "Evening", "Night", "Midnight", "Dawn"]);
/** When rising warm air builds showers and thunderstorms. */
export const CONVECTIVE_TIMES: ReadonlySet<TimeOfDay> = new Set(["Noon", "Afternoon", "Sunset"]);

/**
 * How a geography bends its climate. Every field is optional; the
 * defaults (no change) are in `traitsOf`.
 * - elevation: °C added to temperatures (height cools: ~6.5 °C per 1,000 m).
 * - maritime: 0–1, how much nearby water evens out the temperature and adds humidity.
 * - wet: multiplies the chance of precipitation (forests and slopes wetter, deserts drier).
 * - diurnal: multiplies the gap between the day's low and high (dry, open ground swings more).
 * - wind: multiplies the wind (exposed coasts and peaks windier, forests and canyons calmer).
 * - fog: multiplies the chance of fog and mist.
 * - funnel: terrain that channels wind into stronger gusts.
 */
export interface GeographyTraits {
  elevation?: number;
  maritime?: number;
  wet?: number;
  diurnal?: number;
  wind?: number;
  fog?: number;
  funnel?: boolean;
  underground?: boolean;
  volcanic?: boolean;
  /** Loose sand or dust that strong wind lifts. */
  dusty?: boolean;
}

const COAST: GeographyTraits = { maritime: 1, wind: 1.35, fog: 1.4 };
const SHORE: GeographyTraits = { maritime: 0.9, wind: 1.3, fog: 1.3 };
const RIVER: GeographyTraits = { maritime: 0.2, fog: 1.4 };
const LAKE: GeographyTraits = { maritime: 0.4, fog: 1.4, wind: 1.1 };
const GORGE: GeographyTraits = { wind: 0.7, funnel: true, fog: 1.3, diurnal: 0.9 };
const OPEN: GeographyTraits = { wind: 1.3, diurnal: 1.1 };
const ARID: GeographyTraits = { wet: 0.25, diurnal: 1.4, fog: 0.1, dusty: true };
const FOREST: GeographyTraits = { wind: 0.6, diurnal: 0.85, fog: 1.2, wet: 1.1 };
const WETLAND: GeographyTraits = { wet: 1.3, fog: 2, maritime: 0.2, diurnal: 0.85 };
const ICE: GeographyTraits = { elevation: -10, wind: 1.5, wet: 0.6, fog: 0.8 };
const VOLCANIC: GeographyTraits = { volcanic: true, elevation: -2, wet: 0.9 };
const UNDERGROUND: GeographyTraits = { underground: true };

export const GEOGRAPHIES: Readonly<Record<string, GeographyTraits>> = {
  Coastal: COAST,
  Inland: {},
  Island: { ...COAST, maritime: 1, wind: 1.45 },
  Archipelago: { ...COAST, wind: 1.4 },
  Peninsula: COAST,
  Isthmus: { ...COAST, wind: 1.45 },
  Cape: { ...COAST, wind: 1.6 },
  Bay: { ...COAST, wind: 1.1 },
  Gulf: { ...COAST, wind: 1.15 },
  Strait: { ...COAST, wind: 1.55, funnel: true },
  Fjord: { maritime: 0.8, wind: 1, funnel: true, fog: 1.6, wet: 1.3, elevation: -1 },
  Beach: { ...SHORE, dusty: true },
  "Rocky Shore": SHORE,
  "Coastal Cliff": { ...SHORE, wind: 1.6, elevation: -1 },
  Dune: { ...ARID, maritime: 0.3, wind: 1.3 },
  "Tidal Flat": { ...SHORE, fog: 1.6 },
  Estuary: { maritime: 0.8, fog: 1.6, wind: 1.2 },
  Delta: { maritime: 0.7, fog: 1.6, wet: 1.15, wind: 1.1 },
  Lagoon: { maritime: 0.9, fog: 1.3, wind: 1.1 },
  River: RIVER,
  Riverside: RIVER,
  "River Valley": { ...RIVER, wind: 0.8, fog: 1.6 },
  Floodplain: { ...RIVER, wet: 1.1, wind: 1.1 },
  Lake: LAKE,
  Lakeside: LAKE,
  Basin: { diurnal: 1.15, wind: 0.85, fog: 1.3 },
  Watershed: { wet: 1.1 },
  Spring: { fog: 1.2 },
  Oasis: { ...ARID, fog: 0.3, wet: 0.3, dusty: true },
  Waterfall: { fog: 1.8, wind: 0.9 },
  Rapids: { fog: 1.3, funnel: true },
  Canyon: { ...GORGE, diurnal: 1.2, wet: 0.8 },
  Gorge: GORGE,
  Ravine: GORGE,
  Valley: { wind: 0.8, fog: 1.6, diurnal: 1.1 },
  Mountain: { elevation: -8, wind: 1.6, wet: 1.3, fog: 1.2, funnel: true },
  "Mountain Range": { elevation: -10, wind: 1.6, wet: 1.35, fog: 1.2, funnel: true },
  Foothills: { elevation: -2, wet: 1.15, wind: 1.1 },
  Highland: { elevation: -4, wind: 1.3, wet: 1.15, fog: 1.3 },
  Plateau: { elevation: -5, wind: 1.3, diurnal: 1.2 },
  Mesa: { elevation: -2, wind: 1.3, diurnal: 1.25, wet: 0.7 },
  Hill: { elevation: -1, wind: 1.15 },
  Plain: OPEN,
  Lowland: { elevation: 1, fog: 1.2 },
  Steppe: { ...OPEN, wet: 0.7, diurnal: 1.2, dusty: true },
  Grassland: OPEN,
  Prairie: { ...OPEN, wet: 0.9 },
  Savanna: { ...OPEN, wet: 0.9, diurnal: 1.15 },
  Desert: ARID,
  "Semi-Desert": { wet: 0.5, diurnal: 1.25, fog: 0.3, dusty: true },
  Badlands: { wet: 0.5, diurnal: 1.3, wind: 1.2, fog: 0.3, dusty: true },
  "Salt Flat": { ...ARID, wet: 0.2, wind: 1.4 },
  Forest: FOREST,
  Woodland: { ...FOREST, wind: 0.75 },
  Rainforest: { wet: 1.35, wind: 0.4, diurnal: 0.9, fog: 1.6 },
  Jungle: { wet: 1.3, wind: 0.45, diurnal: 0.9, fog: 1.5 },
  Taiga: { ...FOREST, elevation: -1 },
  Tundra: { wind: 1.35, wet: 0.7, diurnal: 1.1 },
  Shrubland: { wet: 0.8, diurnal: 1.15 },
  Heathland: { wind: 1.25, fog: 1.3 },
  Moorland: { wind: 1.35, fog: 1.6, wet: 1.2, elevation: -1 },
  Wetland: WETLAND,
  Marsh: WETLAND,
  Swamp: { ...WETLAND, wind: 0.6 },
  Bog: { ...WETLAND, wind: 1.1 },
  Fen: WETLAND,
  Mangrove: { ...WETLAND, maritime: 0.8, wind: 0.7 },
  Glacier: ICE,
  "Ice Sheet": { ...ICE, elevation: -15, wind: 1.45 },
  Icefield: ICE,
  Volcano: { ...VOLCANIC, elevation: -6, wind: 1.4, wet: 1.1 },
  "Volcanic Plain": { ...VOLCANIC, elevation: 0, wind: 1.2, dusty: true },
  "Lava Field": { ...VOLCANIC, elevation: 1, diurnal: 1.3, wet: 0.8, dusty: true },
  Crater: { ...VOLCANIC, wind: 0.8 },
  Caldera: { ...VOLCANIC, elevation: -3, wind: 0.9, fog: 1.3 },
  Cave: UNDERGROUND,
  Cavern: UNDERGROUND,
  Karst: { wet: 1.05, fog: 1.2 },
  Sinkhole: { wind: 0.5, fog: 1.4, diurnal: 0.8 },
  "Underground Lake": UNDERGROUND,
  "Underground River": UNDERGROUND,
};
export type Geography = keyof typeof GEOGRAPHIES;
export const GEOGRAPHY_NAMES = Object.keys(GEOGRAPHIES);

export type Choice<T> = T | "random";

export interface WeatherOptions {
  climate: Choice<Climate>;
  geography: Choice<Geography>;
  season: Choice<Season>;
  /** The day's low and high in °C; null leaves them to the climate. */
  minTemp: number | null;
  maxTemp: number | null;
}

export const DEFAULT_WEATHER_OPTIONS: WeatherOptions = {
  climate: "Temperate",
  geography: "Inland",
  season: "random",
  minTemp: null,
  maxTemp: null,
};
