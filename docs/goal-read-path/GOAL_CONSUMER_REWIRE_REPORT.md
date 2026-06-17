# Goal Consumer Rewire Report

**Date:** 2026-06-17 · Read consumers only — write paths unchanged.

## Rewired to the canonical goal view

| Consumer                                                          | Before                                                                          | After (file:line)                                                                                                                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard goal cards** (`ExecutiveSummary.tsx`)                 | fetched `/api/goals` (`public.goals`) separately, unjoined                      | now prefers `canonical_goals` from the `/api/life/my-life` payload; `/api/goals` is a fallback only (`ExecutiveSummary.tsx` fetch + render: `progress ?? progress_percent`)                             |
| **Executive report** (`report_engine._advisor_executive_section`) | read `public.goals` directly (persona goals shown as tracked — Report Truth D2) | builds goals from `CanonicalGoalsService` (deduped, candidate-protected)                                                                                                                                |
| **`/v1/life/my-life`**                                            | no goal field                                                                   | adds `canonical_goals` (so the dashboard needs no extra fetch)                                                                                                                                          |
| **`/v1/life/goals`** (new)                                        | —                                                                               | `{goals,count,empty_message,source}` for any goal surface                                                                                                                                               |
| **Life Brief / narrative**                                        | already from `snapshot()` (candidate-protected)                                 | unchanged — these read the canonical _spine_ (objectives/portfolio) the join is built on, so they were already consistent                                                                               |
| **Recommendations**                                               | reference `snapshot()` objectives                                               | unchanged — objectives are canonical's #1 source, so recommendation goals and canonical goals share the same authoritative rows; `related_objective` on each canonical goal links back to the rec spine |

## Not rewired (by design)

- **Write paths** — `/api/goals` POST (goalsService), `discover_goal`, candidate persistence: untouched.
- **Graph** — reads the objective/edge model directly; the canonical view's `related_objective` keeps it aligned. Graph rewire is optional follow-up.

## Resilience

Every consumer degrades safely: the dashboard falls back to `/api/goals` if `canonical_goals` is absent;
`report_engine` and `my_life` wrap the join in try/except → `[]` on failure (honest empty, never a crash).
