import type { SOCIAL_BACKGROUNDS } from "@/server/articles/info-sets/character";

/** Species of the name collections; unrelated to the world's Species articles. */
export const SPECIES = [
  { key: "human", label: "Human" },
  { key: "elf", label: "Elf" },
  { key: "gnome", label: "Gnome" },
  { key: "tiefling", label: "Tiefling" },
  { key: "halfling", label: "Halfling" },
  { key: "orc", label: "Orc" },
  { key: "dragonborn", label: "Dragonborn" },
  { key: "dwarf", label: "Dwarf" },
] as const;
export type Species = (typeof SPECIES)[number]["key"];

export const GENDERS = ["Male", "Female"] as const;
export type Gender = (typeof GENDERS)[number];

/** A subset of the Character article's Social Background options, so it fills that field as is. */
export const BACKGROUNDS = [
  "Acolyte",
  "Artisan",
  "Charlatan",
  "Criminal",
  "Entertainer",
  "Farmer",
  "Guard",
  "Guide",
  "Hermit",
  "Merchant",
  "Noble",
  "Sage",
  "Sailor",
  "Scribe",
  "Soldier",
  "Wayfarer",
] as const satisfies readonly (typeof SOCIAL_BACKGROUNDS)[number][];
export type Background = (typeof BACKGROUNDS)[number];

export const MALE_HAIRSTYLES = [
  "Shaved Head", "Buzz Cut", "Crew Cut", "Short Crop", "Caesar Cut", "Side Part", "Slicked Back", "Undercut",
  "Bowl Cut", "Short Curls", "Wavy Hair", "Shoulder-Length Hair", "Long Straight Hair", "Long Curls", "Ponytail",
  "Half-Up Ponytail", "Topknot", "Bun", "Single Braid", "Twin Braids", "Cornrows", "Locs", "Mohawk",
];

export const FEMALE_HAIRSTYLES = [
  "Shaved Head", "Buzz Cut", "Pixie Cut", "Bob Cut", "Long Bob", "Shoulder-Length Hair", "Long Straight Hair",
  "Long Wavy Hair", "Long Curls", "Layered Hair", "Bangs", "Side-Swept Bangs", "Ponytail", "High Ponytail",
  "Low Ponytail", "Twin Ponytails", "Half-Up Hair", "Bun", "Low Bun", "Braided Bun", "Single Braid", "Twin Braids",
  "Crown Braid", "French Braid", "Fishtail Braid", "Cornrows", "Locs", "Updo",
];

export const BEARDS = [
  "Clean-Shaven", "Light Stubble", "Heavy Stubble", "Short Beard", "Full Beard", "Long Beard", "Rounded Beard",
  "Square Beard", "Pointed Beard", "Forked Beard", "Braided Beard", "Twin-Braided Beard", "Goatee", "Extended Goatee",
  "Van Dyke", "Balbo", "Anchor Beard", "Circle Beard", "Chinstrap", "Chin Curtain", "Mutton Chops",
  "Friendly Mutton Chops", "Soul Patch", "Mustache", "Handlebar Mustache", "Chevron Mustache", "Walrus Mustache",
  "Pencil Mustache", "Horseshoe Mustache",
];

const BASE_HAIR_COLORS = [
  "Black", "Dark Brown", "Brown", "Chestnut", "Auburn", "Copper", "Red", "Strawberry Blonde", "Golden Blonde",
  "Ash Blonde", "Platinum Blonde", "Grey", "Salt-and-Pepper", "Silver", "White",
];

/** A few extra shades some species are known for, on top of the base colors. */
const SPECIES_HAIR_COLORS: Partial<Record<Species, string[]>> = {
  elf: ["Silver-Blue", "Moonlit White", "Deep Green"],
  gnome: ["Moss Green", "Bright Orange", "Sky Blue"],
  tiefling: ["Deep Purple", "Midnight Blue", "Crimson", "Ink Black"],
  orc: ["Iron Grey", "Coal Black"],
};

export function hairColorsFor(species: Species): string[] {
  return [...BASE_HAIR_COLORS, ...(SPECIES_HAIR_COLORS[species] ?? [])];
}

/** Dragonborn are scaled: no hair or beard is generated for them. */
export const HAIRLESS_SPECIES: ReadonlySet<Species> = new Set(["dragonborn"]);

export type Choice<T> = T | "random";

export interface GenerateOptions {
  gender: Choice<Gender>;
  species: Choice<Species>;
  background: Choice<Background> | "none";
  middleName: "random" | "always" | "never";
  hair: boolean;
  /** Which genders get a beard. */
  beard: "male" | "female" | "both" | "none";
  /** Clothes, a current want, a quirk, a fear and a secret. */
  backstory: boolean;
}

export const DEFAULT_OPTIONS: GenerateOptions = {
  gender: "random",
  species: "human",
  background: "random",
  middleName: "random",
  hair: true,
  beard: "male",
  backstory: true,
};

/** Chance of a middle name when the option is "random". */
export const MIDDLE_NAME_CHANCE = 0.35;
