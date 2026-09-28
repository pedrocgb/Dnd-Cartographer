/**
 * Stable, app-owned icon keys mapped to a Lucide export name. Stored data
 * (markers.icon_key) references these keys, never a Lucide name directly —
 * if Lucide renames/removes an export, only this file's `lucide` value
 * needs to change, and every saved marker keeps working.
 */
/** Picker sections, in display order. */
export const ICON_GROUPS = ["Settlements", "Structures", "Nature", "Creatures", "Travel", "Adventure", "Combat", "Services", "Magic", "Danger", "Shapes"] as const;
export type IconGroup = (typeof ICON_GROUPS)[number];

export interface IconDefinition {
  key: string;
  lucide: string;
  label: string;
  group: IconGroup;
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
  // Settlements
  { key: "houses", lucide: "Houses", label: "Hamlet / small town", group: "Settlements", synonyms: ["hamlet", "town", "houses"] },
  { key: "map-pin-house", lucide: "MapPinHouse", label: "Homestead / hometown", group: "Settlements", synonyms: ["homestead", "hometown", "birthplace"] },
  { key: "tent-tree", lucide: "TentTree", label: "Forest camp", group: "Settlements", synonyms: ["camp", "outpost", "ranger"] },
  { key: "caravan", lucide: "Caravan", label: "Caravan / travelling folk", group: "Settlements", synonyms: ["caravan", "nomads", "travellers"] },
  { key: "birdhouse", lucide: "Birdhouse", label: "Hut / hermitage", group: "Settlements", synonyms: ["hut", "hermit", "cabin"] },
  // Structures
  { key: "tower-control", lucide: "TowerControl", label: "Watchtower", group: "Structures", synonyms: ["tower", "watchtower", "lookout"] },
  { key: "lighthouse", lucide: "Lighthouse", label: "Lighthouse / beacon", group: "Structures", synonyms: ["lighthouse", "beacon"] },
  { key: "bridge", lucide: "Bridge", label: "Bridge", group: "Structures", synonyms: ["bridge", "crossing"] },
  { key: "brick-wall", lucide: "BrickWall", label: "Wall / fortification", group: "Structures", synonyms: ["wall", "rampart", "barrier"] },
  { key: "fence", lucide: "Fence", label: "Farm / enclosure", group: "Structures", synonyms: ["farm", "ranch", "pasture"] },
  { key: "pyramid", lucide: "Pyramid", label: "Pyramid / ziggurat", group: "Structures", synonyms: ["pyramid", "ziggurat", "tomb"] },
  { key: "mosque", lucide: "Mosque", label: "Domed temple", group: "Structures", synonyms: ["temple", "dome", "sanctuary"] },
  { key: "vault", lucide: "Vault", label: "Vault / treasury", group: "Structures", synonyms: ["vault", "treasury", "bank"] },
  { key: "warehouse", lucide: "Warehouse", label: "Warehouse / granary", group: "Structures", synonyms: ["warehouse", "granary", "storehouse"] },
  { key: "university", lucide: "University", label: "University / great hall", group: "Structures", synonyms: ["university", "hall", "senate"] },
  { key: "school", lucide: "School", label: "School / college", group: "Structures", synonyms: ["school", "college"] },
  { key: "hospital", lucide: "Hospital", label: "Healer's house / hospice", group: "Structures", synonyms: ["healer", "hospital", "infirmary"] },
  { key: "hotel", lucide: "Hotel", label: "Lodge / guesthouse", group: "Structures", synonyms: ["lodge", "guesthouse", "hostel"] },
  { key: "factory", lucide: "Factory", label: "Workshop district / mill", group: "Structures", synonyms: ["factory", "mill", "industry"] },
  { key: "door-closed-locked", lucide: "DoorClosedLocked", label: "Sealed door", group: "Structures", synonyms: ["sealed", "locked", "secret door"] },
  { key: "radio-tower", lucide: "RadioTower", label: "Signal tower / spire", group: "Structures", synonyms: ["spire", "signal", "tower"] },
  { key: "chess-rook", lucide: "ChessRook", label: "Keep / tower", group: "Structures", synonyms: ["keep", "rook", "tower"] },
  // Nature
  { key: "tree-pine", lucide: "TreePine", label: "Pine forest / taiga", group: "Nature", synonyms: ["pine", "taiga", "conifer"] },
  { key: "tree-deciduous", lucide: "TreeDeciduous", label: "Lone tree / old oak", group: "Nature", synonyms: ["tree", "oak", "grove"] },
  { key: "tree-palm", lucide: "TreePalm", label: "Oasis / tropical coast", group: "Nature", synonyms: ["oasis", "palm", "tropical", "jungle"] },
  { key: "shrub", lucide: "Shrub", label: "Scrubland / heath", group: "Nature", synonyms: ["scrub", "heath", "bush"] },
  { key: "sprout", lucide: "Sprout", label: "Fertile land / garden", group: "Nature", synonyms: ["garden", "fertile", "growth"] },
  { key: "leaf", lucide: "Leaf", label: "Herbs / druid grove", group: "Nature", synonyms: ["herb", "druid", "leaf"] },
  { key: "flower", lucide: "Flower", label: "Meadow / flower field", group: "Nature", synonyms: ["meadow", "flower", "field"] },
  { key: "clover", lucide: "Clover", label: "Fey glade / lucky place", group: "Nature", synonyms: ["fey", "glade", "luck"] },
  { key: "wheat", lucide: "Wheat", label: "Farmland / fields", group: "Nature", synonyms: ["farm", "fields", "harvest", "grain"] },
  { key: "grape", lucide: "Grape", label: "Vineyard", group: "Nature", synonyms: ["vineyard", "wine", "grapes"] },
  { key: "apple", lucide: "Apple", label: "Orchard", group: "Nature", synonyms: ["orchard", "fruit"] },
  { key: "hop", lucide: "Hop", label: "Hop fields / brewery", group: "Nature", synonyms: ["hops", "brewery"] },
  { key: "mountain-snow", lucide: "MountainSnow", label: "Snowy peak / glacier", group: "Nature", synonyms: ["snow", "glacier", "peak", "alpine"] },
  { key: "land-plot", lucide: "LandPlot", label: "Territory / claimed land", group: "Nature", synonyms: ["territory", "claim", "plot", "border"] },
  { key: "droplet", lucide: "Droplet", label: "Spring / well", group: "Nature", synonyms: ["spring", "well", "water source"] },
  { key: "droplets", lucide: "Droplets", label: "Swamp / marsh", group: "Nature", synonyms: ["swamp", "marsh", "bog", "wetland"] },
  { key: "waves-vertical", lucide: "WavesVertical", label: "Waterfall / rapids", group: "Nature", synonyms: ["waterfall", "rapids", "falls"] },
  { key: "shell", lucide: "Shell", label: "Beach / reef", group: "Nature", synonyms: ["beach", "reef", "shore"] },
  { key: "snowflake", lucide: "Snowflake", label: "Frozen land / tundra", group: "Nature", synonyms: ["ice", "tundra", "frozen", "cold"] },
  { key: "sun", lucide: "Sun", label: "Desert / scorched land", group: "Nature", synonyms: ["desert", "heat", "sun", "dunes"] },
  { key: "wind", lucide: "Wind", label: "Windswept pass / storms", group: "Nature", synonyms: ["wind", "gale", "pass"] },
  { key: "tornado", lucide: "Tornado", label: "Storm / maelstrom", group: "Nature", synonyms: ["storm", "maelstrom", "whirlwind"] },
  { key: "cloud-lightning", lucide: "CloudLightning", label: "Thunder peaks / tempest", group: "Nature", synonyms: ["thunder", "lightning", "tempest"] },
  { key: "cloud-fog", lucide: "CloudFog", label: "Misty land / fog", group: "Nature", synonyms: ["fog", "mist", "haze"] },
  { key: "rainbow", lucide: "Rainbow", label: "Rainbow / blessed vale", group: "Nature", synonyms: ["rainbow", "blessed", "vale"] },
  { key: "earth", lucide: "Earth", label: "Region / world", group: "Nature", synonyms: ["world", "region", "continent"] },
  // Creatures
  { key: "paw-print", lucide: "PawPrint", label: "Beast tracks / hunting ground", group: "Creatures", synonyms: ["beast", "tracks", "hunting", "monster"] },
  { key: "bird", lucide: "Bird", label: "Birds / aerie", group: "Creatures", synonyms: ["bird", "aerie", "roost", "griffon"] },
  { key: "feather", lucide: "Feather", label: "Roost / nesting site", group: "Creatures", synonyms: ["nest", "roost", "harpy"] },
  { key: "fish", lucide: "Fish", label: "Fishing ground", group: "Creatures", synonyms: ["fish", "fishing"] },
  { key: "fish-symbol", lucide: "FishSymbol", label: "Sea creature / leviathan", group: "Creatures", synonyms: ["leviathan", "sea monster", "kraken"] },
  { key: "rabbit", lucide: "Rabbit", label: "Game / wildlife", group: "Creatures", synonyms: ["game", "wildlife", "hare"] },
  { key: "squirrel", lucide: "Squirrel", label: "Woodland creatures", group: "Creatures", synonyms: ["woodland", "critters"] },
  { key: "rat", lucide: "Rat", label: "Vermin / plague", group: "Creatures", synonyms: ["rat", "vermin", "plague", "sewer"] },
  { key: "bug", lucide: "Bug", label: "Insect swarm / hive", group: "Creatures", synonyms: ["insect", "swarm", "hive", "spider"] },
  { key: "worm", lucide: "Worm", label: "Burrower / wyrm", group: "Creatures", synonyms: ["worm", "wyrm", "burrow", "purple worm"] },
  { key: "snail", lucide: "Snail", label: "Slow creature / ooze", group: "Creatures", synonyms: ["snail", "ooze", "slime"] },
  { key: "turtle", lucide: "Turtle", label: "Giant turtle / island beast", group: "Creatures", synonyms: ["turtle", "tortoise", "dragon turtle"] },
  { key: "cat", lucide: "Cat", label: "Big cat / familiar", group: "Creatures", synonyms: ["cat", "lion", "familiar"] },
  { key: "dog", lucide: "Dog", label: "Wolves / kennels", group: "Creatures", synonyms: ["wolf", "hound", "kennel"] },
  { key: "egg", lucide: "Egg", label: "Nest / hatchery", group: "Creatures", synonyms: ["egg", "nest", "hatchery", "dragon egg"] },
  { key: "bone", lucide: "Bone", label: "Bones / remains", group: "Creatures", synonyms: ["bones", "remains", "fossil"] },
  { key: "chess-knight", lucide: "ChessKnight", label: "Stables / cavalry", group: "Creatures", synonyms: ["horse", "stables", "cavalry", "knight"] },
  // Travel
  { key: "map", lucide: "Map", label: "Map / region", group: "Travel", synonyms: ["map", "region", "atlas"] },
  { key: "map-pinned", lucide: "MapPinned", label: "Destination", group: "Travel", synonyms: ["destination", "goal"] },
  { key: "compass", lucide: "Compass", label: "Crossroads / navigation", group: "Travel", synonyms: ["compass", "crossroads", "navigation"] },
  { key: "signpost", lucide: "Signpost", label: "Signpost / junction", group: "Travel", synonyms: ["signpost", "junction", "fork"] },
  { key: "milestone", lucide: "Milestone", label: "Milestone / waystone", group: "Travel", synonyms: ["milestone", "waystone", "marker stone"] },
  { key: "route", lucide: "Route", label: "Road / trade route", group: "Travel", synonyms: ["road", "route", "trade route"] },
  { key: "waypoints", lucide: "Waypoints", label: "Waypoint network", group: "Travel", synonyms: ["waypoint", "network", "stations"] },
  { key: "flag", lucide: "Flag", label: "Flag / claimed site", group: "Travel", synonyms: ["flag", "claim", "banner"] },
  { key: "flag-triangle-right", lucide: "FlagTriangleRight", label: "Pennant / border post", group: "Travel", synonyms: ["pennant", "border", "outpost"] },
  { key: "ship", lucide: "Ship", label: "Ship / naval base", group: "Travel", synonyms: ["ship", "navy", "fleet"] },
  { key: "sailboat", lucide: "Sailboat", label: "Ferry / fishing boats", group: "Travel", synonyms: ["boat", "ferry", "sail"] },
  { key: "ship-wheel", lucide: "ShipWheel", label: "Shipyard / pirates", group: "Travel", synonyms: ["shipyard", "pirates", "helm"] },
  { key: "binoculars", lucide: "Binoculars", label: "Scouting post / vista", group: "Travel", synonyms: ["scout", "vista", "lookout", "view"] },
  { key: "telescope", lucide: "Telescope", label: "Observatory", group: "Travel", synonyms: ["observatory", "stars", "astronomy"] },
  { key: "backpack", lucide: "Backpack", label: "Adventurers' rest / supplies", group: "Travel", synonyms: ["supplies", "rest", "adventurers"] },
  { key: "flame-kindling", lucide: "FlameKindling", label: "Campfire / rest stop", group: "Travel", synonyms: ["campfire", "rest", "bonfire"] },
  // Adventure
  { key: "scroll", lucide: "Scroll", label: "Quest / lore", group: "Adventure", synonyms: ["quest", "lore", "legend"] },
  { key: "scroll-text", lucide: "ScrollText", label: "Decree / bounty board", group: "Adventure", synonyms: ["decree", "contract", "notice", "bounty"] },
  { key: "key", lucide: "Key", label: "Key / secret", group: "Adventure", synonyms: ["key", "secret", "unlock"] },
  { key: "lock", lucide: "Lock", label: "Locked area", group: "Adventure", synonyms: ["locked", "sealed", "forbidden"] },
  { key: "eye", lucide: "Eye", label: "Hidden / watched place", group: "Adventure", synonyms: ["hidden", "watched", "spy", "secret"] },
  { key: "hourglass", lucide: "Hourglass", label: "Timed event / ancient", group: "Adventure", synonyms: ["time", "timed", "ancient"] },
  { key: "puzzle", lucide: "Puzzle", label: "Puzzle / riddle", group: "Adventure", synonyms: ["puzzle", "riddle", "trial"] },
  { key: "dices", lucide: "Dices", label: "Random encounter / gambling", group: "Adventure", synonyms: ["dice", "random", "gambling", "encounter"] },
  { key: "trophy", lucide: "Trophy", label: "Arena / tournament", group: "Adventure", synonyms: ["arena", "tournament", "prize"] },
  { key: "medal", lucide: "Medal", label: "Honour / memorial", group: "Adventure", synonyms: ["honour", "memorial", "award"] },
  { key: "drama", lucide: "Drama", label: "Theatre / festival", group: "Adventure", synonyms: ["theatre", "festival", "carnival"] },
  { key: "venetian-mask", lucide: "VenetianMask", label: "Thieves' guild / intrigue", group: "Adventure", synonyms: ["thieves", "guild", "intrigue", "masquerade"] },
  { key: "chess-king", lucide: "ChessKing", label: "Court / seat of power", group: "Adventure", synonyms: ["court", "king", "power", "politics"] },
  { key: "handshake", lucide: "Handshake", label: "Alliance / meeting place", group: "Adventure", synonyms: ["alliance", "treaty", "meeting"] },
  { key: "target", lucide: "Target", label: "Objective / target", group: "Adventure", synonyms: ["objective", "target", "goal"] },
  // Combat
  { key: "sword", lucide: "Sword", label: "Duel / warriors' hall", group: "Combat", synonyms: ["sword", "duel", "warrior"] },
  { key: "shield", lucide: "Shield", label: "Garrison / defence", group: "Combat", synonyms: ["garrison", "defence", "guard"] },
  { key: "shield-half", lucide: "ShieldHalf", label: "Heraldry / knightly order", group: "Combat", synonyms: ["heraldry", "order", "knights"] },
  { key: "axe", lucide: "Axe", label: "Lumber camp / raiders", group: "Combat", synonyms: ["axe", "lumber", "raiders", "barbarian"] },
  { key: "bow-arrow", lucide: "BowArrow", label: "Archers / hunting lodge", group: "Combat", synonyms: ["bow", "archer", "hunter"] },
  { key: "crosshair", lucide: "Crosshair", label: "Ambush point", group: "Combat", synonyms: ["ambush", "sniper", "trap"] },
  { key: "hand-fist", lucide: "HandFist", label: "Rebellion / fighting pit", group: "Combat", synonyms: ["rebellion", "fight", "brawl"] },
  // Services
  { key: "wine", lucide: "Wine", label: "Winery / noble house", group: "Services", synonyms: ["wine", "winery", "noble"] },
  { key: "barrel", lucide: "Barrel", label: "Brewery / cellar", group: "Services", synonyms: ["barrel", "brewery", "cellar"] },
  { key: "amphora", lucide: "Amphora", label: "Pottery / ancient trade", group: "Services", synonyms: ["amphora", "pottery", "trade"] },
  { key: "coins", lucide: "Coins", label: "Mint / wealth", group: "Services", synonyms: ["coins", "mint", "gold", "money"] },
  { key: "hand-coins", lucide: "HandCoins", label: "Toll / tax collector", group: "Services", synonyms: ["toll", "tax", "customs"] },
  { key: "scale", lucide: "Scale", label: "Courthouse / law", group: "Services", synonyms: ["court", "law", "justice"] },
  { key: "gavel", lucide: "Gavel", label: "Auction / judgement", group: "Services", synonyms: ["auction", "judge", "trial"] },
  { key: "anvil", lucide: "Anvil", label: "Smithy / armoury", group: "Services", synonyms: ["smithy", "armoury", "blacksmith"] },
  { key: "shovel", lucide: "Shovel", label: "Dig site / excavation", group: "Services", synonyms: ["dig", "excavation", "grave digger"] },
  { key: "cooking-pot", lucide: "CookingPot", label: "Kitchen / cookhouse", group: "Services", synonyms: ["kitchen", "food", "cook"] },
  { key: "utensils", lucide: "Utensils", label: "Eatery / feast hall", group: "Services", synonyms: ["food", "feast", "eatery"] },
  { key: "bed", lucide: "Bed", label: "Resting place / inn rooms", group: "Services", synonyms: ["rest", "bed", "rooms"] },
  { key: "fishing-rod", lucide: "FishingRod", label: "Fishing village", group: "Services", synonyms: ["fishing", "angler"] },
  { key: "tractor", lucide: "Tractor", label: "Farmstead", group: "Services", synonyms: ["farm", "farmstead", "plough"] },
  { key: "library-big", lucide: "LibraryBig", label: "Archive / great library", group: "Services", synonyms: ["archive", "library", "records"] },
  { key: "book-marked", lucide: "BookMarked", label: "Scriptorium / records", group: "Services", synonyms: ["scriptorium", "records", "chronicle"] },
  { key: "shopping-basket", lucide: "ShoppingBasket", label: "Bazaar / food market", group: "Services", synonyms: ["bazaar", "food market", "stall"] },
  { key: "ship-cargo", lucide: "ShipCargo", label: "Trade harbour", group: "Services", synonyms: ["cargo", "trade", "harbour"] },
  // Magic
  { key: "wand-sparkles", lucide: "WandSparkles", label: "Wizard's tower / enchantment", group: "Magic", synonyms: ["wizard", "enchantment", "spell"] },
  { key: "flask-conical", lucide: "FlaskConical", label: "Alchemist / laboratory", group: "Magic", synonyms: ["alchemy", "alchemist", "laboratory", "potion"] },
  { key: "flask-round", lucide: "FlaskRound", label: "Potion shop", group: "Magic", synonyms: ["potion", "apothecary", "elixir"] },
  { key: "orbit", lucide: "Orbit", label: "Planar rift / astral site", group: "Magic", synonyms: ["plane", "rift", "astral", "portal"] },
  { key: "moon-star", lucide: "MoonStar", label: "Moon shrine / night magic", group: "Magic", synonyms: ["moon", "night", "lunar"] },
  { key: "star", lucide: "Star", label: "Star / notable place", group: "Magic", synonyms: ["star", "notable", "important"] },
  { key: "sun-moon", lucide: "SunMoon", label: "Eclipse / celestial site", group: "Magic", synonyms: ["eclipse", "celestial", "solstice"] },
  { key: "zap", lucide: "Zap", label: "Ley line / energy", group: "Magic", synonyms: ["ley line", "energy", "lightning"] },
  { key: "infinity", lucide: "Infinity", label: "Eternal / timeless place", group: "Magic", synonyms: ["eternal", "timeless", "infinite"] },
  { key: "atom", lucide: "Atom", label: "Arcane nexus", group: "Magic", synonyms: ["nexus", "arcane", "node"] },
  { key: "hexagon", lucide: "Hexagon", label: "Rune circle / ward", group: "Magic", synonyms: ["rune", "ward", "circle"] },
  { key: "pentagon", lucide: "Pentagon", label: "Summoning site / ritual", group: "Magic", synonyms: ["summoning", "pentacle", "ritual"] },
  { key: "brain", lucide: "Brain", label: "Psionic / mind lair", group: "Magic", synonyms: ["psionic", "mind", "illithid"] },
  { key: "dna", lucide: "Dna", label: "Aberration / mutation", group: "Magic", synonyms: ["aberration", "mutation", "experiment"] },
  { key: "origami", lucide: "Origami", label: "Illusion / trickery", group: "Magic", synonyms: ["illusion", "trick", "fey"] },
  { key: "heart", lucide: "Heart", label: "Sanctuary / healing", group: "Magic", synonyms: ["sanctuary", "healing", "love"] },
  { key: "heart-crack", lucide: "HeartCrack", label: "Cursed place / tragedy", group: "Magic", synonyms: ["curse", "cursed", "tragedy"] },
  { key: "cross", lucide: "Cross", label: "Holy site / grave", group: "Magic", synonyms: ["holy", "grave", "cleric"] },
  // Danger
  { key: "ghost", lucide: "Ghost", label: "Haunted place", group: "Danger", synonyms: ["haunted", "ghost", "spirit", "undead"] },
  { key: "biohazard", lucide: "Biohazard", label: "Blight / plague zone", group: "Danger", synonyms: ["blight", "plague", "corruption"] },
  { key: "radiation", lucide: "Radiation", label: "Wild magic / taint", group: "Danger", synonyms: ["wild magic", "taint", "radiation"] },
  { key: "bomb", lucide: "Bomb", label: "Explosives / siege works", group: "Danger", synonyms: ["bomb", "siege", "explosive"] },
  { key: "triangle-alert", lucide: "TriangleAlert", label: "Warning / hazard", group: "Danger", synonyms: ["warning", "hazard", "danger"] },
  { key: "octagon-alert", lucide: "OctagonAlert", label: "Forbidden zone", group: "Danger", synonyms: ["forbidden", "stop", "restricted"] },
  { key: "siren", lucide: "Siren", label: "Alarm / sirens' rocks", group: "Danger", synonyms: ["alarm", "siren", "alert"] },
  // Shapes: plain geometric glyphs for markers that only need a symbol
  { key: "shape-circle", lucide: "Circle", label: "Circle", group: "Shapes", synonyms: ["circle", "round", "ring"] },
  { key: "shape-circle-dot", lucide: "CircleDot", label: "Circle with dot", group: "Shapes", synonyms: ["circle", "dot", "bullseye"] },
  { key: "shape-square", lucide: "Square", label: "Square", group: "Shapes", synonyms: ["square", "box"] },
  { key: "shape-rectangle", lucide: "RectangleHorizontal", label: "Rectangle", group: "Shapes", synonyms: ["rectangle", "box"] },
  { key: "shape-triangle", lucide: "Triangle", label: "Triangle", group: "Shapes", synonyms: ["triangle", "delta"] },
  { key: "shape-diamond", lucide: "Diamond", label: "Diamond", group: "Shapes", synonyms: ["diamond", "rhombus", "lozenge"] },
  { key: "shape-pentagon", lucide: "Pentagon", label: "Pentagon", group: "Shapes", synonyms: ["pentagon"] },
  { key: "shape-hexagon", lucide: "Hexagon", label: "Hexagon", group: "Shapes", synonyms: ["hexagon", "hex"] },
  { key: "shape-octagon", lucide: "Octagon", label: "Octagon", group: "Shapes", synonyms: ["octagon"] },
  { key: "shape-star", lucide: "Star", label: "Star", group: "Shapes", synonyms: ["star"] },
  { key: "shape-heart", lucide: "Heart", label: "Heart", group: "Shapes", synonyms: ["heart"] },
  { key: "shape-spade", lucide: "Spade", label: "Spade", group: "Shapes", synonyms: ["spade", "card"] },
  { key: "shape-club", lucide: "Club", label: "Club", group: "Shapes", synonyms: ["club", "card"] },
  { key: "shape-plus", lucide: "Plus", label: "Plus", group: "Shapes", synonyms: ["plus", "cross"] },
  { key: "shape-x", lucide: "X", label: "X mark", group: "Shapes", synonyms: ["x", "cross", "mark"] },
  { key: "shape-asterisk", lucide: "Asterisk", label: "Asterisk", group: "Shapes", synonyms: ["asterisk", "star"] },
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

/** Icons whose label, key or synonyms contain the query (case-insensitive), in registry order. */
export function searchIcons(query: string): IconDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return ICONS;
  return ICONS.filter((i) => i.label.toLowerCase().includes(q) || i.key.includes(q) || i.synonyms.some((s) => s.includes(q)));
}

/** Icons split into their picker sections, empty sections left out. */
export function groupIcons(icons: IconDefinition[]): { group: IconGroup; icons: IconDefinition[] }[] {
  return ICON_GROUPS.map((group) => ({ group, icons: icons.filter((i) => i.group === group) })).filter((g) => g.icons.length > 0);
}
