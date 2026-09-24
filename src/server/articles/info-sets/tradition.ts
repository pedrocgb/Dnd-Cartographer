import { defineFieldSet, link } from "../info-fields";

export const TRADITION_INFO = defineFieldSet(
  [
    { key: "history", label: "History" },
    { key: "participation", label: "Participation" },
    { key: "practice", label: "Practice" },
    { key: "significance", label: "Significance" },
  ],
  [
    // History
    { key: "firstRecordedOn", label: "First Recorded On", group: "history", kind: "text", hint: "The earliest known record of the tradition." },
    { key: "originStory", label: "Origin Story", group: "history", kind: "text", hint: "How people say it began — the true story may differ." },
    {
      key: "originatingCulture",
      label: "Originating Culture",
      group: "history",
      kind: "link",
      link: link(["culture"]),
      hint: "The culture it comes from.",
    },
    {
      key: "regionalVariations",
      label: "Regional Variations",
      group: "history",
      kind: "text",
      hint: "How it differs from place to place. Doing it the \"wrong\" way can start a fight.",
    },
    // Participation
    {
      key: "associatedReligions",
      label: "Associated Religions",
      group: "participation",
      kind: "link",
      link: link(["religion"], true),
      hint: "Faiths that bless, lead or condemn it.",
    },
    { key: "eligibility", label: "Eligibility", group: "participation", kind: "text", hint: "Who may take part: everyone, adults, the initiated, one family?" },
    {
      key: "organizers",
      label: "Organizers",
      group: "participation",
      kind: "link",
      link: link(["character", "organization"], true),
      hint: "The characters or organizations that run it.",
    },
    {
      key: "participatingCultures",
      label: "Participating Cultures",
      group: "participation",
      kind: "link",
      link: link(["culture"], true),
      hint: "Cultures that observe it today.",
    },
    {
      key: "practicedIn",
      label: "Practiced In",
      group: "participation",
      kind: "link",
      link: link(["territory", "settlement"], true),
      hint: "Territories and settlements where it's observed.",
    },
    {
      key: "requiredRoles",
      label: "Required Roles",
      group: "participation",
      kind: "link",
      link: link(["title"], true),
      hint: "Titles someone must hold for the tradition to take place, like a high priest or a herald.",
    },
    // Practice
    { key: "activities", label: "Activities", group: "practice", kind: "text", hint: "What people actually do: feast, dance, fast, duel, burn effigies?" },
    { key: "duration", label: "Duration", group: "practice", kind: "text", hint: "How long it lasts: an hour, a night, a week?" },
    {
      key: "frequency",
      label: "Frequency",
      group: "practice",
      kind: "select",
      options: ["Daily", "Weekly", "Monthly", "Seasonal", "Annual", "Life Milestone", "Irregular"],
      hint: "How often it happens.",
    },
    {
      key: "requiredItems",
      label: "Required Items",
      group: "practice",
      kind: "link",
      link: link(["item"], true),
      hint: "Objects the tradition can't happen without.",
    },
    {
      key: "timingOrTrigger",
      label: "Timing or Trigger",
      group: "practice",
      kind: "text",
      hint: "When it happens, or what sets it off: a full moon, a birth, a first kill?",
    },
    {
      key: "traditionType",
      label: "Tradition Type",
      group: "practice",
      kind: "select",
      multiple: true,
      options: ["Festival", "Ceremony", "Rite of Passage", "Funeral Custom", "Marriage Custom", "Hospitality Custom", "Competition", "Other"],
      hint: "What kind of tradition this is. Pick every kind that applies.",
    },
    // Significance
    { key: "meaning", label: "Meaning", group: "significance", kind: "text", hint: "What the tradition means to those who keep it." },
    {
      key: "status",
      label: "Status",
      group: "significance",
      kind: "select",
      options: ["Widespread", "Regional", "Declining", "Revived", "Forbidden", "Forgotten"],
      hint: "How alive the tradition is today.",
    },
    { key: "symbolism", label: "Symbolism", group: "significance", kind: "text", hint: "The colors, objects and gestures and what they stand for." },
    { key: "taboos", label: "Taboos", group: "significance", kind: "text", hint: "What must never be done during it. A gift for your plot." },
  ]
);
