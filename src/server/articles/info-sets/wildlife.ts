import { link, type InfoField } from "../info-fields";

/**
 * The places' side (Territory, Geography, Building) of the Nature templates' Found In: a "Wildlife" folder
 * listing the Fauna, Flora and Monsters found there. Relation-backed, so
 * adding a place to a creature's Found In lists the creature here, and
 * the other way round.
 */
export const WILDLIFE_GROUP = { key: "wildlife", label: "Wildlife" };

export const WILDLIFE_FIELDS: InfoField[] = [
  {
    key: "fauna",
    label: "Fauna",
    group: WILDLIFE_GROUP.key,
    kind: "link",
    link: link(["fauna"], true),
    relation: { type: "foundIn", side: "to" },
    hint: "Animals living here. What hunters bring back, and what the party hears at night.",
  },
  {
    key: "flora",
    label: "Flora",
    group: WILDLIFE_GROUP.key,
    kind: "link",
    link: link(["flora"], true),
    relation: { type: "foundIn", side: "to" },
    hint: "Plants and fungi growing here. The herbs a healer forages for, the poison a rogue might find.",
  },
  {
    key: "monsters",
    label: "Monsters",
    group: WILDLIFE_GROUP.key,
    kind: "link",
    link: link(["monster"], true),
    relation: { type: "foundIn", side: "to" },
    hint: "Monsters known to roam or lair here. The reason locals stay home after dark.",
  },
];
