import { defineFieldSet, link } from "../info-fields";

export const RELIGION_INFO = defineFieldSet(
  [
    { key: "beliefs", label: "Beliefs" },
    { key: "organization", label: "Organization" },
    { key: "practices", label: "Practices" },
    { key: "sacredElements", label: "Sacred Elements" },
  ],
  [
    // Beliefs
    { key: "afterlifeBeliefs", label: "Afterlife Beliefs", group: "beliefs", kind: "text", hint: "What the faithful believe happens after death." },
    { key: "centralTeachings", label: "Central Teachings", group: "beliefs", kind: "text", hint: "The core of what the faith teaches." },
    { key: "creationAccount", label: "Creation Account", group: "beliefs", kind: "text", hint: "How the faith says the world began." },
    {
      key: "deitiesOrSacredBeings",
      label: "Deities or Sacred Beings",
      group: "beliefs",
      kind: "link",
      link: link(["character", "generic"], true),
      hint: "The gods, saints, spirits or powers the faith worships.",
    },
    {
      key: "religiousModel",
      label: "Religious Model",
      group: "beliefs",
      kind: "select",
      options: ["Monotheistic", "Polytheistic", "Animistic", "Ancestor Veneration", "Non-theistic", "Syncretic", "Other"],
      hint: "The shape of the faith: one god, many, spirits in all things, the ancestors?",
    },
    { key: "taboos", label: "Taboos", group: "beliefs", kind: "text", hint: "What the faith forbids." },
    // Organization
    {
      key: "branchesAndSects",
      label: "Branches and Sects",
      group: "organization",
      kind: "link",
      link: link(["religion"], true),
      hint: "Offshoots and rival interpretations of the faith.",
    },
    { key: "clergyTitles", label: "Clergy Titles", group: "organization", kind: "link", link: link(["title"], true), hint: "The ranks of its clergy." },
    { key: "founders", label: "Founders", group: "organization", kind: "link", link: link(["character"], true), hint: "Prophets or saints who founded it." },
    {
      key: "leadership",
      label: "Leadership",
      group: "organization",
      kind: "link",
      link: link(["character", "organization"], true),
      hint: "Who leads the faith today.",
    },
    {
      key: "religiousOrders",
      label: "Religious Orders",
      group: "organization",
      kind: "link",
      link: link(["organization"], true),
      hint: "Monastic, militant or scholarly orders serving the faith.",
    },
    {
      key: "seatOfAuthority",
      label: "Seat of Authority",
      group: "organization",
      kind: "link",
      link: link(["building", "settlement"]),
      hint: "The temple or holy city the faith is governed from.",
    },
    // Practices
    {
      key: "conversionRequirements",
      label: "Conversion Requirements",
      group: "practices",
      kind: "text",
      hint: "What it takes to join the faith — if outsiders can join at all.",
    },
    { key: "dailyPractices", label: "Daily Practices", group: "practices", kind: "text", hint: "Prayers, offerings or habits the faithful keep every day." },
    { key: "funeraryPractices", label: "Funerary Practices", group: "practices", kind: "text", hint: "How the faith treats its dead." },
    { key: "holyDays", label: "Holy Days", group: "practices", kind: "link", link: link(["tradition"], true), hint: "Festivals and sacred days of the faith." },
    { key: "pilgrimages", label: "Pilgrimages", group: "practices", kind: "text", hint: "Journeys the faithful are called to make." },
    { key: "rituals", label: "Rituals", group: "practices", kind: "link", link: link(["tradition"], true), hint: "The rites and ceremonies of the faith." },
    // Sacred Elements
    {
      key: "holySites",
      label: "Holy Sites",
      group: "sacredElements",
      kind: "link",
      link: link(["building", "geography", "settlement"], true),
      hint: "Places sacred to the faith.",
    },
    { key: "relics", label: "Relics", group: "sacredElements", kind: "link", link: link(["item"], true), hint: "Sacred objects of the faith." },
    { key: "sacredSymbols", label: "Sacred Symbols", group: "sacredElements", kind: "text", hint: "The signs and emblems of the faith." },
    { key: "sacredTexts", label: "Sacred Texts", group: "sacredElements", kind: "link", link: link(["document"], true), hint: "The scriptures of the faith." },
  ]
);
