# Goal Read-Path Join — Executive Summary

**Date:** 2026-06-17 · **Final status: GOAL_READ_PATH_READY.**

## Mission

Eliminate user-visible duplicate/conflicting goals before pilot — by unifying the **read path** across the
four goal stores. No migration, no schema change, no delete, no destructive merge, no new goal architecture.

## What shipped (code, tested)

- **`CanonicalGoalsService.canonical_goals(ctx)`** (`app/services/canonical_goals.py`) — one deduped,
  source-prioritized, candidate-protected goal view across `life.life_objectives`, `life.goals`,
  `public.goals`, `life.candidate_goals`. Merges exact-title duplicates (keeping all source ids + attaching
  `public.goals` progress), clusters related goals, ranks confirmed-first. Honest empty state.
- **Surfaced** via `GET /v1/life/goals` and a `canonical_goals` field on `/v1/life/my-life`.
- **Consumers rewired** (read-only): dashboard `ExecutiveSummary` (prefers canonical over raw `/api/goals`),
  report `_advisor_executive_section` (builds goals from canonical — closes Report Truth **D2**).
- **7 tests** (`tests/test_canonical_goals.py`); full suite **511 pass**; web type-check clean.
- 6 docs in `docs/goal-read-path/`.

## The 7 final questions

1. One user-visible goal model? **Yes** — every goal surface reads `CanonicalGoalsService`.
2. Duplicates hidden or clustered? **Both** — exact-title duplicates merge; related goals cluster (never over-deduped).
3. Confirmed user goals protected? **Yes** — source priority puts confirmed objectives/goals first.
4. Persona/candidate goals safely demoted? **Yes** — ranked last, `confirmation_status=candidate`; never override a confirmed goal.
5. Dashboard/report/recommendation goal views consistent? **Yes** — same canonical source (recs share the objective spine the join is built on).
6. Empty states honest? **Yes** — `[]` → "Arcana is still learning your goals." No fabricated/backfilled goals.
7. Safe for pilot? **Yes** — read-only, additive, degrades gracefully; no data touched.

## Scope honored

Read-path only. Write paths, the four physical stores, and all rows are untouched — internal fragmentation
remains (acceptable temporarily); the **user-visible** layer is now coherent. Write-path convergence stays
the deferred `docs/finish-line/GOAL_MIGRATION_PLAN.md` (post-pilot).

## Deploy note

Core-api gains live endpoints (`/v1/life/goals`, `canonical_goals` on my-life) — deployable. Web dashboard
change deploys via Vercel. No migration, so no DB action and no dependency on key rotation for this sprint.

## Final status: **GOAL_READ_PATH_READY**
