import { defineFieldSet, link, optionsOf } from "../info-fields";
import { ANY_ARTICLE, CREATURE_SIZES, DISTRIBUTION_GROUP, distributionFields, existenceStatus } from "./nature";
import { SPECIES_INFO } from "./species";

export const MONSTER_INFO = defineFieldSet(
  [
    { key: "appearance", label: "Appearance" },
    { key: "behavior", label: "Behavior" },
    { key: "classification", label: "Classification" },
    DISTRIBUTION_GROUP,
    { key: "external", label: "External" },
    { key: "historyAndLore", label: "History & Lore" },
    { key: "lifeCycle", label: "Life Cycle" },
    { key: "relationships", label: "Relationships" },
  ],
  [
    // Appearance
    {
      key: "distinctiveFeatures",
      label: "Distinctive Features",
      group: "appearance",
      kind: "text",
      hint: "What the party sees first: silhouette, texture, colors, the detail survivors always mention.",
    },
    { key: "size", label: "Size", group: "appearance", kind: "select", options: CREATURE_SIZES, hint: "Its size category. Decides the space it takes and what it can grapple or swallow." },
    { key: "typicalHeight", label: "Typical Height", group: "appearance", kind: "text", hint: "How tall (or long) it is." },
    { key: "typicalWeight", label: "Typical Weight", group: "appearance", kind: "text", hint: "How much it weighs. Matters for bridges, boats and trapdoors." },
    {
      key: "variationsAndForms",
      label: "Variations & Forms",
      group: "appearance",
      kind: "text",
      hint: "Regional variants, transformations or disguises. The form it takes when no one's looking?",
    },
    // Behavior
    { key: "communication", label: "Communication", group: "behavior", kind: "text", hint: "How it communicates: speech, mimicry, telepathy, signs? Can the party talk it down?" },
    {
      key: "feedingAndNeeds",
      label: "Feeding & Needs",
      group: "behavior",
      kind: "text",
      hint: "What it feeds on or needs: flesh, heat, memories, dreams, magic? A need is a weakness to exploit.",
    },
    {
      key: "intelligenceAndMotivations",
      label: "Intelligence & Motivations",
      group: "behavior",
      kind: "text",
      hint: "How clever it is and what it wants. Decides whether it's a beast to fight or a foe to outwit.",
    },
    { key: "socialBehavior", label: "Social Behavior", group: "behavior", kind: "text", hint: "Alone, in packs or in colonies? Who leads, and how it treats its own kind." },
    { key: "territorialBehavior", label: "Territorial Behavior", group: "behavior", kind: "text", hint: "How it picks, marks and defends its lair. The warning signs the party finds before it finds them." },
    // Classification
    existenceStatus("classification"),
    {
      key: "creatureType",
      label: "Creature Type",
      group: "classification",
      kind: "select",
      options: optionsOf(SPECIES_INFO, "creatureType"),
      hint: "Its creature type, as in the Monster Manual. Decides which spells and features affect it.",
    },
    {
      key: "entryScope",
      label: "Entry Scope",
      group: "classification",
      kind: "select",
      options: ["Species", "Subspecies or Variant", "Unique Individual"],
      hint: "Whether this page is a whole kind of monster, one variant of it, or one particular creature.",
    },
    {
      key: "relatedCreatures",
      label: "Related Creatures",
      group: "classification",
      kind: "link",
      link: link(ANY_ARTICLE, true),
      hint: "Its species, variants, relatives or known individuals.",
    },
    // Distribution & Habitat
    ...distributionFields("creature"),
    // External
    {
      key: "characterSheet",
      label: "Link to Character Sheet",
      group: "external",
      kind: "url",
      hint: "A web address for its stat block (D&D Beyond, a homebrew page, a shared sheet), to open it at the table.",
    },
    // History & Lore
    {
      key: "associatedEvents",
      label: "Associated Events",
      group: "historyAndLore",
      kind: "link",
      link: link(ANY_ARTICLE, true),
      hint: "When it made history: attacks, disasters, battles, its first sighting.",
    },
    {
      key: "beliefsAndLegends",
      label: "Beliefs & Legends",
      group: "historyAndLore",
      kind: "link",
      link: link(["generic", "document"], true),
      hint: "The tales, songs and writings about it. Half of them are wrong, which half is up to you.",
    },
    // Life Cycle
    { key: "lifespanAndDevelopment", label: "Lifespan & Development", group: "lifeCycle", kind: "text", hint: "How it ages and grows: metamorphosis, molting, or no aging at all?" },
    { key: "reproductionOrCreation", label: "Reproduction or Creation", group: "lifeCycle", kind: "text", hint: "Where new ones come from: eggs, spawning, curses, a mad wizard's lab?" },
    // Relationships
    {
      key: "affiliations",
      label: "Affiliations",
      group: "relationships",
      kind: "link",
      link: link(ANY_ARTICLE, true),
      hint: "Who it's tied to: its creator, master, a cult that worships it, a deity, allies.",
    },
  ]
);
