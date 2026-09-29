import { defineFieldSet, link } from "../info-fields";
import { ANY_ARTICLE, CREATURE_SIZES, DISTRIBUTION_GROUP, distributionFields, existenceStatus } from "./nature";

export const FAUNA_INFO = defineFieldSet(
  [
    { key: "appearance", label: "Appearance" },
    { key: "behavior", label: "Behavior" },
    { key: "classification", label: "Classification" },
    DISTRIBUTION_GROUP,
    { key: "ecology", label: "Ecology" },
    { key: "external", label: "External" },
    { key: "lifeCycle", label: "Life Cycle" },
    { key: "peopleAndUses", label: "People & Uses" },
  ],
  [
    // Appearance
    {
      key: "anatomyAndAppearance",
      label: "Anatomy & Appearance",
      group: "appearance",
      kind: "text",
      hint: "What it looks like: body shape, limbs, fur, scales or feathers? Anything a hunter would recognize at a glance.",
    },
    { key: "coloration", label: "Coloration", group: "appearance", kind: "text", hint: "Its colors and markings. Does it blend in, warn off, or change with the seasons?" },
    { key: "size", label: "Size", group: "appearance", kind: "select", options: CREATURE_SIZES, hint: "Its size category. Decides the space it takes and what it can carry or swallow." },
    { key: "typicalHeight", label: "Typical Height", group: "appearance", kind: "text", hint: "How tall (or long) a grown adult is." },
    { key: "typicalWeight", label: "Typical Weight", group: "appearance", kind: "text", hint: "How much a grown adult weighs. Handy when someone tries to carry one." },
    // Behavior
    {
      key: "activityCycle",
      label: "Activity Cycle",
      group: "behavior",
      kind: "select",
      multiple: true,
      options: ["Diurnal", "Nocturnal", "Crepuscular", "Irregular", "Seasonal", "Unknown"],
      hint: "When it's awake and about. Decides whether the night watch hears it.",
    },
    { key: "diet", label: "Diet", group: "behavior", kind: "text", hint: "What it eats, and how it gets it: grazing, hunting, scavenging?" },
    { key: "seasonalBehavior", label: "Seasonal Behavior", group: "behavior", kind: "text", hint: "What changes with the seasons: migration, hibernation, mating displays, molting?" },
    { key: "socialStructure", label: "Social Structure", group: "behavior", kind: "text", hint: "Solitary, pairs, herds, packs or colonies? How big a group the party runs into." },
    { key: "temperament", label: "Temperament", group: "behavior", kind: "text", hint: "How it reacts to people: skittish, curious, territorial, aggressive?" },
    // Classification
    existenceStatus("classification"),
    {
      key: "animalGroup",
      label: "Animal Group",
      group: "classification",
      kind: "select",
      options: ["Mammal", "Bird", "Reptile", "Amphibian", "Fish", "Arthropod", "Mollusk", "Other", "Unknown"],
      hint: "The broad kind of animal it is.",
    },
    { key: "relatedSpecies", label: "Related Species", group: "classification", kind: "link", link: link(ANY_ARTICLE, true), hint: "Close relatives: wild cousins, domestic breeds, monstrous offshoots." },
    // Distribution & Habitat
    ...distributionFields("animal"),
    // Ecology
    { key: "ecologicalRole", label: "Ecological Role", group: "ecology", kind: "text", hint: "What it does for its surroundings: grazer, pollinator, apex predator, scavenger?" },
    { key: "predators", label: "Predators", group: "ecology", kind: "link", link: link(ANY_ARTICLE, true), hint: "What hunts it. Where there's prey, there may be something bigger nearby." },
    {
      key: "preyAndFoodSources",
      label: "Prey & Food Sources",
      group: "ecology",
      kind: "link",
      link: link(ANY_ARTICLE, true),
      hint: "The animals and plants it lives on.",
    },
    // Life Cycle
    { key: "lifespan", label: "Lifespan", group: "lifeCycle", kind: "text", hint: "How long it usually lives, in the wild and in captivity." },
    { key: "reproduction", label: "Reproduction", group: "lifeCycle", kind: "text", hint: "How it breeds and raises its young: eggs, litters, nests, a mating season?" },
    // People & Uses
    {
      key: "culturalSignificance",
      label: "Cultural Significance",
      group: "peopleAndUses",
      kind: "text",
      hint: "What it means to people: a sacred animal, a heraldic beast, an omen, a children's tale?",
    },
    { key: "domestication", label: "Domestication", group: "peopleAndUses", kind: "text", hint: "Whether it can be tamed, bred, ridden or trained, and who does it." },
    {
      key: "productsAndUses",
      label: "Products & Uses",
      group: "peopleAndUses",
      kind: "text",
      hint: "What people take from it: meat, hide, milk, feathers, venom, labor? Worth coin at the market.",
    },
    { key: "risksToPeople", label: "Risks to People", group: "peopleAndUses", kind: "text", hint: "How it can hurt people: bites, disease, crop raids, stampedes?" },
    // External
    {
      key: "characterSheet",
      label: "Link to Character Sheet",
      group: "external",
      kind: "url",
      hint: "A web address for its stat block (D&D Beyond, a homebrew page, a shared sheet), to open it at the table.",
    },
  ],
  // Required, in this order.
  ["animalGroup"]
);
