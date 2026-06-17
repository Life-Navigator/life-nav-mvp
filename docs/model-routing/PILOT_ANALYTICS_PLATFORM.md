# Pilot Analytics Platform (Pilot Readiness)

## Data sources (all live/coded)

- `analytics.advisor_turns` (existing) — per-turn outcomes (enhanced/fallback/safety_fallback), latency,
  tokens, validator results.
- `analytics.events` (existing) — funnel/activation events (`/v1/events` emit).
- `analytics.model_usage` (new migration) — premium/standard calls, reports, fallbacks, cost per user/month.
- `analytics.pilot_feedback` (+ `pilot_feedback_summary` view, new migration) — thumbs/ratings/NPS.

## Endpoints (admin-only; counts/rates only, no PII)

- `GET /v1/admin/pilot-analytics` (new, `PilotAnalyticsService`): advisor totals + enhanced rate +
  safety-fallback count + feedback summary (avg trust/usefulness/recommendation, thumbs, **computed NPS**).
- `GET /v1/admin/metrics` + `GET /v1/admin/advisor-metrics` (existing): platform funnel + advisor
  observability (fallback rate, latency p95, validator failures, tokens).

## Pilot metrics coverage

| Metric                    | Source                                         | Status                                                             |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| activation                | analytics.events (signup→first turn)           | available (events)                                                 |
| engagement / session      | advisor_turns + events                         | available                                                          |
| domain usage              | routing decisions (logged) / advisor_turns     | available via logs; add a domain column for SQL rollup (follow-up) |
| report usage              | model_usage.reports                            | available post-migration                                           |
| recommendation acceptance | pilot_feedback.recommendation_quality + thumbs | available post-migration                                           |
| advisor usage             | advisor_turns counts                           | available                                                          |
| premium feature usage     | model_usage.premium_calls                      | available post-migration                                           |
| retention                 | events over time                               | available                                                          |
| NPS / trust / usefulness  | pilot_feedback_summary                         | available post-migration                                           |

## Dashboard UI

The data + admin endpoints are the backend for the dashboard; the **visual dashboard UI (charts) is a frontend
task** — wire it to `/v1/admin/pilot-analytics` + the existing admin metrics. For a 20-person pilot the JSON
endpoints + the existing executive dashboard suffice to start; the charted view can follow.

## Status: ENDPOINTS + SERVICE + tests DONE (degrade gracefully pre-migration; verified live returning 200).

To fully activate: apply the migration. Domain-rollup SQL + the charted UI are follow-ups.
