# Pilot Feedback Validation

**Date:** 2026-06-17 · Logic: **VALIDATED** (tests). Live persistence: **PENDING APPLY**.

## Validated now (no prod needed) — `tests/test_pilot_service.py`

| Behavior                                                                | Evidence                                                    |
| ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| All instruments accepted (kind + metrics + insight/holy-shit + context) | `test_feedback_accepts_instruments`                         |
| Metric whitelist + 0–10 range enforced                                  | `test_feedback_metric_validation_drops_bad_keys_and_ranges` |
| Instrument-only signal saves (e.g. just an insight answer)              | `test_feedback_instrument_only_signal_saves`                |
| Aggregation computes averages + insight_rate + holy_shit_rate           | `test_aggregate_instruments_computes_rates`                 |
| Legacy thumb/trust/usefulness/nps still works                           | existing pilot tests (backward compatible)                  |

Front-end instrument → payload mapping verified by 12 web tests (`components/feedback/__tests__/instruments.test.tsx`).

## Instrument → storage (post-migration)

| Instrument             | Stored as                                                      |
| ---------------------- | -------------------------------------------------------------- |
| Narrative Accuracy     | `metrics.narrative_accuracy` (0–10)                            |
| Trust                  | `metrics.trust` (+ understanding, personalization)             |
| Recommendation Quality | `metrics.recommendation_quality` (+ usefulness, actionability) |
| Insight                | `insight_detected` boolean                                     |
| Holy-Shit              | `surprised` boolean                                            |
| Return Intent          | `metrics.return_intent` (0–10)                                 |
| NPS                    | `nps` column (0–10)                                            |

## Pending live validation (AFTER applying `20260617130000_pilot_feedback_metrics.sql`)

1. Confirm `analytics.pilot_feedback` has `metrics` (jsonb), `context` (jsonb), `kind`, `insight_detected`, `surprised`.
2. POST one synthetic submission per instrument via `/v1/feedback` (auth as a test user); confirm each row persists with the right `kind` + `metrics`/flags, scoped to the user.
3. Confirm the **resilient insert** path is no longer triggering the legacy fallback (i.e. `stored:true`, not `degraded:true`) once columns exist.
4. Confirm `GET /v1/admin/pilot-analytics` `instruments` block returns non-empty `averages` + `insight_rate` + `holy_shit_rate` for the synthetic data.
5. Confirm RLS: the test user reads only their own feedback; the admin rollup (service-role) sees counts only (no PII).

## Status

**Feedback logic READY; live persistence of the new instrument fields BLOCKED on apply.** Pre-migration, the service degrades honestly (legacy fields persist; new fields accepted-not-stored).
