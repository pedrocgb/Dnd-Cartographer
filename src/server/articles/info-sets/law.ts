import { defineFieldSet, link } from "../info-fields";

export const LAW_INFO = defineFieldSet(
  [
    { key: "authority", label: "Authority" },
    { key: "enforcement", label: "Enforcement" },
    { key: "scope", label: "Scope" },
    { key: "status", label: "Status" },
  ],
  [
    // Authority
    {
      key: "enactedBy",
      label: "Enacted By",
      group: "authority",
      kind: "link",
      link: link(["character", "organization"]),
      hint: "Who made this law. Whoever made it can usually unmake it.",
    },
    { key: "enactedOn", label: "Enacted On", group: "authority", kind: "text", hint: "When the law was passed or proclaimed, in your world's calendar." },
    {
      key: "legalTradition",
      label: "Legal Tradition",
      group: "authority",
      kind: "link",
      link: link(["culture", "religion"], true),
      hint: "The cultures or faiths whose customs this law grows out of.",
    },
    {
      key: "sourceDocument",
      label: "Source Document",
      group: "authority",
      kind: "link",
      link: link(["document"]),
      hint: "The charter, codex or decree where the law is written down.",
    },
    // Enforcement
    { key: "appealProcess", label: "Appeal Process", group: "enforcement", kind: "text", hint: "How a verdict can be challenged, and before whom — if at all." },
    {
      key: "enforcingOrganizations",
      label: "Enforcing Organizations",
      group: "enforcement",
      kind: "link",
      link: link(["organization"], true),
      hint: "The watch, courts, inquisitors or guilds that uphold it.",
    },
    {
      key: "enforcementConsistency",
      label: "Enforcement Consistency",
      group: "enforcement",
      kind: "select",
      options: ["Consistent", "Selective", "Rare", "Symbolic", "Unenforced"],
      hint: "How reliably it's actually enforced. A law on paper and a law in the streets are different things.",
    },
    {
      key: "judicialAuthority",
      label: "Judicial Authority",
      group: "enforcement",
      kind: "link",
      link: link(["character", "organization", "title"]),
      hint: "Who judges those accused of breaking it.",
    },
    { key: "penalties", label: "Penalties", group: "enforcement", kind: "text", hint: "What happens to those who break it: fines, exile, the gallows?" },
    // Scope
    { key: "affectedGroups", label: "Affected Groups", group: "scope", kind: "text", hint: "Who the law applies to: everyone, nobles, foreigners, spellcasters?" },
    { key: "exceptions", label: "Exceptions", group: "scope", kind: "text", hint: "Who or what is exempt. Loopholes are where the stories are." },
    {
      key: "jurisdiction",
      label: "Jurisdiction",
      group: "scope",
      kind: "link",
      link: link(["territory", "settlement", "organization"], true),
      hint: "The lands, settlements or organizations where the law holds.",
    },
    {
      key: "lawType",
      label: "Law Type",
      group: "scope",
      kind: "select",
      multiple: true,
      options: ["Criminal", "Civil", "Trade", "Tax", "Inheritance", "Military", "Religious", "Magical", "Customary", "Other"],
      hint: "What areas of life the law covers. Pick every kind that applies.",
    },
    {
      key: "requirementsOrProhibitions",
      label: "Requirements or Prohibitions",
      group: "scope",
      kind: "text",
      hint: "What the law demands or forbids, in plain words.",
    },
    // Status
    { key: "amendedBy", label: "Amended By", group: "status", kind: "link", link: link(["law"], true), hint: "Later laws that changed this one." },
    { key: "effectiveFrom", label: "Effective From", group: "status", kind: "text", hint: "When the law took effect, if not when it was enacted." },
    { key: "expiresOn", label: "Expires On", group: "status", kind: "text", hint: "When the law lapses, if it has an end date." },
    {
      key: "legalStatus",
      label: "Legal Status",
      group: "status",
      kind: "select",
      options: ["Proposed", "In Force", "Suspended", "Repealed", "Expired", "Disputed"],
      hint: "Whether the law currently holds.",
    },
    { key: "supersedes", label: "Supersedes", group: "status", kind: "link", link: link(["law"], true), hint: "Older laws this one replaces." },
  ]
);
