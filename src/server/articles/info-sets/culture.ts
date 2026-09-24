import { defineFieldSet, link } from "../info-fields";

export const CULTURE_INFO = defineFieldSet(
  [
    { key: "beliefsAndValues", label: "Beliefs and Values" },
    { key: "expression", label: "Expression" },
    { key: "identity", label: "Identity" },
    { key: "society", label: "Society" },
  ],
  [
    // Beliefs and Values
    {
      key: "attitudesTowardMagic",
      label: "Attitudes Toward Magic",
      group: "beliefsAndValues",
      kind: "text",
      hint: "Is magic revered, feared, regulated or ordinary? Spellcasters will want to know.",
    },
    { key: "coreValues", label: "Core Values", group: "beliefsAndValues", kind: "text", hint: "What this people prizes most: honor, family, knowledge, freedom?" },
    {
      key: "hospitalityCustoms",
      label: "Hospitality Customs",
      group: "beliefsAndValues",
      kind: "text",
      hint: "How guests are welcomed, and what a guest owes in return.",
    },
    { key: "religions", label: "Religions", group: "beliefsAndValues", kind: "link", link: link(["religion"], true), hint: "The faiths this culture follows." },
    { key: "taboos", label: "Taboos", group: "beliefsAndValues", kind: "text", hint: "What is never done or said. Outsiders break these first." },
    { key: "viewsOnDeath", label: "Views on Death", group: "beliefsAndValues", kind: "text", hint: "How they understand death, and how they treat their dead." },
    // Expression
    { key: "architecture", label: "Architecture", group: "expression", kind: "text", hint: "What their buildings look like, and why." },
    { key: "artAndMusic", label: "Art and Music", group: "expression", kind: "text", hint: "Their crafts, songs, instruments and favorite subjects." },
    { key: "clothing", label: "Clothing", group: "expression", kind: "text", hint: "How they dress, and what clothing says about rank or role." },
    { key: "cuisine", label: "Cuisine", group: "expression", kind: "text", hint: "What they eat and drink, and what's served on special days." },
    {
      key: "languages",
      label: "Languages",
      group: "expression",
      kind: "link",
      link: link(["language"], true),
      hint: "The languages this culture speaks.",
    },
    { key: "namingCustoms", label: "Naming Customs", group: "expression", kind: "text", hint: "How names are chosen and built. Handy for naming NPCs on the fly." },
    { key: "traditions", label: "Traditions", group: "expression", kind: "link", link: link(["tradition"], true), hint: "The festivals, rites and customs it keeps." },
    // Identity
    {
      key: "ancestralHomeland",
      label: "Ancestral Homeland",
      group: "identity",
      kind: "link",
      link: link(["territory", "geography"], true),
      hint: "Where this people comes from.",
    },
    { key: "demonyms", label: "Demonyms", group: "identity", kind: "text", hint: "What outsiders call its people." },
    { key: "relatedCultures", label: "Related Cultures", group: "identity", kind: "link", link: link(["culture"], true), hint: "Cultures sharing its roots or strongly shaped by it." },
    {
      key: "regionsPracticed",
      label: "Regions Practiced",
      group: "identity",
      kind: "link",
      link: link(["territory", "settlement"], true),
      hint: "Territories and settlements where this culture lives today.",
    },
    { key: "selfDesignation", label: "Self-Designation", group: "identity", kind: "text", hint: "What its people call themselves." },
    // Society
    { key: "familyStructures", label: "Family Structures", group: "society", kind: "text", hint: "How families and households are organized, and who holds authority in them." },
    { key: "leadershipCustoms", label: "Leadership Customs", group: "society", kind: "text", hint: "How leaders are chosen and what is expected of them." },
    {
      key: "notableOrganizations",
      label: "Notable Organizations",
      group: "society",
      kind: "link",
      link: link(["organization"], true),
      hint: "Organizations central to this culture.",
    },
    { key: "socialClasses", label: "Social Classes", group: "society", kind: "text", hint: "The layers of society, and how hard it is to move between them." },
    { key: "speciesPresent", label: "Species Present", group: "society", kind: "link", link: link(["species"], true), hint: "The species that share this culture." },
    { key: "viewsOnOutsiders", label: "Views on Outsiders", group: "society", kind: "text", hint: "How strangers are treated — useful for the party's first welcome." },
  ]
);
