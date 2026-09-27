import { defineFieldSet, link, type InfoField } from "../info-fields";
import { CHARACTER_FIELDS, CHARACTER_GROUPS } from "./character";

/** Player character fields: every Character field, plus the table-side folders. House and Status keep their `people` columns. */
const GROUPS = [
  ...CHARACTER_GROUPS,
  { key: "meta", label: "Meta & Mechanics" },
  { key: "journey", label: "The Hero's Journey" },
  { key: "party", label: "Party Dynamics" },
  { key: "legacy", label: "Legacy & Repercussions" },
] as const;

export const CHARACTER_ARC_STATUSES = ["Introduction", "Rising Action", "Crisis of Faith", "Climax", "Resolution", "Tragic Fall"] as const;

export const PARTY_ROLES = ["The Face", "The Tank", "The Healer", "The Striker", "The Tactician", "The Utility", "The Wildcard"] as const;

const PLAYER_FIELDS: InfoField[] = [
  {
    key: "controllingPlayer",
    label: "Controlling Player",
    group: "generic",
    kind: "text",
    hint: "The real person at the table who plays this character. Handy when a player misses a session or hands the character over.",
  },
  // Meta & Mechanics
  {
    key: "classSubclass",
    label: "Character Class / Subclass",
    group: "meta",
    kind: "text",
    hint: "Their class and subclass, e.g. \"Paladin / Oath of Vengeance\". Multiclassed? List each one.",
  },
  {
    key: "levelMilestone",
    label: "Current Level / Milestone",
    group: "meta",
    kind: "text",
    hint: "Their level, or the last milestone they reached. Keeps encounters balanced and rewards on track.",
  },
  // The Hero's Journey
  {
    key: "personalQuest",
    label: "Primary Personal Quest",
    group: "journey",
    kind: "text",
    hint: "What is their overarching ultimate goal? The thread you can weave the campaign's big moments around.",
  },
  {
    key: "shortTermMotivations",
    label: "Short-Term Motivations",
    group: "journey",
    kind: "text",
    hint: "What is driving them in the current story arc? Hooks for the next few sessions.",
  },
  {
    key: "arcStatus",
    label: "Character Arc Status",
    group: "journey",
    kind: "select",
    options: CHARACTER_ARC_STATUSES,
    hint: "Where their personal story stands right now. Tells you whether it's time to build tension or pay it off.",
  },
  // Party Dynamics
  {
    key: "partyRole",
    label: "Party Role",
    group: "party",
    kind: "select",
    options: PARTY_ROLES,
    hint: "The part they usually play in the group. Shows gaps in the party and who takes the lead in a scene.",
  },
  { key: "family", label: "Family", group: "party", kind: "link", link: link(["character"], true), hint: "Relatives in the world: people the villain can threaten and the hero will ride out to save." },
  {
    key: "friends",
    label: "Friends",
    group: "party",
    kind: "link",
    link: link(["character", "playerCharacter"], true),
    hint: "NPCs and fellow party members they trust. Friends are allies in a pinch and heartbreak when they turn.",
  },
  {
    key: "enemies",
    label: "Enemies",
    group: "party",
    kind: "link",
    link: link(["character", "playerCharacter", "organization"], true),
    hint: "Characters, fellow players' characters and organizations that want them gone. Rivalries drive conflict.",
  },
  {
    key: "oathsPacts",
    label: "Shared Oaths or Pacts",
    group: "party",
    kind: "link",
    link: link(["organization", "generic"], true),
    hint: "Vows, pacts and bargains they're bound by, and with whom. A broken oath is a story waiting to happen.",
  },
  // Legacy & Repercussions
  {
    key: "titlesEarned",
    label: "Titles Earned",
    group: "legacy",
    kind: "link",
    link: link(["title"], true),
    hint: "Nicknames, formal knighthoods or arena champion titles won in-game. Proof of what they've done.",
  },
  {
    key: "bounties",
    label: "Bounties & Warrants",
    group: "legacy",
    kind: "link",
    link: link(["document", "law"], true),
    hint: "Active prices on their head or legal troubles they are fleeing. The past catching up with them.",
  },
];

// Party Dynamics' Enemies replaces the Relationships one (a field can exist only once).
const FIELDS = [...CHARACTER_FIELDS.filter((f) => !PLAYER_FIELDS.some((p) => p.key === f.key)), ...PLAYER_FIELDS];

export const PLAYER_CHARACTER_INFO = defineFieldSet(GROUPS, FIELDS, ["controllingPlayer"]);
