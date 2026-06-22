# RECOMMENDATIONS_VERIFICATION.md — Sprint 1

Live Playwright verification against prod (admin magic-link sessions). Real users.

## User A — has recommendations (`beta-journey-…-9`, 9 domain recs)

| Check                                     | Result                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Backend `GET /v1/recommendations/roadmap` | ✅ 200, `now:1 next:2 later:1 blocked_by:3` (3.4–3.6s)                                                |
| Page renders the roadmap                  | ✅ "Your Roadmap" with NOW/NEXT/LATER; e.g. NOW = RISK "Income loss while dependents rely on you"     |
| Advisor-grade detail                      | ✅ Why (priority formula) · objective linkage · evidence · confidence · Accept/Start/Complete/Dismiss |
| Render speed (post-fix)                   | ✅ full roadmap within 8s (was ~16s pre-fix)                                                          |

## User B — sparse data (`recon-…`)

| Check                             | Result                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Page reachable                    | ✅ (onboarded)                                                                                                |
| Render at 8s                      | 🟡 still "Building your roadmap…" — the ~3.5s roadmap compute + sync hasn't resolved in-window                |
| Honest empty state exists in code | ✅ the page renders an honest "no actions yet" empty when `now/next/later` are all empty (verified in source) |

## Verdict

- **Recommendations are NOT broken** — the page is advisor-grade and renders real, sequenced, explainable guidance.
- The Sprint-1 symptom ("blank") was **latency + a too-short validation wait**, now corrected and ~2× faster via stale-while-revalidate.
- **Residual:** the 3.5s roadmap-compute latency (User B still slow at 8s) → **Sprint 5 (Arcana performance)**, which should optimize the roadmap GET (serve cached recs, recompute in background) at the same time it fixes the advisor stall.

## Screenshot evidence

Captured `/dashboard/recommendations` rendering the full roadmap (NOW/NEXT/LATER + "unlock more by uploading"). Confirms advisor-grade surface, not a blank page.
</content>
