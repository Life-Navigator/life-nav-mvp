# Pilot Analytics Validation

**Date:** 2026-06-17 · Honest: code-path + test validation. Live multi-user validation runs once the gated migration is applied (post key-rotation) and real pilot users submit.

## End-to-end event collection — verified (code path + tests)

| Step                                   | Verified | How                                                                                                                                                  |
| -------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instrument captures input              | ✅       | 12 instrument tests: each renders its questions, maps inputs to the correct `kind`/`metrics`/flags                                                   |
| Submits via the canonical hook         | ✅       | `usePilotFeedback` → `/api/feedback/pilot` (proxy test forwards token, passes upstream status)                                                       |
| Proxy → core-api `/v1/feedback`        | ✅       | `app/api/feedback/pilot/route.ts` forwards bearer token; user_id never from body                                                                     |
| `FeedbackService` validates + persists | ✅       | `tests/test_pilot_service.py`: instrument capture, metric whitelist/range, instrument-only signal saves                                              |
| Aggregation surfaces metrics           | ✅       | `_aggregate_instruments` test: averages + `insight_rate` + `holy_shit_rate` computed correctly                                                       |
| Dashboard renders against gates        | ✅       | 9 dashboard/proxy tests: gate pass/fail math, honest empty state at 0 rows, admin-only on 403                                                        |
| Metric keys line up end-to-end         | ✅       | every instrument's metric key ∈ backend `_METRIC_KEYS`; the dashboard's `recommendation_quality` gate is now populated by the instrument's composite |

**Coherence fix applied:** RecommendationQuality originally sent only `usefulness`/`actionability` while the dashboard gate read `recommendation_quality` (would have shown "No responses yet"). The instrument now also emits a composite `recommendation_quality` (mean of the two), so the gate is populated and the sub-scores remain visible.

## No duplicate analytics records — verified

- **One store:** all pilot instruments write `analytics.pilot_feedback` only. The legacy `feedback_nps_responses` path is untouched and not read by the pilot dashboard — no double-counting.
- **One row per submission:** each submit is a single insert; `FeedbackPrompt` switches to a thank-you state after success (the submit button is gone), so a user cannot double-submit the same prompt in-session (tested: "no duplicate submit").
- **Session prompts fire once:** ReturnIntent + NPS are guarded by a `sessionStorage` flag.
- **Skip sends nothing:** dismiss/skip never calls submit (tested) — no empty rows.
- **Resilient insert is not a duplicate:** the pre-migration fallback retries only when the first insert returned no row (i.e. nothing was stored) — it never inserts twice.

## No analytics regressions

- Full core-api suite **515 pass** (legacy feedback tests intact; `submit` backward-compatible).
- Web type-check + eslint clean; 21 pilot tests pass; existing suites unaffected (new files + additive edits).

## Acceptance criteria

| #   | Criterion                                      | Status                                                           |
| --- | ---------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Every pilot user generates measurable feedback | ✅ instruments mounted at onboarding + recommendations + session |
| 2   | Narrative Accuracy measurable                  | ✅                                                               |
| 3   | Trust measurable                               | ✅                                                               |
| 4   | Recommendation Quality measurable              | ✅ (composite + sub-scores)                                      |
| 5   | NPS measurable                                 | ✅                                                               |
| 6   | Return Intent measurable                       | ✅                                                               |
| 7   | Dashboard aggregates correctly                 | ✅ (tests)                                                       |
| 8   | No analytics regressions                       | ✅ (515 + 21 pass)                                               |
| 9   | Tests pass                                     | ✅                                                               |
| 10  | Ready for 3–5 user pilot                       | ✅ **after** the gated migration is applied + keys rotated       |

## The one remaining gate (operational)

Apply `supabase/migrations/20260617130000_pilot_feedback_metrics.sql` (additive) after key rotation so the
`metrics`/`insight_detected`/`surprised`/`context` columns exist for live capture. Until then, legacy
fields store and the new instrument fields are accepted-but-not-persisted (honest fallback, never a crash).
