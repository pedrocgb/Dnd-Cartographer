# Campaign Writer — research

Reference material for the Campaign Writer feature: what existing apps do, what writers and game-master authors recommend, and which feature each idea turns into. Researched 2026-09-28.

Unverified: Matt Colville's "3 hooks" rule (no source found; closest is Sly Flourish's "offer three quests") and Mike Shea's "spark tables" as a named tool.

## 1. Existing apps

### TTRPG campaign managers
| App | What stands out |
|---|---|
| World Anvil | Campaign Manager with plots, sessions, GM screen. Plot articles form a parent/child plot tree. Plot = what you planned, Session Report = what happened. Timelines with eras, parallel timelines. Users ask for a "Related Plot" field on reports: the plan-to-play link is weak. |
| Kanka | Everything links through @mentions; `{` inserts an entry's fields. Quests track who is involved and who is "secretly pulling the strings". Journals hold session plans/recaps with real and in-game dates. Per-entry visibility. |
| LegendKeeper | Nested wiki, auto-linking, slash commands, templates. Boards whose cards link to pages/boards. Timelines in Chronicle, Gantt and Calendar views. `/secret` hidden blocks. |
| Obsidian Portal | Wiki plus Adventure Log (one post per session). GM-only pages, paid per-player secrets. |
| Notion templates | Linked databases (Adventures, Locations, NPCs, Sessions) with prep/recap templates in the Lazy DM style. |
| Obsidian + plugins | Local Markdown, [[wikilinks]], backlinks, graph. Dataview live queries: "open plot threads", "NPCs met in session 12". Fantasy Statblocks, Initiative Tracker. |
| Foundry VTT journal | Pages with per-page ownership, secret blocks revealed in one click. |
| Alchemy RPG | Scene-first: art, music, ambience bundled with notes. |

### Fiction writing tools
| App | What stands out |
|---|---|
| Campfire | Linked modules; Arcs follow a character from start state through change points; overlapping timelines; relationship web. |
| Plottr | Scene cards on a timeline, plotlines as colored rows; 30+ structure templates; Series Bible. |
| Scrivener | Binder, corkboard and outliner kept in sync; collections for alternate structures; snapshots before revising. |
| Novelcrafter | Codex auto-detects every mention in the manuscript; scene beats expanded into prose by AI. |
| Sudowrite | Story Bible feeds the AI; idea to outline to beats to draft. |
| Dabble | Plot Grid (plotlines against scenes), story notes, goals, focus mode. |
| Aeon Timeline | Same events in chronological order and narrative order; participants/witnesses; "subway" diagram of who meets whom. |
| Milanote | Freeform boards; RPG Campaign Map template. |
| Arcweave / Twine | Branching nodes with variables and conditions. |

### Patterns
- Common: linked entities with backlinks; typed templates; timelines with custom calendars; GM-only content; card/board views; session logs; beat templates.
- Innovative: planned vs played split; one set of events in many orders; plotline × scene grid; automatic mention detection; live queries for open threads; boards of live links; one-click reveals; hidden-faction field on quests.

### Pain points to avoid
- Clunky, overloaded UI and slow pages (World Anvil); steep setup (Obsidian); a writing app that can't write (Plottr).
- Notes scattered across apps; planned and played drifting apart; plot threads lost between sessions.
- Lost content from sync bugs: autosave and conflict handling must be reliable.

## 2. Writer and GM guidelines

### Story structure
| Framework | Guidance | Feature |
|---|---|---|
| Snowflake (Ingermanson) | Start from one sentence, expand to a paragraph, character summaries, synopsis, scene list; revise earlier steps as you go. | Outline grows by expansion: campaign pitch to arcs to chapters to scenes. |
| Save the Cat (Snyder/Brody) | 15 beats at rough percentages; opening and final images mirror each other. | Beat template with position hints. |
| Hero's Journey (Campbell/Vogler) | 12 stages; 8 archetypes are roles an NPC plays. | Beat template. |
| Story Circle (Harmon) | You, Need, Go, Search, Find, Take, Return, Change; small enough for one session. | Beat template for arcs or single sessions. |
| Three-Act | Setup ~25%, confrontation ~50% with a midpoint reversal, resolution ~25%. | Default arc template. |
| Kishōtenketsu | Intro, development, twist, conclusion; tension from discovery, not conflict. | Template for mystery or exploration arcs. |
| Sanderson | Promises, progress, payoff; magic solves problems only as far as players understand it; limits matter more than powers. | Promise threads with progress and payoff beats; warning when a promise is never paid off. |
| Stephen King | Start from a situation ("what if…"), not a plot. | Plain-language prompts in guides. |
| Vonnegut | Plot the hero's fortune over time. | Future: fortune line across sessions. |
| Chekhov's gun | Every setup should be used. In play, also link player-invented details to later payoffs. | Chekhov threads: planted / fired; list of unfired setups. |
| MICE (Card/Kowal) | Milieu, Inquiry, Character, Event threads; first opened, last closed. | MICE threads with nesting; warning when closed out of order. |
| Weiland | Lie, Truth, Want, Need, Ghost; positive, flat, negative arcs. | Future: character-arc fields on PCs/NPCs. |

### Campaign and session design
| Source | Guidance | Feature |
|---|---|---|
| Sly Flourish, Lazy DM | 8 steps: review characters, strong start, potential scenes, secrets and clues (10 one-sentence secrets not tied to a place), fantastic locations, important NPCs, relevant monsters, rewards. A menu, not a fixed order. | Session prep panel; secrets carried forward when unrevealed. |
| Sly Flourish, campaign start | Pitch, 3-7 campaign truths, session zero (tie characters to theme and each other, Lines & Veils), build outward in a spiral. | New Campaign wizard; session zero checklist. |
| The Alexandrian | Three Clue Rule: 3 clues per conclusion; don't prep plots, prep situations; node-based design where clues link nodes; campaign status document of what changed. | Clue coverage warnings; Campaign Status log. |
| Matt Colville | Start small: one village, one urgent hook, a 5-encounter dungeon. Don't build the world first. | Guide copy; empty state that starts small. |
| Fronts (Dungeon World) | Dangers with grim portents and an impending doom; stakes questions; campaign vs adventure fronts. | Already in the app; arcs and scenes link to fronts. |
| Blades in the Dark | Progress clocks of 4/6/8 segments, named after the obstacle. | Already in the app (quest and front clocks). |
| 5 Room Dungeon (Johnn Four) | Entrance/guardian, puzzle or roleplay, trick/setback, climax, reward/twist. Rooms are beats. | Chapter template. |
| Angry GM | Every adventure has a goal, motivation and resolution; every encounter a dramatic question. | Guide hints on chapters and scenes. |
| Never Unprepared (Vecchione) | Brainstorm, select, conceptualize, document, review. | Scene status: planned, ready. |
| Campaign pitch / bible | One-page pitch; the wiki is the bible; the status doc is the working version. | Campaign setup pitch and truths. |
| Safety tools | Lines (never appear), Veils (off-screen), X-Card, check-ins. | Lines & Veils list in campaign setup. |

## 3. Sources
- World Anvil: https://www.worldanvil.com/features/dnd-campaign-manager · https://www.worldanvil.com/learn/article-templates/plot · https://www.worldanvil.com/learn/article-templates/report
- Kanka: https://kanka.io/features · https://docs.kanka.io/en/latest/features/mentions.html
- LegendKeeper: https://www.legendkeeper.com/features/ · https://www.legendkeeper.com/boards-announcement/
- Obsidian Portal: https://www.rpg.net/reviews/archive/15/15080.phtml
- Notion: https://slyflourish.com/lazy_dnd_with_notion.html
- Obsidian: https://plugins.javalent.com/statblocks · https://productivematters.substack.com/p/obsidian-is-too-complicated
- Foundry: https://foundryvtt.com/article/journal/
- Alchemy: https://alchemyrpg.com/
- Campfire: https://www.campfirewriting.com/learn/timeline-tutorial
- Plottr: https://plottr.com/features/ · https://www.capterra.com/p/264561/Plottr/reviews/
- Scrivener: https://www.literatureandlatte.com/blog/integrating-scriveners-binder-corkboard-and-outliner
- Novelcrafter: https://www.novelcrafter.com/features
- Sudowrite: https://kindlepreneur.com/sudowrite-review/
- Dabble: https://www.dabblewriter.com/features
- Aeon Timeline: https://www.aeontimeline.com/features/narrative-storytelling
- Milanote: https://milanote.com/templates/game-design/rpg-campaign-map
- Arcweave: https://arcweave.com/features · Twine: https://twine2.neocities.org/
- Snowflake: https://www.advancedfictionwriting.com/articles/snowflake-method/
- Save the Cat: https://www.jessicabrody.com/2020/11/how-to-write-your-novel-using-the-save-the-cat-beat-sheet/
- Hero's Journey: https://www.storyflint.com/blog/heros-journey-christopher-vogler
- Story Circle: https://reedsy.com/blog/guide/story-structure/dan-harmon-story-circle/
- Kishōtenketsu: https://mythicscribes.com/plot/kishotenketsu/
- Sanderson: https://www.brandonsanderson.com/blogs/blog/brandon-sandersons-2025-guide-to-plot-lecture-2 · https://coppermind.net/wiki/Sanderson's_Laws_of_Magic
- Stephen King: https://www.shortform.com/blog/what-are-the-elements-of-a-story/
- Vonnegut: https://thestory.au/articles/kurt-vonnegut-story-shapes/
- Chekhov's gun: https://en.wikipedia.org/wiki/Chekhov%27s_gun
- MICE: https://writingexcuses.com/16-40-nesting-threads-in-the-m-i-c-e-quotient/
- Weiland: https://www.helpingwritersbecomeauthors.com/character-arcs-3/
- Lazy DM: https://slyflourish.com/eight_steps_2023.html · https://slyflourish.com/lazy_campaign_building_checklist.html · https://slyflourish.com/running_session_zeros.html
- The Alexandrian: https://thealexandrian.net/wordpress/1118/roleplaying-games/three-clue-rule · https://thealexandrian.net/wordpress/4147/roleplaying-games/dont-prep-plots · https://thealexandrian.net/wordpress/42961/roleplaying-games/smart-prep-part-4-campaign-status-documents
- Fronts: https://www.dungeonworldsrd.com/gamemastering/fronts/
- Clocks: https://bladesinthedark.com/progress-clocks
- 5 Room Dungeon: https://dndatwork.com/the-5-room-dungeon/
- Angry GM: https://theangrygm.com/hashtag-adventure-goals/
- Never Unprepared: https://enginepublishing.com/never-unprepared-the-complete-game-masters-guide-to-session-prep
- Safety tools: https://www.museumofplay.org/blog/keeping-the-adventure-fun-for-everyone-safety-tools-for-tabletop-roleplay-games/
