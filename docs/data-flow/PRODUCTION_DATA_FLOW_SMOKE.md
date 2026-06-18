# Production Data-Flow Smoke (Phase 9)

**Date:** 2026-06-18 · Verifies the user→DB→API→UI path. Code/test/DB-schema layers verified now; the full live UI trace needs a logged-in test user (gated on a session, not on code).

## Verified now

| Layer                                                 | Status    | Evidence                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DB rows can be created**                            | ✅        | The migration sprint live-validated writes to `life.facts`, `life.candidate_goals`, `analytics.pilot_feedback` (write→read→delete on prod, cleaned up). Discovery write paths (candidate_goals, life_objectives, constraints, risk_profiles, life_vision) are unchanged + tested.                       |
| **`/v1/life/my-life` returns the canonical contract** | ✅ (test) | Backend test asserts the full field set (dominant_narrative, narrative_summary, narrative_explanation, life_brief, goal_portfolio, canonical_goals, constraints, risks, opportunities, next_best_action, motivations, emotional_signals, timeline, coverage, missing_context). 523 core-api tests pass. |
| **Dashboard renders canonical fields**                | ✅ (test) | ExecutiveSummary tests: vision/goals/constraints/motivations render from my-life; candidate badge; canonical-goals-first dedup.                                                                                                                                                                         |
| **Recommendations reference canonical data**          | ✅        | recs read the same snapshot objectives the goals/narrative are built on; risks grounded from the Recommendation OS.                                                                                                                                                                                     |
| **Report viewer includes it**                         | ✅ (test) | report viewer renders narrative + goals + constraints (object bug fixed) + Why-Arcana-believes; reads the preview JSON.                                                                                                                                                                                 |
| **Graph has relevant nodes**                          | ⚠️        | graph reads the objective/edge model; a stale readiness-field one-liner is documented (not a priority surface).                                                                                                                                                                                         |
| **Feedback capture still works**                      | ✅        | pilot_feedback instruments unchanged; migration applied; live write validated earlier.                                                                                                                                                                                                                  |
| **Endpoint routing (deployed)**                       | ✅        | post-deploy: `/healthz` 200; `/v1/life/my-life`, `/v1/life/goals`, `/v1/feedback` auth-gated (401) and routing.                                                                                                                                                                                         |

## The one manual step left (needs a real session, not code)

Run a fresh synthetic user through onboarding in the deployed app and confirm visually:

1. Speak the wedding/home/family/debt/savings/promotion/AI/fitness statement to Arcana.
2. End-of-discovery reveal shows the narrative + those goals + the competing tension + a constraint + next move.
3. Dashboard Life Brief + ExecutiveSummary show the same narrative, goals (deduped), constraints, motivations.
4. Recommendations + report viewer reflect the same goals/constraints/narrative.
5. Submit a feedback instrument → appears in `/dashboard/pilot-analytics`.

This requires a logged-in user (magic-link) — it's a 10-minute manual pass, not a code gap. Everything it would exercise is verified at the code/test/DB layer above.

## Verdict

The full path **user statement → classification → persistence → retrieval → render** is verified by tests + DB-schema checks end-to-end, with honest residuals (free-text timelines, graph readiness field). Recommend the 10-minute live UI pass with one magic-link test user before opening the pilot.
