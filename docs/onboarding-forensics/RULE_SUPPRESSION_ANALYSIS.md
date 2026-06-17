# Rule Suppression & Conflict Analysis (Phase 3 + Phase 7)

**Evidence-only.** Inventories the advisor/discovery rules present **in this repo** and analyzes conflicts. Rules that govern the deployed service are `EXTERNAL` (not in this repo).

## Phase 3 — Rule inventory (in-repo discovery path only)

These are the rules that the **in-repo** `RelationshipManager` enforces. They describe a conversational discovery — they are NOT the source of the observed behavior; they are its opposite.

| Rule ID                | Location                                                                                                   | Purpose                                                                             | Status           | Severity | Applies to | Source | Class               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------- | -------- | ---------- | ------ | ------------------- |
| DISC-Q-BANK            | `relationship_manager.py:40-62` (`STEPS`)                                                                  | fixed, warm discovery questions asked one at a time                                 | active (in-repo) | —        | discovery  | code   | Discovery           |
| DISC-ONE-AT-A-TIME     | `relationship_manager.py:227-344` (`converse`)                                                             | answer pending → reflect → ask the _next_ single question                           | active (in-repo) | —        | discovery  | code   | Discovery           |
| DISC-REFLECT-OWN-WORDS | `relationship_manager.py:296-314` ("Rule 3: EXTRACT first, classify later — reflect the user's OWN words") | echo the user's own phrasing, not a reframed analysis                               | active (in-repo) | —        | discovery  | code   | Output Construction |
| DISC-WRITE-CANONICAL   | `relationship_manager.py:160-201`                                                                          | persist each answer to the canonical life model; show "✓ updated"                   | active (in-repo) | —        | discovery  | code   | Discovery           |
| DISC-NO-LLM            | `relationship_manager.py` (0 model calls; E3)                                                              | discovery is deterministic, no generation                                           | active (in-repo) | —        | discovery  | code   | Prompting           |
| DISC-CONTEXT-PANEL     | `relationship_manager.py:212-220` (`_context_panel`)                                                       | expose `primary_objective` (title) + themes to the UI panel                         | active (in-repo) | —        | discovery  | code   | Output Construction |
| DISC-COVERAGE          | `services/discovery_coverage.py` (`get_discovery_coverage`)                                                | track per-domain coverage %                                                         | active (in-repo) | —        | discovery  | code   | Discovery           |
| OBJ-CONFIDENCE         | `services/life_discovery.py:149-201`                                                                       | objective is inferred WITH a confidence score + alternatives (not asserted as fact) | active (in-repo) | —        | discovery  | code   | Validation          |

### Rules that WOULD produce the observed behavior — inventory result

| Rule the output implies                                          | In this repo?                                                                                  |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| "always provide a tradeoffs section"                             | **ABSENT**                                                                                     |
| "always provide What we know / My read / What would change this" | **ABSENT**                                                                                     |
| "append an advice disclaimer to chat turns"                      | **ABSENT** (the only UI disclaimer is the unmerged `lib/advice/disclosure.ts`, different text) |
| "lead with analysis / reasoning before questions"                | **ABSENT** (in-repo rule is the opposite: DISC-REFLECT-OWN-WORDS + DISC-ONE-AT-A-TIME)         |
| "assert the primary objective as fact"                           | **ABSENT** (in-repo OBJ-CONFIDENCE keeps it a scored candidate)                                |

All such rules are `EXTERNAL` (deployed core-api, not in this repo).

## Phase 7 — Prompt/rule conflict analysis

A genuine conflict requires both sides to exist in the same codebase. **In this repo, only the conversational side exists.** The opposing ("always analyze / always disclaim / always tradeoff") side is `EXTERNAL`. So the conflict is _cross-codebase_:

| Conflict                                                | Conversational side (in-repo, file:line)                                                | Analytical side               | Which wins in production              | Why                                                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Be conversational vs. always provide tradeoffs          | DISC-ONE-AT-A-TIME `relationship_manager.py:227-344`; DISC-REFLECT-OWN-WORDS `:296-314` | `EXTERNAL` (deployed advisor) | **Analytical wins** (observed output) | the deployed route runs the `EXTERNAL` advisor, bypassing the in-repo discovery rules entirely (Phase 1, E4)     |
| Ask questions first vs. provide recommendation/analysis | DISC-Q-BANK `:40-62`                                                                    | `EXTERNAL`                    | **Analytical wins**                   | same                                                                                                             |
| Reflect the user's own words vs. reframe + "My read"    | DISC-REFLECT-OWN-WORDS `:296-314`                                                       | `EXTERNAL`                    | **Analytical wins**                   | same                                                                                                             |
| Objective as scored candidate vs. objective as fact     | OBJ-CONFIDENCE `life_discovery.py:149-201`                                              | `EXTERNAL`                    | **Fact framing wins**                 | the `EXTERNAL` composition restates the seeded objective declaratively (see DISCOVERY_MODE_GAP_ANALYSIS Phase 4) |
| No disclaimer in discovery vs. always disclaim          | (no disclaimer rule in in-repo discovery)                                               | `EXTERNAL`                    | **Disclaim wins**                     | the disclaimer string is `EXTERNAL` (E6)                                                                         |

### Why "suppression," precisely

The in-repo conversational rules are not _overridden line-by-line_ — they are **not executed at all** in production, because the deployed `/v1/life/discovery/chat` runs a different implementation than the in-repo `RelationshipManager` (Phase 1 boundary; E2–E4). The suppression mechanism is **route-level replacement**, not rule precedence. That is the strongest provable statement; the deployed override's internals are `EXTERNAL`.
