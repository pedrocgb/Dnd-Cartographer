# D&D NPC Name Collection — 16,000 entries

Eight species files; four lists of 500 entries in each. Compiled 6 October 2026.

## Files and provenance

| Species | Male | Female | Optional middle | Surname / clan | Dataset / published reference | Original |
|---|---:|---:|---:|---:|---:|---:|
| [Humans](01-Humans-2000-Names.md) | 500 | 500 | 500 | 500 | 2000 | 0 |
| [Elves](02-Elves-2000-Names.md) | 500 | 500 | 500 | 500 | 27 | 1973 |
| [Dwarves](03-Dwarves-2000-Names.md) | 500 | 500 | 500 | 500 | 26 | 1974 |
| [Halflings](04-Halflings-2000-Names.md) | 500 | 500 | 500 | 500 | 27 | 1973 |
| [Orcs](05-Orcs-2000-Names.md) | 500 | 500 | 500 | 500 | 22 | 1978 |
| [Dragonborn](06-Dragonborn-2000-Names.md) | 500 | 500 | 500 | 500 | 23 | 1977 |
| [Gnomes](07-Gnomes-2000-Names.md) | 500 | 500 | 500 | 500 | 25 | 1975 |
| [Tieflings](08-Tieflings-2000-Names.md) | 500 | 500 | 500 | 500 | 25 | 1975 |

## What is sourced and what is original

Human entries are selected from 18 locale-specific Faker 40.41.0 person-name datasets. Their source codes and dataset license are in the human file. Locale is a usage pool, not an exclusive etymology. The human selection is contemporary and historical in flavor, not a verified early-medieval register.

Fantasy files are primarily original expansions, with a small reference selection from D&D, Tolkien, Baldur’s Gate 3, Warcraft, and The Elder Scrolls. Every row identifies its provenance. Original constructions are marked O; they are not claimed to be canonical, and incidental matches with existing names may occur. Each file reports exact sourced/original counts.

## Using the lists in your app

- Import the Name column as the value; retain Usage, Region/Style, and Provenance as optional filters.
- Select a first name and surname/clan independently; use the middle list only if the user enables a second given name.
- Human middle entries retain M/F dataset usage. Fantasy Any entries have no imposed gender restriction.
- Use region filters when a coherent human naming tradition is wanted. Name order, multiple surnames, and absence of a surname should remain configurable.
- Keep source-world filters if you want D&D and Tolkien names separated. Disable published-reference entries to avoid famous-character names in everyday NPC generation.
- For dragonborn, allow clan-first display. For orcs, do not blindly apply Elder Scrolls patronymics to other settings.
- Chinese and Korean Latin forms are approximate automatic transliterations; original scripts are provided. Japanese readings use the source provider’s paired forms.
- Names are unique across all four lists within each species file under accent-insensitive, case-insensitive, punctuation-insensitive comparison. Different species may share names.
- No model, AI service, or runtime generation is needed to use these static pools.

## Validation

All 32 sections contain exactly 500 rows, with numbering 1–500. Each species file contains 2,000 distinct normalized names. The package contains 16,000 entries, not necessarily 16,000 globally distinct spellings. Every data row has a nonempty name and provenance code.
