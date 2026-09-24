import { defineFieldSet, link } from "../info-fields";

/** Generic articles: concepts, events, legends, mysteries — anything that isn't another template. */
export const GENERIC_INFO = defineFieldSet(
  [
    { key: "classification", label: "Classification" },
    { key: "connections", label: "Connections" },
    { key: "history", label: "History" },
  ],
  [
    // Classification
    {
      key: "importance",
      label: "Importance",
      group: "classification",
      kind: "select",
      options: ["Local", "Regional", "National", "Continental", "Worldwide", "Planar"],
      hint: "How far this subject's effects or fame reach. Helps judge who in the world would know about it.",
    },
    {
      key: "subjectType",
      label: "Subject Type",
      group: "classification",
      kind: "select",
      options: ["Concept", "Event", "Legend", "Mystery", "Phenomenon", "Other"],
      hint: "What kind of thing this is: an idea, something that happened, a tale, an unsolved question, a strange occurrence?",
    },
    // Connections
    {
      key: "associatedCharacters",
      label: "Associated Characters",
      group: "connections",
      kind: "link",
      link: link(["character"], true),
      hint: "Characters involved in, affected by or known for this subject.",
    },
    {
      key: "associatedCultures",
      label: "Associated Cultures",
      group: "connections",
      kind: "link",
      link: link(["culture"], true),
      hint: "Cultures that created, remember or are shaped by this subject.",
    },
    {
      key: "associatedLocations",
      label: "Associated Locations",
      group: "connections",
      kind: "link",
      link: link(["territory", "settlement", "building", "geography"], true),
      hint: "Places where it happened, is found or is remembered.",
    },
    {
      key: "associatedOrganizations",
      label: "Associated Organizations",
      group: "connections",
      kind: "link",
      link: link(["organization"], true),
      hint: "Organizations that caused, guard, study or exploit this subject.",
    },
    {
      key: "associatedReligions",
      label: "Associated Religions",
      group: "connections",
      kind: "link",
      link: link(["religion"], true),
      hint: "Faiths that revere, fear or explain this subject.",
    },
    // History
    {
      key: "consequences",
      label: "Consequences",
      group: "history",
      kind: "text",
      hint: "What changed because of it. Consequences are what make a subject matter to the present day.",
    },
    { key: "dateOfOrigin", label: "Date of Origin", group: "history", kind: "text", hint: "When it began or first appeared, in your world's calendar." },
    { key: "dateOfResolution", label: "Date of Resolution", group: "history", kind: "text", hint: "When it ended or was resolved, if it has been." },
    { key: "origin", label: "Origin", group: "history", kind: "text", hint: "How or where it started. The seed of the story." },
    {
      key: "precedingSubject",
      label: "Preceding Subject",
      group: "history",
      kind: "link",
      link: link(["generic"]),
      hint: "The event, legend or concept that came right before this one or led to it.",
    },
    {
      key: "status",
      label: "Status",
      group: "history",
      kind: "select",
      options: ["Ongoing", "Historical", "Recurring", "Disputed", "Forgotten", "Destroyed", "Unknown"],
      hint: "Where it stands today: still happening, long past, coming back, argued over, lost to memory?",
    },
  ]
);
