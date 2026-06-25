# ONBOARDING_ADVISOR_INTERPRETATION_REPORT.md — 2026-06-25 (commit 4fc624c)

## Root cause

Onboarding runs in **discovery mode, which skips the LLM by design**. Goal extraction used
`LifeDiscoveryService.analyze_statement()` — a **regex clause-splitter** (splits on `,`/`and`/`then`…).
So "…get my financial, physical, and career foundation built" became fragments
("get my financial", "physical", "career foundation built"), each stored verbatim as a goal, and the
reply parroted them back ("I'm hearing a few priorities — 1)… Did I capture that correctly?") + asked a
premature "which would you postpone?". The advisor LLM (fixed last sprint) never ran in onboarding.
Second subtlety: the user's paragraph answers the **vision** step (`kind="vision"`), and `converse`
extracts goals from EVERY message at one line — that line was the fragment source, not the goal-step branch.

## Fix (fail-safe, gated on LLM success)

`RelationshipManager._interpret_plan(statement)` — an LLM interpreter that returns a clean structured plan:
complete human-readable goals each mapped to a domain (family/finance/health/career/education), a north
star, time horizon, values, explicit deprioritized domains, a 1-2 sentence **synthesis**, and **one sharp
prioritization question**. Wired at the always-runs extraction point in `converse`, so it covers the vision
turn. Clean goals replace fragments (persisted clean); the reflection synthesizes; the next question is the
LLM's prioritization Q. On any LLM failure / sub-6-word input → falls back to the deterministic extractor.
Gemini injected into RM via DI (same Vertex/WIF path as the advisor).

## Before → After (live, deployed 4fc624c, the exact reported conversation)

**Before — goals:** "Getting married next year", "Start a family", "This gives me a year to get my financial",
"Career foundation built", "I already have my degree", "But getting back in shape", "Building my financial
profile is" — and reply: "I'm hearing a few priorities — 1)… Did I capture that correctly?"

**After — goals:** "Get married" [family], "Start a family after getting married" [family], "Build a stronger
financial foundation" [finance], "Get back in physical shape" [health], "Build a solid career foundation"
[career]. **Reply:** "It's clear your focus is on establishing a strong foundation… I'm capturing these
pillars — 1) Get married; 2) Start a family; 3) Build a stronger financial foundation; 4) Get back in physical
shape; 5) Build a solid career foundation. **Deprioritized for now: education.** Of your three foundational
pillars—career, finance, and health—which one, if you made progress on it today, would create the most
positive momentum for the other two?"

## Test prompts (live)

| Prompt                                              | Result                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| T1 full paragraph                                   | ✅ clean north star + 5 domained goals, education deprioritized, prioritization Q                                 |
| T2 clarification ("family, security, performance…") | ✅ clean goals + values [family, security, performance]; no re-loop                                               |
| T3 "degree done, education not a priority"          | ⚠️ pure deprioritization, no goal → returns None → deterministic fallback (education already deprioritized in T1) |
| T4 "get back in shape, stamina, muscle"             | ✅ 3 clean health goals + good next Q                                                                             |
| T5 "improve finances before marriage"               | ✅ clean finance/family goals + values                                                                            |

## What this fixes (by priority)

1 (fragments) ✅ · 2 (synthesis not parrot) ✅ · 4 (no premature tradeoff Q) ✅ · 6 (domains correct →
coverage adjusts; education deprioritized) ✅ · 7 (clean persistence) ✅ · 8 (clarification updates, no loop) ✅.
Downstream/frontend layers (3 exact "What I learned" panel format, 5 explicit action objects, domain %
display tuning) now receive CLEAN data; their rendering is a separate UI layer.

## Files changed

relationship_manager.py (interpreter + wiring), dependencies.py (inject Gemini into RM),
tests/test_onboarding_interpreter.py (+3). 701 core tests pass.

## Remaining limitations

- Adds one LLM call per substantive discovery turn (~few s latency; gated to ≥6-word messages).
- T3-style pure deprioritization (no goal) falls back to deterministic extraction.
- Frontend "What I learned" panel / actions-unlocked rendering not re-verified visually this pass (engine
  output is clean; UI consumes candidate_goals + assistant_message + context_panel).
