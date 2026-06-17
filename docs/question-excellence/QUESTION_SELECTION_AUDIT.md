# Question Selection Audit (Phase 1)

**Date:** 2026-06-16 · Why generic questions appeared, and every route that could produce one.

## The bug (root cause)

`converse()` answered a pending step then built the next question from `st = res` — the state `answer()` computed **before** `converse()` persisted this turn's candidate goals. So `state()` saw an empty candidate-goals table:

- Signal-based narratives (legacy/health/finance) still classified (they read the raw text) → got rich questions.
- Domain-based narratives (family/career) need goal-domains → fell back to **generic** "which matters most?".

## Generic routes found

| Route                                | Generic output                                       | Status                                                                             |
| ------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| FLOW `priority` step default prompt  | "Of everything you just shared, which matters most?" | **fixed** — now overridden by `narrative_question()` whenever a narrative is known |
| `converse()` using pre-persist state | family/career → generic                              | **fixed** — recompute `state()` after persisting candidate goals                   |
| FLOW `financial_goal` step           | "Is there anything about money…?"                    | partially mitigated (only reached after the priority moment); disclosed residual   |
| FLOW `time_horizon` step             | "What timeline are you targeting?"                   | only reached late; disclosed residual                                              |
| `correction` branch                  | "Tell me again, in your own words…"                  | intentional (user is correcting us) — kept                                         |

## What contextual info was available but unused (before the fix)

The full narrative text, the candidate goals across 5 domains, the dominant narrative, and the emotional signals were all available — but the question was composed from stale (pre-persist) state. The fix makes the priority question consume all of it.

## After

All five validation personas produce a context-referencing priority question live (0 generic). Subsequent FLOW steps (risk/constraint/financial) remain template prompts — disclosed in `QUESTION_QUALITY_BENCHMARK.md` as the residual; the priority question is the decisive discovery moment.
