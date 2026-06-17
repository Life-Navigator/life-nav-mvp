# Pilot Analytics Implementation Report

**Date:** 2026-06-17 · Converts the Pilot Intelligence spec into working instrumentation on the **existing** event/feedback spine. No competing analytics system; no new tables beyond additive columns on the existing `analytics.pilot_feedback`.

## The one canonical path

```
Instrument component (FeedbackPrompt)
  → usePilotFeedback.submit({kind, metrics, insight_detected, surprised, nps, comment, context})
  → POST /api/feedback/pilot          (web proxy, stamps nothing — token only)
  → POST /v1/feedback                 (core-api; user_id from JWT, never body)
  → FeedbackService.submit            (validate + persist)
  → analytics.pilot_feedback          (THE canonical store)
  → PilotAnalyticsService.summary()   (admin rollup + instrument aggregation)
  → GET /v1/admin/pilot-analytics → /api/admin/pilot-analytics → /dashboard/pilot-analytics
```

The older web-direct `feedback_nps_responses` path is **left untouched** (legacy); all pilot instruments use the canonical `pilot_feedback` store the dashboard reads — so there is no competing/duplicate analytics system.

## Backend (core-api)

- **`app/services/pilot_service.py`** — `FeedbackService.submit` extended: accepts `kind`, a validated `metrics` map (0–10, whitelisted keys), `insight_detected`/`surprised` booleans, and `context`; legacy thumb/trust/usefulness/nps/comment still work. Resilient insert: if the gated metrics columns aren't present yet, it **retries with the legacy column subset** so feedback never silently fails.
- `PilotAnalyticsService.summary()` extended with an `instruments` block: per-metric averages + response counts + `insight_rate` + `holy_shit_rate` (counts/rates only, no PII).
- **Migration `20260617130000_pilot_feedback_metrics.sql`** (additive, idempotent, **GATED** on key rotation): `kind`, `metrics` JSONB, `context` JSONB, `insight_detected`, `surprised`.
- Tests: 4 new in `tests/test_pilot_service.py` (instrument capture, metric validation, instrument-only signal saves, aggregation rates). Full suite **515 pass**.

## Frontend (web)

- **Shared primitives:** `components/feedback/FeedbackPrompt.tsx` (scale/yes-no/text, thank-you + no-re-submit), `lib/feedback/usePilotFeedback.ts`, `app/api/feedback/pilot/route.ts`.
- **7 instruments** (`components/feedback/`): NarrativeAccuracy, Trust, RecommendationQuality (emits a composite `recommendation_quality` = mean of usefulness+actionability, plus both sub-scores), Insight, HolyShit, ReturnIntent, Nps.
- **Mounted:** NarrativeAccuracy + Insight + HolyShit in `DiscoveryReveal.tsx` (end-of-onboarding, only when `brief.ready`); Trust + RecommendationQuality on the recommendations page (tied to the lead rec id); ReturnIntent + Nps as a once-per-session card (sessionStorage-guarded).
- **Dashboard:** `app/dashboard/pilot-analytics/page.tsx` (+ `app/api/admin/pilot-analytics/route.ts` proxy) renders every metric against its Pilot Success Gate with pass/fail + honest "No responses yet" states; admin-gated (403 → admin-only).
- Tests: 12 instrument + 9 dashboard/proxy = **21 web tests**; type-check + eslint clean.

## Instrument → payload → gate map

| Instrument             | `kind`                 | Payload                                                        | Dashboard gate               |
| ---------------------- | ---------------------- | -------------------------------------------------------------- | ---------------------------- |
| Narrative Accuracy     | narrative_accuracy     | metrics.narrative_accuracy + comment + context.understood_well | > 8.5                        |
| Trust                  | trust                  | metrics.{trust,understanding,personalization}                  | trust > 8.0                  |
| Recommendation Quality | recommendation_quality | metrics.{usefulness,actionability,recommendation_quality}      | recommendation_quality > 8.0 |
| Insight                | insight                | insight_detected + comment                                     | insight_rate > 70%           |
| Holy-Shit              | holy_shit              | surprised + comment                                            | holy_shit_rate > 50%         |
| Return Intent          | return_intent          | metrics.return_intent + comment                                | > 8.0                        |
| NPS                    | nps                    | nps (0–10)                                                     | nps_score > 50               |

## Activation gate

Live capture of the new instrument fields requires applying the gated migration **after key rotation**. Until then, legacy fields persist and the new fields are accepted-but-not-stored (resilient fallback). See `PILOT_ANALYTICS_VALIDATION.md`.
