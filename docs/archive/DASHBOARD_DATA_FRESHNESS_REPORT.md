# Dashboard Data Freshness Report

Sprint O.0.1 Phase 4 deliverable.

## Problem

Audit A finding §6:

> The dashboard cannot distinguish "no data" from "no wiring". Recommendation:
> add a `data_freshness` field to the snapshot reporting the most-recent
> timestamp seen in each source table; operators can spot a stale source
> instantly.

## What shipped

`DashboardSnapshot` (`lib/ops/dashboard-queries.ts`) gained a
`data_freshness` block:

```ts
data_freshness: {
  telemetry: string | null; // MAX(occurred_at) in analytics_user_events
  governance: string | null; // MAX(created_at)  in decision_governance_audit
  recommendations: string | null; // MAX(generated_at) in decision_outcomes_v
  outcomes: string | null; // MAX(occurred_at) in decision_outcome_events
  multimodal: string | null; // MAX(created_at) in ingestion_files
  costs: string | null; // MAX(created_at) in ops_llm_usage_meter
  injection: string | null; // MAX(created_at) in security_prompt_injection_events
}
```

Each value is the timestamp of the most-recent row observed in the
window. `null` means the source returned no rows in this window
(distinguishing genuine inactivity from broken wiring).

## How operators use it

```bash
$ curl -sS https://app.example.com/api/ops/dashboard?window_days=7 | jq .data_freshness
{
  "telemetry":       "2026-06-01T05:43:21.918Z",   ← recent → wiring is healthy
  "governance":      "2026-06-01T05:43:21.918Z",
  "recommendations": "2026-06-01T05:21:08.412Z",
  "outcomes":        "2026-06-01T05:21:08.412Z",
  "multimodal":      "2026-05-30T14:12:01.000Z",   ← 2 days stale → nobody uploaded
  "costs":           null,                          ← null → either BYOM never called
                                                   ←        or ops.llm_usage_meter
                                                   ←        wiring is broken
  "injection":       "2026-05-31T22:00:11.555Z"
}
```

If `data_freshness.telemetry` is null but `data_freshness.governance`
has a recent timestamp, an operator knows that recommendation traffic
is real but the user-event helper is failing — actionable signal.

## Test coverage

`dashboard-validation.spec.ts`:

```text
✓ produces non-zero metrics across all five blocks + freshness
✓ with empty fixture, every metric is zero and freshness is null
✓ partial fixture exposes which source is stale
```

The third test seeds only `analytics_user_events` and asserts:

- `data_freshness.telemetry` is truthy
- every other freshness field is null
- `user_activity.dau` is non-zero
- every other metric block remains zero

This is the exact diagnostic shape an operator needs to triage "is
this beta empty, or broken?"

## Helper

A small `maxTimestamp(supabase, table, column, since)` helper does the
one-query lookup. Returns `null` on any failure (table absent, RLS
block, no rows). Exported as `__test.maxTimestamp` so future
diagnostic helpers can reuse it.

## What this catches

| Symptom                                  | Operator inference                                                  |
| ---------------------------------------- | ------------------------------------------------------------------- |
| All 7 freshness fields null              | DB empty (cold deployment, no users yet)                            |
| Telemetry recent, governance null        | guardOutgoing is bypassed somewhere — investigate                   |
| Recommendations null, telemetry recent   | `recordRecommendationGenerated` not firing — wiring regression      |
| Costs null, multimodal recent            | BYOM provider hits not being recorded — `recordLlmUsage` regression |
| Injection null for > 1 day under traffic | Either zero abuse traffic or the injection scanner is bypassed      |

## Why this is the only Sprint O.0.1 dashboard change

Sprint O.0.1 scope was activation, not new metrics. `data_freshness`
is the smallest possible enhancement that closes the audit's stated
gap — operators can now distinguish empty-from-broken without any
new aggregation or any new UI work.

Future sprints (Sprint Q+) can add `staleness_warnings` (sources
older than a configurable threshold), per-tenant filtering, and rolling
windows. Out of scope today.
