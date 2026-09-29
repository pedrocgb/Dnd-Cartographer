import { link, optionsOf, type InfoField } from "../info-fields";
import { ARTICLE_TEMPLATE_KEYS } from "../templates";
import { GEOGRAPHY_INFO } from "./geography";

/**
 * Pieces shared by the Nature templates (Fauna, Flora, Monster): the
 * Existence Status and the Distribution & Habitat folder.
 */

export const ANY_ARTICLE = [...ARTICLE_TEMPLATE_KEYS];

/** Where Found In can point (they list it back in their Wildlife folder). */
export const HABITAT_PLACES = ["territory", "geography", "building"] as const;

export const CREATURE_SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan", "Undefined"];

export const DISTRIBUTION_GROUP = { key: "distribution", label: "Distribution & Habitat" };

export const existenceStatus = (group: string): InfoField => ({
  key: "existenceStatus",
  label: "Existence Status",
  group,
  kind: "select",
  options: ["Extant", "Extinct", "Possibly Extinct", "Unconfirmed", "Unknown"],
  hint: "Does it still exist? A creature everyone thinks extinct makes a fine rumor to chase.",
});

/** Distribution & Habitat. `what` names the entry in hints ("animal", "plant", "creature"). */
export function distributionFields(what: string): InfoField[] {
  const group = DISTRIBUTION_GROUP.key;
  return [
    {
      key: "abundance",
      label: "Abundance",
      group,
      kind: "select",
      options: ["Abundant", "Common", "Uncommon", "Rare", "Very Rare", "Unique", "Unknown"],
      hint: `How easy it is to come across this ${what}. Sets how often it shows up in encounters and markets.`,
    },
    {
      key: "biomes",
      label: "Biomes",
      group,
      kind: "select",
      multiple: true,
      options: optionsOf(GEOGRAPHY_INFO, "primaryBiome"),
      hint: `The kinds of landscape where this ${what} lives. Pick every one it's found in.`,
    },
    {
      key: "climates",
      label: "Climates",
      group,
      kind: "select",
      multiple: true,
      options: optionsOf(GEOGRAPHY_INFO, "climate"),
      hint: "The climates it can live in. Helps decide what the party meets on the road.",
    },
    {
      key: "distributionNotes",
      label: "Distribution Notes",
      group,
      kind: "text",
      hint: "How far it ranges and where it's thickest: seasonal migrations, isolated pockets, a single valley?",
    },
    {
      key: "foundIn",
      label: "Found In",
      group,
      kind: "link",
      link: link([...HABITAT_PLACES], true),
      relation: { type: "foundIn", side: "from" },
      hint: "Places where it lives: territories, geographic regions, even a single building. They list it back under their own Fauna, Flora or Monsters.",
    },
    {
      key: "habitatDescription",
      label: "Habitat Description",
      group,
      kind: "text",
      hint: `Where exactly it makes its home: treetops, riverbanks, old ruins? Tells the party where to look.`,
    },
  ];
}
