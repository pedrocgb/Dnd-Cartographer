import {
  BACKGROUNDS,
  BEARDS,
  FEMALE_HAIRSTYLES,
  GENDERS,
  HAIRLESS_SPECIES,
  MALE_HAIRSTYLES,
  MIDDLE_NAME_CHANCE,
  SPECIES,
  hairColorsFor,
  type Background,
  type Gender,
  type GenerateOptions,
  type Species,
} from "./options";
import type { NameCollection } from "./parse-names";
import { generateBackstory, type Backstory } from "./backstory";
import type { Rng } from "./backstory/grammar";

export type { Rng };

export interface GeneratedCharacter {
  name: string;
  firstName: string;
  middleName: string | null;
  surname: string;
  gender: Gender;
  species: Species;
  background: Background | null;
  hairstyle: string | null;
  hairColor: string | null;
  beard: string | null;
  backstory: Backstory | null;
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/** Resolves a "random" species choice; the name pool must be loaded for it before generating. */
export function resolveSpecies(choice: GenerateOptions["species"], rng: Rng = Math.random): Species {
  return choice === "random" ? pick(SPECIES, rng).key : choice;
}

/**
 * Rolls a character from the options. `species` must already be resolved
 * (see resolveSpecies) and `names` must be that species' collection.
 */
export function generateCharacter(opts: GenerateOptions & { species: Species }, names: NameCollection, rng: Rng = Math.random): GeneratedCharacter {
  const { species } = opts;
  const gender = opts.gender === "random" ? pick(GENDERS, rng) : opts.gender;
  const male = gender === "Male";
  const background = opts.background === "none" ? null : opts.background === "random" ? pick(BACKGROUNDS, rng) : opts.background;

  const firstName = pick(male ? names.male : names.female, rng);
  const surname = pick(names.surname, rng);
  const wantsMiddle = opts.middleName === "always" || (opts.middleName === "random" && rng() < MIDDLE_NAME_CHANCE);
  const middlePool = [...names.middle.any, ...(male ? names.middle.male : names.middle.female)];
  const middleName = wantsMiddle && middlePool.length ? pick(middlePool, rng) : null;
  const given = [firstName, middleName].filter(Boolean).join(" ");
  // Dragonborn put their clan name first.
  const name = species === "dragonborn" ? `${surname} ${given}` : `${given} ${surname}`;

  const hairless = HAIRLESS_SPECIES.has(species);
  const withHair = opts.hair && !hairless;
  const withBeard = !hairless && (opts.beard === "both" || opts.beard === (male ? "male" : "female"));

  return {
    name,
    firstName,
    middleName,
    surname,
    gender,
    species,
    background,
    hairstyle: withHair ? pick(male ? MALE_HAIRSTYLES : FEMALE_HAIRSTYLES, rng) : null,
    hairColor: withHair ? pick(hairColorsFor(species), rng) : null,
    beard: withBeard ? pick(BEARDS, rng) : null,
    backstory: opts.backstory ? generateBackstory(background, gender, rng) : null,
  };
}
