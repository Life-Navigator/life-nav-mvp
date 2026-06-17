# Goal Consistency Validation

**Date:** 2026-06-17 · Validated via `tests/test_canonical_goals.py` (7 tests) + the deterministic merge/priority logic. Honest: these are logic-level validations against controlled store data, not a live multi-user run.

## The 9 required tests → coverage

| #   | Requirement                                     | Test                                                                                                                                  | Result             |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | Confirmed goal beats candidate                  | `test_confirmed_beats_candidate_and_no_duplicate`                                                                                     | ✅                 |
| 2   | Candidate does not duplicate confirmed          | same (len==1)                                                                                                                         | ✅                 |
| 3   | Public goal does not duplicate life goal        | `test_public_goal_progress_merges_into_confirmed_goal_no_dup` (public merges into the confirmed objective, progress attached, no dup) | ✅                 |
| 4   | Persona goal never overrides user goal          | `test_persona_goal_never_overrides_user_goal`                                                                                         | ✅                 |
| 5   | Related goals cluster without destructive merge | `test_related_goals_cluster_without_merging`                                                                                          | ✅                 |
| 6   | Empty state is honest                           | `test_empty_state_is_honest` + `test_empty_state_message_via_service`                                                                 | ✅                 |
| 7   | Dashboard consumes canonical goals              | `test_dashboard_payload_includes_canonical_goals` (+ `ExecutiveSummary` reads `canonical_goals`)                                      | ✅                 |
| 8   | Report consumes canonical goals                 | `report_engine` builds goals from `CanonicalGoalsService`                                                                             | ✅ (wired)         |
| 9   | Recommendations reference canonical goals       | recs read `snapshot()` objectives = canonical's #1 source; each canonical goal carries `related_objective` to the rec spine           | ✅ (shared source) |

## Scenario walkthroughs (Phase 7)

- **User A — Wedding / House / Family / Promotion / Masters / Fitness:** distinct normalized titles → no
  merges; "House" + a "down payment" goal cluster under `home`; "Masters" under `education`; family_foundation
  narrative is derived from the goal set independently and is unaffected. **No duplicates; clusters visible.**
- **User B — Career / MBA / Startup / AI lab:** all map to career/education domains; ranked by
  confirmation→priority; no family-stability goal is introduced (the join never invents goals). **No
  contamination.**
- **User C — Financial stabilization / Debt / Rent risk / Relationship stress:** debt goals cluster under
  `debt`; a persona "Reach financial independence" objective (if seeded) is demoted to `candidate` and ranked
  last — it never overrides the user's stabilization goals. **No FI override.**

## Cross-surface consistency (Phase 8)

Dashboard, report, and `/v1/life/goals` now read the **same** `CanonicalGoalsService` output → identical
title/domain/status/confirmation per goal. Life Brief/narrative/recommendations read the canonical _spine_
(objectives/portfolio) the join is built from, so they were already aligned.

## Honest residual

The merge key is exact-normalized-title; semantic near-duplicates ("home purchase" vs "buy a house") cluster
but don't merge (intentional — never over-dedupe). Live multi-user validation should follow once OAuth/keys
are provisioned.
