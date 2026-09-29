import { defineFieldSet, link } from "../info-fields";
import { ANY_ARTICLE, DISTRIBUTION_GROUP, distributionFields, existenceStatus } from "./nature";

export const FLORA_INFO = defineFieldSet(
  [
    { key: "appearance", label: "Appearance" },
    { key: "classification", label: "Classification" },
    { key: "cultivationAndUses", label: "Cultivation & Uses" },
    DISTRIBUTION_GROUP,
    { key: "ecology", label: "Ecology" },
    { key: "lifeCycle", label: "Life Cycle" },
    { key: "properties", label: "Properties" },
  ],
  [
    // Appearance
    {
      key: "identifyingFeatures",
      label: "Identifying Features",
      group: "appearance",
      kind: "text",
      hint: "How to tell it apart: leaves, bark, flowers, scent? What a Nature check would pick up on.",
    },
    { key: "seasonalAppearance", label: "Seasonal Appearance", group: "appearance", kind: "text", hint: "How it looks through the year: blossoms, fruit, bare branches, dormant bulbs?" },
    { key: "sizeAndGrowthShape", label: "Size & Growth Shape", group: "appearance", kind: "text", hint: "How big it gets and how it grows: towering, sprawling, climbing, underground?" },
    // Classification
    existenceStatus("classification"),
    {
      key: "plantOrFungusGroup",
      label: "Plant or Fungus Group",
      group: "classification",
      kind: "select",
      multiple: true,
      options: ["Tree", "Shrub", "Herb", "Grass", "Vine", "Fern", "Moss", "Succulent", "Aquatic Plant", "Fungus", "Other"],
      hint: "The kinds of plant or fungus it is. Pick more than one for in-betweens, like a vine that grows into a tree.",
    },
    { key: "relatedSpecies", label: "Related Species", group: "classification", kind: "link", link: link(ANY_ARTICLE, true), hint: "Close relatives: wild cousins, cultivated varieties, ancestral forms." },
    {
      key: "type",
      label: "Type",
      group: "classification",
      kind: "select",
      options: ["Mundane", "Magical", "Unknown"],
      hint: "Whether it's an ordinary plant or carries magic. Magical ones are what herbalists and alchemists hunt for.",
    },
    // Cultivation & Uses
    {
      key: "culturalSignificance",
      label: "Cultural Significance",
      group: "cultivationAndUses",
      kind: "text",
      hint: "What it means to people: a sacred tree, a wedding flower, a plant no one dares to cut?",
    },
    { key: "cultivation", label: "Cultivation", group: "cultivationAndUses", kind: "text", hint: "Whether and how people grow it: fields, gardens, greenhouses, secret groves?" },
    {
      key: "harvestingAndStorage",
      label: "Harvesting & Storage",
      group: "cultivationAndUses",
      kind: "text",
      hint: "When and how the useful parts are gathered, prepared and kept. A harvest at midnight makes a good errand.",
    },
    {
      key: "productsAndUses",
      label: "Products & Uses",
      group: "cultivationAndUses",
      kind: "text",
      hint: "What people make from it: food, timber, cloth, dye, perfume, fuel? Worth coin at the market.",
    },
    // Distribution & Habitat
    ...distributionFields("plant"),
    // Ecology
    {
      key: "associatedOrganisms",
      label: "Associated Organisms",
      group: "ecology",
      kind: "link",
      link: link(ANY_ARTICLE, true),
      hint: "What lives with it: pollinators, grazers, parasites, partners, or the creature that guards it.",
    },
    { key: "ecologicalRole", label: "Ecological Role", group: "ecology", kind: "text", hint: "What it does for its surroundings: shelter, food, holding the soil, choking out rivals?" },
    { key: "growingConditions", label: "Growing Conditions", group: "ecology", kind: "text", hint: "What it needs to grow: soil, water, sunlight, altitude, or something stranger like moonlight or graves." },
    // Life Cycle
    { key: "growthAndLifespan", label: "Growth & Lifespan", group: "lifeCycle", kind: "text", hint: "How fast it grows, when it matures and how long it lives." },
    { key: "reproductionAndSpread", label: "Reproduction & Spread", group: "lifeCycle", kind: "text", hint: "How it spreads: seeds, spores, runners, cuttings, or something supernatural?" },
    { key: "seasonalCycle", label: "Seasonal Cycle", group: "lifeCycle", kind: "text", hint: "When it flowers, fruits, releases spores or goes dormant, in your world's calendar." },
    // Properties
    { key: "edibility", label: "Edibility", group: "properties", kind: "text", hint: "Which parts can be eaten, and how they must be prepared. Useful when rations run out." },
    { key: "hazards", label: "Hazards", group: "properties", kind: "text", hint: "How it can hurt people: poison, burning sap, thorns, choking spores?" },
    {
      key: "medicinalAndAlchemicalProperties",
      label: "Medicinal & Alchemical Properties",
      group: "properties",
      kind: "text",
      hint: "The remedies, potions and reagents made from it, and what they do.",
    },
    {
      key: "supernaturalProperties",
      label: "Supernatural Properties",
      group: "properties",
      kind: "text",
      hint: "Its magic, and what sets it off: glowing at night, whispering, blooming only near the dead?",
    },
  ],
  // Required, in this order.
  ["plantOrFungusGroup", "type"]
);
