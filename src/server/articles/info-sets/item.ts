import { defineFieldSet, link } from "../info-fields";

const HOLDERS = () => link(["character", "organization"]);

export const ITEM_INFO = defineFieldSet(
  [
    { key: "identity", label: "Identity" },
    { key: "ownership", label: "Ownership" },
    { key: "properties", label: "Properties" },
    { key: "provenance", label: "Provenance" },
  ],
  [
    // Identity
    {
      key: "articleScope",
      label: "Article Scope",
      group: "identity",
      kind: "select",
      options: ["Unique Object", "Item Type", "Collection", "Material", "Consumable"],
      hint: "Is this article about one specific object, a kind of item, a set, a material or something used up?",
    },
    {
      key: "itemType",
      label: "Item Type",
      group: "identity",
      kind: "select",
      options: ["Weapon", "Armor", "Tool", "Clothing", "Jewelry", "Container", "Instrument", "Vehicle", "Relic", "Material", "Other"],
      hint: "What kind of item this is.",
    },
    {
      key: "rarity",
      label: "Rarity",
      group: "identity",
      kind: "select",
      options: ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Unique"],
      hint: "How hard it is to find. Sets its price and who would kill for it.",
    },
    {
      key: "status",
      label: "Status",
      group: "identity",
      kind: "select",
      options: ["Intact", "Damaged", "Broken", "Destroyed", "Lost", "Unknown"],
      hint: "What state the item is in today.",
    },
    // Ownership
    { key: "currentBearer", label: "Current Bearer", group: "ownership", kind: "link", link: link(["character"]), hint: "Who carries it right now." },
    {
      key: "currentLocation",
      label: "Current Location",
      group: "ownership",
      kind: "link",
      link: link(["building", "settlement", "territory", "geography"]),
      hint: "Where it is right now, if nobody is carrying it.",
    },
    { key: "legalOwner", label: "Legal Owner", group: "ownership", kind: "link", link: HOLDERS(), hint: "Who it rightfully belongs to — not always who has it." },
    {
      key: "previousOwners",
      label: "Previous Owners",
      group: "ownership",
      kind: "link",
      link: link(["character", "organization"], true),
      hint: "Who held it before. Some may want it back.",
    },
    // Properties
    { key: "activationMethod", label: "Activation Method", group: "properties", kind: "text", hint: "How its power is used: a command word, a drop of blood, attunement?" },
    { key: "appearance", label: "Appearance", group: "properties", kind: "text", hint: "What it looks like, feels like, sounds like." },
    { key: "dimensionsAndWeight", label: "Dimensions and Weight", group: "properties", kind: "text", hint: "How big and heavy it is." },
    { key: "limitations", label: "Limitations", group: "properties", kind: "text", hint: "Charges, cooldowns or conditions that limit it." },
    { key: "magicalEffects", label: "Magical Effects", group: "properties", kind: "text", hint: "What it can do beyond the mundane." },
    { key: "materials", label: "Materials", group: "properties", kind: "text", hint: "What it's made of." },
    { key: "mundaneUses", label: "Mundane Uses", group: "properties", kind: "text", hint: "What it's good for without any magic." },
    { key: "sideEffects", label: "Side Effects", group: "properties", kind: "text", hint: "The price of using it: curses, fatigue, whispers at night?" },
    { key: "value", label: "Value", group: "properties", kind: "text", hint: "What it's worth, in coin or otherwise." },
    // Provenance
    {
      key: "associatedEvents",
      label: "Associated Events",
      group: "provenance",
      kind: "link",
      link: link(["generic"], true),
      hint: "Events it played a part in.",
    },
    { key: "createdOn", label: "Created On", group: "provenance", kind: "text", hint: "When it was made." },
    {
      key: "creators",
      label: "Creators",
      group: "provenance",
      kind: "link",
      link: link(["character", "organization"], true),
      hint: "Who made it.",
    },
    {
      key: "placeOfCreation",
      label: "Place of Creation",
      group: "provenance",
      kind: "link",
      link: link(["building", "settlement"]),
      hint: "Where it was made.",
    },
    {
      key: "requiredComponents",
      label: "Required Components",
      group: "provenance",
      kind: "link",
      link: link(["item"], true),
      hint: "Items needed to craft it — a good quest hook.",
    },
  ]
);
