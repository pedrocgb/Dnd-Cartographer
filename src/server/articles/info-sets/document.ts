import { defineFieldSet, link } from "../info-fields";
import { ARTICLE_TEMPLATE_KEYS } from "../templates";

const PEOPLE = () => link(["character", "organization"]);
const PEOPLE_LIST = () => link(["character", "organization"], true);

export const DOCUMENT_INFO = defineFieldSet(
  [
    { key: "contents", label: "Contents" },
    { key: "custody", label: "Custody" },
    { key: "identity", label: "Identity" },
    { key: "provenance", label: "Provenance" },
  ],
  [
    // Contents
    { key: "associatedLaws", label: "Associated Laws", group: "contents", kind: "link", link: link(["law"], true), hint: "Laws this document creates, records or disputes." },
    { key: "keyClaims", label: "Key Claims", group: "contents", kind: "text", hint: "The most important things it asserts — true or not." },
    { key: "language", label: "Language", group: "contents", kind: "link", link: link(["language"]), hint: "The language it's written in. Can the party even read it?" },
    {
      key: "subjects",
      label: "Subjects",
      group: "contents",
      kind: "link",
      link: link([...ARTICLE_TEMPLATE_KEYS], true),
      hint: "Anything the document is about: people, places, events, other documents.",
    },
    { key: "summaryOfContents", label: "Summary of Contents", group: "contents", kind: "text", hint: "What it says, in a sentence or two." },
    // Custody
    {
      key: "accessLevel",
      label: "Access Level",
      group: "custody",
      kind: "select",
      options: ["Public", "Restricted", "Confidential", "Secret", "Lost"],
      hint: "Who is allowed to read it — and how hard it is to get.",
    },
    {
      key: "currentLocation",
      label: "Current Location",
      group: "custody",
      kind: "link",
      link: link(["building", "settlement"]),
      hint: "Where it's kept.",
    },
    { key: "custodian", label: "Custodian", group: "custody", kind: "link", link: PEOPLE(), hint: "Who guards or keeps it." },
    { key: "owner", label: "Owner", group: "custody", kind: "link", link: PEOPLE(), hint: "Who it belongs to." },
    // Identity
    {
      key: "authenticity",
      label: "Authenticity",
      group: "identity",
      kind: "select",
      options: ["Verified", "Alleged", "Disputed", "Forged", "Unknown"],
      hint: "Is it genuine? A forgery can be as powerful as the real thing.",
    },
    {
      key: "documentType",
      label: "Document Type",
      group: "identity",
      kind: "select",
      options: ["Letter", "Book", "Treaty", "Contract", "Charter", "Proclamation", "Journal", "Map", "Prophecy", "Report", "Other"],
      hint: "What kind of document this is.",
    },
    {
      key: "medium",
      label: "Medium",
      group: "identity",
      kind: "select",
      options: ["Paper", "Parchment", "Stone", "Metal", "Wood", "Magical", "Other"],
      hint: "What it's written on.",
    },
    {
      key: "physicalCondition",
      label: "Physical Condition",
      group: "identity",
      kind: "select",
      options: ["Pristine", "Worn", "Damaged", "Fragmentary", "Illegible", "Destroyed"],
      hint: "What shape it's in. Missing pages hide the best secrets.",
    },
    // Provenance
    { key: "authors", label: "Authors", group: "provenance", kind: "link", link: PEOPLE_LIST(), hint: "Who wrote it." },
    { key: "commissionedBy", label: "Commissioned By", group: "provenance", kind: "link", link: PEOPLE(), hint: "Who ordered it written." },
    { key: "dateWritten", label: "Date Written", group: "provenance", kind: "text", hint: "When it was written." },
    { key: "intendedRecipients", label: "Intended Recipients", group: "provenance", kind: "link", link: PEOPLE_LIST(), hint: "Who it was meant for." },
    {
      key: "originalDocument",
      label: "Original Document",
      group: "provenance",
      kind: "link",
      link: link(["document"]),
      hint: "The original, if this is a copy or translation.",
    },
    { key: "signatories", label: "Signatories", group: "provenance", kind: "link", link: PEOPLE_LIST(), hint: "Who signed it." },
    { key: "translations", label: "Translations", group: "provenance", kind: "link", link: link(["document"], true), hint: "Translated copies of this document." },
  ]
);
