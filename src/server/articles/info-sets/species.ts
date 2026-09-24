import { defineFieldSet, link } from "../info-fields";

export const SPECIES_INFO = defineFieldSet(
  [
    { key: "anatomy", label: "Anatomy" },
    { key: "habitat", label: "Habitat" },
    { key: "identity", label: "Identity" },
    { key: "lifeCycle", label: "Life Cycle" },
    { key: "worldPresence", label: "World Presence" },
  ],
  [
    // Anatomy
    { key: "bodyStructure", label: "Body Structure", group: "anatomy", kind: "text", hint: "How the body is built: limbs, wings, tails, shells?" },
    {
      key: "creatureType",
      label: "Creature Type",
      group: "anatomy",
      kind: "select",
      options: ["Aberration", "Beast", "Celestial", "Construct", "Dragon", "Elemental", "Fey", "Fiend", "Giant", "Humanoid", "Monstrosity", "Ooze", "Plant", "Undead"],
      hint: "Its creature type, as in the Monster Manual. Decides which spells and features affect it.",
    },
    {
      key: "distinguishingFeatures",
      label: "Distinguishing Features",
      group: "anatomy",
      kind: "text",
      hint: "What makes one recognizable at a glance.",
    },
    { key: "movement", label: "Movement", group: "anatomy", kind: "text", hint: "How they get around: walk, fly, swim, burrow, slither?" },
    { key: "senses", label: "Senses", group: "anatomy", kind: "text", hint: "How they perceive the world: darkvision, tremorsense, keen smell?" },
    {
      key: "typicalSize",
      label: "Typical Size",
      group: "anatomy",
      kind: "select",
      multiple: true,
      options: ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"],
      hint: "Their size categories. Pick every size individuals commonly reach.",
    },
    { key: "typicalHeight", label: "Typical Height", group: "anatomy", kind: "text", hint: "How tall an average adult stands." },
    { key: "typicalWeight", label: "Typical Weight", group: "anatomy", kind: "text", hint: "How much an average adult weighs." },
    // Habitat
    { key: "adaptations", label: "Adaptations", group: "habitat", kind: "text", hint: "How they've adapted to where they live." },
    { key: "diet", label: "Diet", group: "habitat", kind: "text", hint: "What they eat — and whether the party is on the menu." },
    {
      key: "environmentalVulnerabilities",
      label: "Environmental Vulnerabilities",
      group: "habitat",
      kind: "text",
      hint: "Conditions they can't endure: sunlight, cold, dry air?",
    },
    { key: "nativeRegions", label: "Native Regions", group: "habitat", kind: "link", link: link(["geography"], true), hint: "Where they come from." },
    { key: "preferredHabitat", label: "Preferred Habitat", group: "habitat", kind: "text", hint: "The kind of place they thrive in." },
    // Identity
    {
      key: "ancestralSpecies",
      label: "Ancestral Species",
      group: "identity",
      kind: "link",
      link: link(["species"], true),
      hint: "The species they descend from.",
    },
    { key: "classification", label: "Classification", group: "identity", kind: "text", hint: "How scholars classify them: humanoid, beast, fey, aberration?" },
    { key: "originAccount", label: "Origin Account", group: "identity", kind: "text", hint: "How they came to be, according to legend or scholars." },
    { key: "relatedSpecies", label: "Related Species", group: "identity", kind: "link", link: link(["species"], true), hint: "Close relatives among other species." },
    {
      key: "subspeciesOrLineages",
      label: "Subspecies or Lineages",
      group: "identity",
      kind: "link",
      link: link(["species"], true),
      hint: "Distinct branches of this species, like high elves and wood elves.",
    },
    // Life Cycle
    { key: "ageOfMaturity", label: "Age of Maturity", group: "lifeCycle", kind: "text", hint: "When they're considered adults." },
    { key: "lifeStages", label: "Life Stages", group: "lifeCycle", kind: "text", hint: "The stages of their life: larva, youngling, elder?" },
    { key: "reproduction", label: "Reproduction", group: "lifeCycle", kind: "text", hint: "How they reproduce and raise their young." },
    { key: "typicalLifespan", label: "Typical Lifespan", group: "lifeCycle", kind: "text", hint: "How long they usually live." },
    // World Presence
    {
      key: "associatedCultures",
      label: "Associated Cultures",
      group: "worldPresence",
      kind: "link",
      link: link(["culture"], true),
      hint: "Cultures this species is part of.",
    },
    { key: "distribution", label: "Distribution", group: "worldPresence", kind: "text", hint: "How widespread they are across the world." },
    { key: "innateAbilities", label: "Innate Abilities", group: "worldPresence", kind: "text", hint: "Powers they're born with: breath weapons, resistances, spells?" },
    {
      key: "notableIndividuals",
      label: "Notable Individuals",
      group: "worldPresence",
      kind: "link",
      link: link(["character"], true),
      hint: "Famous members of this species.",
    },
    {
      key: "populationTrend",
      label: "Population Trend",
      group: "worldPresence",
      kind: "select",
      options: ["Increasing", "Stable", "Declining", "Endangered", "Extinct", "Unknown"],
      hint: "Whether their numbers are growing or shrinking.",
    },
  ]
);
