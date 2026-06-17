# Real-User Validation (Phase 8)

**Date:** 2026-06-16 · Live against production core-api v118 (deployed from `main`).

## Method

For each persona: mint a throwaway Supabase user, drive `/v1/life/discovery/chat` (open → vision → primary_goal = the statement), read the returned `assistant_message` (the next question) + `context_panel.narrative_theme`, clean up. Question classified generic if it matches "which matters most?/tell me more/what timeline/what would you like to accomplish"; else contextual.

## Results

- **Dominant narrative theme: 5/5 correct** (Family→Building a family foundation, Founder→Legacy & entrepreneurship, Burnout→Health & life balance, Career→Career acceleration, Crisis→Financial stabilization).
- **Question contextual (non-generic): 5/5.**
- Each question references the user's own goals, the conflict, the constraint, or the emotional state (verbatim quotes in `QUESTION_QUALITY_BENCHMARK.md`).

## Tests

`tests/test_discovery_intelligence.py` — 36 pass, incl. `test_crisis_gets_warm_stabilization_question_not_tradeoff`, `test_burnout_gets_balance_question_not_postpone_children`, `test_multipursuit_gets_concrete_tradeoff`. Full core-api suite: 485 pass, no regression.

## Note

A persona-seeded run was validated in the prior sprint (persona FI never contaminates). Fresh smoke users carry no persona seed; the narrative is driven purely by their words.
