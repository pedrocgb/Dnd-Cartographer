/**
 * Story structures the writer can lay out under a campaign, an arc or a
 * chapter (pure data). Applying one creates a child per beat, each with the
 * beat's hint as its synopsis prompt. `pct` is roughly where the beat falls
 * in the story, for pacing.
 */

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

export const STORY_TEMPLATES: StoryTemplate[] = [
  {
    key: "three-act",
    name: "Three acts",
    source: "Classic structure",
    summary: "Setup, confrontation, resolution. The simplest shape that always works.",
    bestFor: "A whole campaign or a long arc",
    beats: [
      { key: "setup", name: "Act I: Setup", hint: "Who the heroes are, what their world is like, and the event that pulls them in.", pct: 0 },
      { key: "confrontation", name: "Act II: Confrontation", hint: "Rising trouble. Halfway through, a reversal changes what the heroes think the story is about.", pct: 25 },
      { key: "resolution", name: "Act III: Resolution", hint: "The crisis, the final confrontation, and what the world looks like after.", pct: 75 },
    ],
  },
  {
    key: "save-the-cat",
    name: "Save the Cat",
    source: "Blake Snyder, Jessica Brody",
    summary: "Fifteen beats with a place for everything, from the opening image to its mirror at the end.",
    bestFor: "An arc with a strong emotional change",
    beats: [
      { key: "opening-image", name: "Opening image", hint: "A snapshot of the heroes' world before the story changes it.", pct: 0 },
      { key: "theme-stated", name: "Theme stated", hint: "Someone hints at the lesson the heroes will have to learn.", pct: 5 },
      { key: "setup", name: "Setup", hint: "The status quo and what's missing from it. Introduce the key NPCs.", pct: 6 },
      { key: "catalyst", name: "Catalyst", hint: "The event that knocks the heroes out of their routine.", pct: 10 },
      { key: "debate", name: "Debate", hint: "Should they go? What does it cost to say yes?", pct: 12 },
      { key: "break-into-two", name: "Break into Two", hint: "They choose to act and step into the new world.", pct: 20 },
      { key: "b-story", name: "B story", hint: "A relationship (ally, rival, mentor) that carries the theme.", pct: 22 },
      { key: "fun-and-games", name: "Fun and games", hint: "The promise of the premise: the adventure the players signed up for.", pct: 30 },
      { key: "midpoint", name: "Midpoint", hint: "A false victory or false defeat; the stakes go up.", pct: 50 },
      { key: "bad-guys-close-in", name: "Bad guys close in", hint: "The enemy regroups; doubts and cracks inside the party.", pct: 55 },
      { key: "all-is-lost", name: "All is lost", hint: "The lowest point. Something (or someone) is lost.", pct: 75 },
      { key: "dark-night", name: "Dark night of the soul", hint: "The heroes face what they must change.", pct: 78 },
      { key: "break-into-three", name: "Break into Three", hint: "The insight that gives them a way forward.", pct: 80 },
      { key: "finale", name: "Finale", hint: "They storm the castle using everything they learned.", pct: 85 },
      { key: "final-image", name: "Final image", hint: "Mirror the opening image: show how the world and the heroes changed.", pct: 100 },
    ],
  },
  {
    key: "heros-journey",
    name: "Hero's Journey",
    source: "Joseph Campbell, Christopher Vogler",
    summary: "Twelve stages from the ordinary world into the unknown and back, changed.",
    bestFor: "An epic arc or a whole campaign",
    beats: [
      { key: "ordinary-world", name: "Ordinary world", hint: "The heroes' normal life, and what they lack.", pct: 0 },
      { key: "call", name: "Call to adventure", hint: "A problem or challenge arrives (a Herald brings it).", pct: 8 },
      { key: "refusal", name: "Refusal of the call", hint: "Fear, duty or doubt holds them back.", pct: 12 },
      { key: "mentor", name: "Meeting the mentor", hint: "Someone offers advice, training or a gift.", pct: 16 },
      { key: "threshold", name: "Crossing the threshold", hint: "They commit and enter the unknown; a Threshold Guardian tests them.", pct: 25 },
      { key: "tests", name: "Tests, allies, enemies", hint: "They learn the new world's rules and who stands where.", pct: 30 },
      { key: "approach", name: "Approach", hint: "Preparing for the central ordeal; plans and doubts.", pct: 45 },
      { key: "ordeal", name: "The ordeal", hint: "The biggest challenge so far: a brush with death.", pct: 50 },
      { key: "reward", name: "Reward", hint: "They seize the sword, the secret or the victory.", pct: 60 },
      { key: "road-back", name: "The road back", hint: "Consequences chase them; the enemy strikes back.", pct: 75 },
      { key: "resurrection", name: "Resurrection", hint: "The final test, where they prove what they've become.", pct: 90 },
      { key: "return", name: "Return with the elixir", hint: "They come home with something that changes their world.", pct: 100 },
    ],
  },
  {
    key: "story-circle",
    name: "Story Circle",
    source: "Dan Harmon",
    summary: "Eight steps, small enough for a single session or adventure.",
    bestFor: "A chapter or one session",
    beats: [
      { key: "you", name: "1. You", hint: "A character in their comfort zone.", pct: 0 },
      { key: "need", name: "2. Need", hint: "They want something.", pct: 12 },
      { key: "go", name: "3. Go", hint: "They enter an unfamiliar situation.", pct: 25 },
      { key: "search", name: "4. Search", hint: "They adapt to it and struggle.", pct: 37 },
      { key: "find", name: "5. Find", hint: "They get what they wanted.", pct: 50 },
      { key: "take", name: "6. Take", hint: "They pay a heavy price for it.", pct: 62 },
      { key: "return", name: "7. Return", hint: "They go back to the familiar.", pct: 75 },
      { key: "change", name: "8. Change", hint: "They've changed, for better or worse.", pct: 88 },
    ],
  },
  {
    key: "kishotenketsu",
    name: "Kishōtenketsu",
    source: "Chinese and Japanese storytelling",
    summary: "Four parts driven by a twist that reframes everything, not by a fight.",
    bestFor: "Mystery, exploration or a quiet arc without a villain",
    beats: [
      { key: "ki", name: "Ki: Introduction", hint: "Show the characters and their world.", pct: 0 },
      { key: "sho", name: "Shō: Development", hint: "Follow them deeper; nothing changes yet.", pct: 25 },
      { key: "ten", name: "Ten: Twist", hint: "An unexpected turn that makes the players see everything differently.", pct: 50 },
      { key: "ketsu", name: "Ketsu: Conclusion", hint: "Bring it together: what does the twist mean for them?", pct: 75 },
    ],
  },
  {
    key: "five-room",
    name: "5 Room Dungeon",
    source: "Johnn Four",
    summary: "Five beats for a 2 to 4 hour adventure. Rooms are story beats, not literal rooms.",
    bestFor: "A chapter or one session",
    beats: [
      { key: "entrance", name: "1. Entrance and guardian", hint: "Why hasn't anyone found this yet? Something guards the way in.", pct: 0 },
      { key: "puzzle", name: "2. Puzzle or roleplay", hint: "A challenge that can't be solved with steel.", pct: 20 },
      { key: "setback", name: "3. Trick or setback", hint: "A trap, a betrayal or a twist that raises the tension.", pct: 40 },
      { key: "climax", name: "4. Climax", hint: "The big fight or conflict.", pct: 60 },
      { key: "reward", name: "5. Reward, revelation, twist", hint: "What they gain, and what it reveals.", pct: 80 },
    ],
  },
];

export const templateByKey = (key: string | null | undefined): StoryTemplate | null => STORY_TEMPLATES.find((t) => t.key === key) ?? null;

export const beatOf = (templateKey: string | null | undefined, beatKey: string | null | undefined): Beat | null =>
  templateByKey(templateKey)?.beats.find((b) => b.key === beatKey) ?? null;
