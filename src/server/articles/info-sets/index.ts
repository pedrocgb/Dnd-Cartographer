import type { InfoFieldSet } from "../info-fields";
import type { ArticleTemplateKey } from "../templates";
import { BUILDING_INFO } from "./building";
import { CHARACTER_INFO } from "./character";
import { CONFLICT_INFO } from "./conflict";
import { CULTURE_INFO } from "./culture";
import { DOCUMENT_INFO } from "./document";
import { FAUNA_INFO } from "./fauna";
import { FLORA_INFO } from "./flora";
import { GENERIC_INFO } from "./generic";
import { GEOGRAPHY_INFO } from "./geography";
import { ITEM_INFO } from "./item";
import { LANGUAGE_INFO } from "./language";
import { LAW_INFO } from "./law";
import { MAGIC_INFO } from "./magic";
import { MILITARY_INFO } from "./military";
import { MONSTER_INFO } from "./monster";
import { ORGANIZATION_INFO } from "./organization";
import { PLAYER_CHARACTER_INFO } from "./player-character";
import { RELIGION_INFO } from "./religion";
import { SETTLEMENT_INFO } from "./settlement";
import { SPECIES_INFO } from "./species";
import { TECHNOLOGY_INFO } from "./technology";
import { TERRITORY_INFO } from "./territory";
import { TITLE_INFO } from "./title";
import { TRADITION_INFO } from "./tradition";

/** The Info Bar fields of a `people` row, by its kind. */
export const personInfoSet = (kind: string | null | undefined) => (kind === "player" ? PLAYER_CHARACTER_INFO : CHARACTER_INFO);

/** Each template's Info Bar fields. A template missing here has no addable information yet. */
export const INFO_FIELD_SETS: Partial<Record<ArticleTemplateKey, InfoFieldSet>> = {
  generic: GENERIC_INFO,
  character: CHARACTER_INFO,
  playerCharacter: PLAYER_CHARACTER_INFO,
  organization: ORGANIZATION_INFO,
  territory: TERRITORY_INFO,
  settlement: SETTLEMENT_INFO,
  building: BUILDING_INFO,
  geography: GEOGRAPHY_INFO,
  military: MILITARY_INFO,
  conflict: CONFLICT_INFO,
  technology: TECHNOLOGY_INFO,
  title: TITLE_INFO,
  law: LAW_INFO,
  tradition: TRADITION_INFO,
  culture: CULTURE_INFO,
  species: SPECIES_INFO,
  fauna: FAUNA_INFO,
  flora: FLORA_INFO,
  monster: MONSTER_INFO,
  religion: RELIGION_INFO,
  item: ITEM_INFO,
  magic: MAGIC_INFO,
  document: DOCUMENT_INFO,
  language: LANGUAGE_INFO,
};

export {
  BUILDING_INFO,
  CHARACTER_INFO,
  CONFLICT_INFO,
  CULTURE_INFO,
  DOCUMENT_INFO,
  FAUNA_INFO,
  FLORA_INFO,
  GENERIC_INFO,
  GEOGRAPHY_INFO,
  ITEM_INFO,
  LANGUAGE_INFO,
  LAW_INFO,
  MAGIC_INFO,
  MILITARY_INFO,
  MONSTER_INFO,
  ORGANIZATION_INFO,
  PLAYER_CHARACTER_INFO,
  RELIGION_INFO,
  SETTLEMENT_INFO,
  SPECIES_INFO,
  TECHNOLOGY_INFO,
  TERRITORY_INFO,
  TITLE_INFO,
  TRADITION_INFO,
};
