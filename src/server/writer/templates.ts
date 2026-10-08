/**
 * Story structures the writer can lay out under a campaign, an arc or a
 * chapter (pure data). Applying one creates a child per beat, each with the
 * beat's hint as its synopsis prompt. `pct` is roughly where the beat falls
 * in the story, for pacing. The words live in the `writer` namespace.
 */
import { wordedFields } from "../../i18n/worded";

export interface Beat {
  key: string;
  name: string;
  hint: string;
  pct: number;
}

export interface StoryTemplate {
  key: string;
  name: string;
  /** Who it comes from. */
  source: string;
  summary: string;
  /** Where it fits best. */
  bestFor: string;
  beats: Beat[];
}

/** Each structure's beats as `[key, pct]`; names and hints come from the `writer` namespace. */
const STRUCTURES: [string, [string, number][]][] = [
  ["three-act", [["setup", 0], ["confrontation", 25], ["resolution", 75]]],
  ["save-the-cat", [["opening-image", 0], ["theme-stated", 5], ["setup", 6], ["catalyst", 10], ["debate", 12], ["break-into-two", 20], ["b-story", 22], ["fun-and-games", 30], ["midpoint", 50], ["bad-guys-close-in", 55], ["all-is-lost", 75], ["dark-night", 78], ["break-into-three", 80], ["finale", 85], ["final-image", 100]]],
  ["heros-journey", [["ordinary-world", 0], ["call", 8], ["refusal", 12], ["mentor", 16], ["threshold", 25], ["tests", 30], ["approach", 45], ["ordeal", 50], ["reward", 60], ["road-back", 75], ["resurrection", 90], ["return", 100]]],
  ["story-circle", [["you", 0], ["need", 12], ["go", 25], ["search", 37], ["find", 50], ["take", 62], ["return", 75], ["change", 88]]],
  ["kishotenketsu", [["ki", 0], ["sho", 25], ["ten", 50], ["ketsu", 75]]],
  ["five-room", [["entrance", 0], ["puzzle", 20], ["setback", 40], ["climax", 60], ["reward", 80]]],
];

/** The structures, worded on read in the active language. */
export const STORY_TEMPLATES: StoryTemplate[] = STRUCTURES.map(([key, beats]) =>
  wordedFields(
    { key, name: "", source: "", summary: "", bestFor: "", beats: beats.map(([b, pct]) => wordedFields({ key: b, name: "", hint: "", pct }, "writer", `template.${key}.beat.${b}`, ["name", "hint"])) },
    "writer",
    `template.${key}`,
    ["name", "source", "summary", "bestFor"]
  )
);

export const templateByKey = (key: string | null | undefined): StoryTemplate | null => STORY_TEMPLATES.find((t) => t.key === key) ?? null;

export const beatOf = (templateKey: string | null | undefined, beatKey: string | null | undefined): Beat | null =>
  templateByKey(templateKey)?.beats.find((b) => b.key === beatKey) ?? null;
