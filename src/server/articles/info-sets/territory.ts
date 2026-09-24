import { GOVERNMENT_FORMS } from "../../politics/hierarchy-config";
import { defineFieldSet, link } from "../info-fields";

/**
 * Territory fields. Territory Type and Parent Territory aren't here: they
 * are the hierarchy's `type`/`parentId` (validated against the hierarchy
 * profile) and always shown as fixed rows. Government Form is the
 * `governmentForm` column.
 */
export const TERRITORY_INFO = defineFieldSet(
  [
    { key: "geography", label: "Geography" },
    { key: "government", label: "Government" },
    { key: "history", label: "History" },
    { key: "society", label: "Society" },
  ],
  [
    // Geography
    { key: "area", label: "Area", group: "geography", kind: "text", hint: "How large the territory is — a figure, or a feel like \"three days' ride across\"." },
    {
      key: "borders",
      label: "Borders",
      group: "geography",
      kind: "link",
      link: link(["territory", "geography"], true),
      hint: "The territories and natural features along its borders. Neighbors make allies and wars.",
    },
    {
      key: "containedSettlements",
      label: "Contained Settlements",
      group: "geography",
      kind: "link",
      link: link(["settlement"], true),
      hint: "The cities, towns and villages inside it.",
    },
    {
      key: "geographicFeatures",
      label: "Geographic Features",
      group: "geography",
      kind: "link",
      link: link(["geography"], true),
      hint: "Mountains, rivers, forests and other landmarks within it.",
    },
    {
      key: "strategicLocations",
      label: "Strategic Locations",
      group: "geography",
      kind: "link",
      link: link(["building", "settlement", "geography"], true),
      hint: "Forts, passes, ports or crossings that whoever holds them controls the land.",
    },
    // Government
    {
      key: "capital",
      label: "Capital",
      group: "government",
      kind: "link",
      link: link(["settlement"]),
      hint: "The settlement it is ruled from.",
    },
    {
      key: "governmentForm",
      label: "Government Form",
      group: "government",
      kind: "select",
      options: GOVERNMENT_FORMS,
      column: "governmentForm",
      hint: "How power is organized: one ruler, the people, a few families, the faith?",
    },
    {
      key: "governingBody",
      label: "Governing Body",
      group: "government",
      kind: "link",
      link: link(["organization"]),
      hint: "The council, house or institution that governs it.",
    },
    { key: "rulers", label: "Rulers", group: "government", kind: "link", link: link(["character"], true), hint: "The characters currently ruling it." },
    {
      key: "rulingTitles",
      label: "Ruling Titles",
      group: "government",
      kind: "link",
      link: link(["title"], true),
      hint: "The titles its rulers hold, like King or High Chancellor.",
    },
    // History
    { key: "establishedOn", label: "Established On", group: "history", kind: "text", hint: "When the territory was founded or first recognized." },
    {
      key: "formerRulers",
      label: "Former Rulers",
      group: "history",
      kind: "link",
      link: link(["character", "organization"], true),
      hint: "Characters or organizations that once ruled it. Old claims rarely die quietly.",
    },
    {
      key: "historicalEvents",
      label: "Historical Events",
      group: "history",
      kind: "link",
      link: link(["generic"], true),
      hint: "Wars, treaties, disasters and other events that shaped it.",
    },
    {
      key: "politicalStatus",
      label: "Political Status",
      group: "history",
      kind: "select",
      options: ["Independent", "Vassal", "Occupied", "Disputed", "Annexed", "Dissolved"],
      hint: "Does it answer to no one, serve an overlord, or has it been taken or dissolved?",
    },
    // Society
    { key: "cultures", label: "Cultures", group: "society", kind: "link", link: link(["culture"], true), hint: "The cultures of the people living there." },
    { key: "laws", label: "Laws", group: "society", kind: "link", link: link(["law"], true), hint: "Laws in force across the territory." },
    { key: "population", label: "Population", group: "society", kind: "text", hint: "How many people live there — a number, or a feel like \"sparse\" or \"teeming\"." },
    { key: "religions", label: "Religions", group: "society", kind: "link", link: link(["religion"], true), hint: "The faiths practiced there." },
    {
      key: "speciesPresent",
      label: "Species Present",
      group: "society",
      kind: "link",
      link: link(["species"], true),
      hint: "The peoples and creatures that live there in numbers.",
    },
  ]
);
