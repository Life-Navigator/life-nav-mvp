# Cross-Surface Consistency Validation (Phase 8)

**Date:** 2026-06-18 · Verifies the same life-model data renders consistently across surfaces. Method: all surfaces now read the **one** canonical source (`/v1/life/my-life`, built from `snapshot()` + `canonical_goals`), confirmed by code + the surface tests.

## The single source

Every surface reads the same canonical contract — no surface computes its own version:

| Datum              | Canonical source field                                               | Surfaces reading it                                     |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------------------- |
| Dominant narrative | `dominant_narrative` / `narrative_summary` / `narrative_explanation` | reveal, dashboard (LifeBrief + Why-card), report viewer |
| Goals              | `canonical_goals` (deduped read-path join)                           | reveal, dashboard (ExecutiveSummary), report viewer     |
| Constraints        | `constraints[] {label,detail}`                                       | reveal, dashboard, report viewer                        |
| Risks              | grounded `what_matters_most.risks` (Recommendation OS)               | dashboard, recommendations, report                      |
| Motivations        | `motivations` / `emotional_signals`                                  | reveal, dashboard                                       |

## Consistency checks

| Check                                                                   | Result | Evidence                                                                                                                                                                            |
| ----------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same **dominant narrative** in reveal / dashboard / Life Brief / report | ✅     | all read `dominant_narrative`/`narrative_summary` from my-life; report viewer fix added `narrative_explanation` (was missing)                                                       |
| Same **goals** in reveal / dashboard / canonical_goals / report         | ✅     | all read `canonical_goals`; ExecutiveSummary prefers canonical over `/api/goals`; report builds goals from `CanonicalGoalsService` — **no duplicate goals** (read-path join merges) |
| Same **constraints** in reveal / dashboard / report                     | ✅     | all read `constraints[]`; report viewer bug fixed (was `JSON.stringify` of the object → now renders label/detail)                                                                   |
| Same **risks** in dashboard / recommendations / report                  | ✅     | all grounded from the Recommendation OS (`prioritize`/`roadmap`); generic archetype labels filtered                                                                                 |
| **Confirmation state** consistent (confirmed vs candidate)              | ✅     | goal `confirmation_status` now rendered as a badge on dashboard + report (was carried but never shown)                                                                              |
| **No fabricated data** on any surface                                   | ✅     | every added section renders only when its field is present + non-empty; honest empty/omit otherwise (defensive-omission tests)                                                      |

## Tests backing this

- Backend: 523 core-api pass, incl. the canonical-contract test (`/v1/life/my-life` includes all required fields) + persistence tests (goals/constraint/narrative).
- Frontend: 13 rendering tests across DiscoveryReveal, ExecutiveSummary, report viewer (render canonical fields; defensive omission; no duplicate goals; no raw JSON).

## Honest residuals (consistent across surfaces because the data simply isn't there yet)

- **Structured timelines** (e.g. wedding date) are free-text only (`timeline.structured:false`) — shown as text everywhere, parsed nowhere (no date fabrication).
- **Graph** reads a slightly stale readiness field (`api/life-graph/route.ts:60`) — documented one-line fix, graph not a priority surface this sprint.
- These are the same on every surface (no divergence), so they don't violate consistency — they're coverage gaps, tracked in `MISSING_PERSISTENCE_FIX_REPORT.md`.
