/**
 * The writer's guide copy (pure data): short, actionable advice from writers
 * and GM authors, shown next to the fields it helps with. Sources are in
 * docs/campaign-writer-research.md.
 */

export interface GuideItem {
  key: string;
  label: string;
  hint: string;
}

/** Session zero checklist (Sly Flourish, TTRPG Safety Toolkit). */
export const SESSION_ZERO: GuideItem[] = [
  { key: "pitch", label: "Share the pitch and the campaign truths", hint: "Read the one-page setup together so everyone knows the tone and the premise." },
  { key: "tie-theme", label: "Tie each character to the theme", hint: "Why does this character care about what the campaign is about?" },
  { key: "tie-party", label: "Tie the characters to each other", hint: "Each player names one link to another character." },
  { key: "world-questions", label: "Ask the players about the world", hint: "Let them invent a detail or two: a rival, a hometown, a legend." },
  { key: "safety", label: "Agree on Lines and Veils", hint: "What never appears, and what happens off-screen. Agree how anyone can pause the game." },
  { key: "expectations", label: "Talk about expectations", hint: "How often you play, how deadly it is, how much combat vs roleplay." },
  { key: "characters", label: "Build the characters together", hint: "So the party covers each other and nobody duplicates a role by accident." },
];

/** The Lazy DM's eight steps (Sly Flourish), as the session prep sections. */
export const PREP_STEPS: GuideItem[] = [
  { key: "reviewCharacters", label: "Review the characters", hint: "What does each character want right now? What happened to them last time?" },
  { key: "strongStart", label: "Strong start", hint: "Open close to the action: something is already happening when the session begins." },
  { key: "scenes", label: "Potential scenes", hint: "A few words each, one or two per hour of play. They may not happen; that's fine." },
  { key: "secrets", label: "Secrets and clues", hint: "Ten one-sentence secrets the players could learn. Don't tie them to a place: reveal them wherever it fits." },
  { key: "locations", label: "Fantastic locations", hint: "A name and three striking details for each place they may visit." },
  { key: "npcs", label: "Important NPCs", hint: "Who they might meet: a name, a connection to the story, and a quick archetype." },
  { key: "monsters", label: "Relevant monsters", hint: "What fits the story and the locations, not only what's balanced." },
  { key: "rewards", label: "Magic items and rewards", hint: "Something they'll want, ideally tied to a character's story." },
];

/** How many secrets the Lazy DM suggests preparing. */
export const SUGGESTED_SECRETS = 10;

/** The New Campaign wizard's steps. */
export const WIZARD_STEPS: GuideItem[] = [
  { key: "pitch", label: "The pitch", hint: "One or two sentences: who the heroes are, what's wrong with the world, and what they'll do about it. Start small, a village and one urgent problem, and let the world grow from there." },
  { key: "truths", label: "Campaign truths", hint: "Three to seven facts the characters know about this world (\"The old empire fell to a dragon\"). They set the tone without a history lecture." },
  { key: "safety", label: "Lines and veils", hint: "Lines are content that never appears. Veils happen off-screen. Ask your players, and add to these any time." },
  { key: "structure", label: "How the story is shaped", hint: "Pick a structure for the first arc, or start blank. You can change it later." },
];

/** Short tips shown on empty or new things. */
export const TIPS = {
  emptyOutline: "Don't plan the whole campaign. Outline the first arc, prep the first session, and let the table show you what comes next.",
  arc: "An arc answers one big question. Write its synopsis as that question: \"Can the heroes stop the Ash Queen before the harvest?\"",
  chapter: "A chapter is an adventure with a goal. What do the heroes want, why do the players care, and how can it end, well or badly?",
  scene: "Prep situations, not plots: who is here, what do they want, what happens if the heroes do nothing?",
  threads: "Everything you set up should pay off. Add a thread for each promise, mystery and planted detail, then mark where it shows up.",
  threeClues: "The Three Clue Rule: for each conclusion the players must reach, place at least three clues. They will miss some.",
  status: "Keep a list of what changed in the world after each session: who died, who's angry, what moved. Your notes stay the plan; this is what's true now.",
  review: "Mark what actually happened. Scenes you didn't reach move to the next session, and so do unrevealed secrets.",
} as const;
