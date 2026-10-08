/**
 * The writer's guide copy (pure data): short, actionable advice from writers
 * and GM authors, shown next to the fields it helps with. Sources are in
 * docs/campaign-writer-research.md. The words live in the `writer`
 * namespace (en-US is the source) and are read in the active language.
 */
import { activeT } from "../../i18n/active";
import { wordedFields } from "../../i18n/worded";
import type { MessageKey } from "../../i18n/messages";

export interface GuideItem {
  key: string;
  readonly label: string;
  readonly hint: string;
}

const guideItems = (group: string, keys: string[]): GuideItem[] => keys.map((key) => wordedFields({ key, label: "", hint: "" }, "writer", `${group}.${key}`, ["label", "hint"]));

/** Session zero checklist (Sly Flourish, TTRPG Safety Toolkit). */
export const SESSION_ZERO: GuideItem[] = guideItems("sessionZero", ["pitch", "tie-theme", "tie-party", "world-questions", "safety", "expectations", "characters"]);

/** The Lazy DM's eight steps (Sly Flourish), as the session prep sections. */
export const PREP_STEPS: GuideItem[] = guideItems("prep", ["reviewCharacters", "strongStart", "scenes", "secrets", "locations", "npcs", "monsters", "rewards"]);

/** How many secrets the Lazy DM suggests preparing. */
export const SUGGESTED_SECRETS = 10;

/** The New Campaign wizard's steps. */
export const WIZARD_STEPS: GuideItem[] = guideItems("wizard", ["pitch", "truths", "safety", "structure"]);

/** Short tips shown on empty or new things. */
const TIP_KEYS = ["emptyOutline", "arc", "chapter", "scene", "threads", "threeClues", "status", "review"] as const;
export const TIPS = Object.defineProperties({} as Record<(typeof TIP_KEYS)[number], string>, Object.fromEntries(TIP_KEYS.map((k) => [k, { enumerable: true, get: () => activeT("writer")(`tip.${k}` as MessageKey<"writer">) }])));
