# Internal Beta Dashboard

Sprint O.0 Phase 8 deliverable.

## Endpoint

```
GET /api/ops/dashboard?window_days=7
```

- Authentication: required (Supabase session).
- Authorization: `ops.feature_flags.operator_dashboard.read=true`, OR a
  per-user override in `ops.user_feature_flag_overrides`. Other callers
  get 403.
- Default window: 7 days. Min 1, max 90.

## Response shape

```ts
interface DashboardSnapshot {
  window_days: number;
  generated_at: string; // ISO timestamp
  user_activity: {
    dau: number; // unique user_ids in last 1d
    wau: number; // unique user_ids in last 7d
    new_users_7d: number;
  };
  recommendations: {
    generated: number;
    viewed: number;
    accepted: number;
    ignored: number;
    dismissed: number;
    completed: number;
  };
  governance: {
    constitutional_reviews: number;
    redirected: number; // CONSTITUTIONAL_REDIRECTION verdicts
    crisis_events: number; // risk_level IN ('HIGH','CRITICAL')
    injection_critical: number; // security_prompt_injection_events.severity='CRITICAL'
    injection_high: number;
  };
  multimodal: {
    uploads: number;
    extractions_succeeded: number;
    extractions_failed: number;
    malware_detections: number;
  };
  cost: {
    gemini_usd: number;
    openai_usd: number;
    anthropic_usd: number;
    other_usd: number;
    per_dau_usd: number;
  };
}
```

## Data sources

| Metric                   | Table                                                                           | Helper                         |
| ------------------------ | ------------------------------------------------------------------------------- | ------------------------------ |
| DAU / WAU                | `analytics.user_events`                                                         | `uniqueUsers`                  |
| Recommendation lifecycle | `public.decision_outcomes`                                                      | inline `count` query per state |
| Constitutional reviews   | `governance.decision_governance_audit`                                          | inline `count`                 |
| Redirected               | `decision_governance_audit.constitutional_verdict='CONSTITUTIONAL_REDIRECTION'` | inline                         |
| Crisis events            | `decision_governance_audit.risk_level IN ('HIGH','CRITICAL')`                   | inline                         |
| Injection critical/high  | `security.prompt_injection_events.severity`                                     | inline                         |
| Uploads                  | `ingestion.files`                                                               | inline                         |
| Extraction success/fail  | `ingestion.extraction_telemetry`                                                | inline                         |
| Malware detections       | `ingestion.malware_scans.status='infected'`                                     | inline                         |
| Cost by provider         | `ops.llm_usage_meter`                                                           | aggregate sum                  |

## Operator UX (out of scope this sprint)

The endpoint returns JSON. A frontend that renders the snapshot is
queued for the next sprint. For internal beta, operators consume the
endpoint via:

```bash
curl -sS "https://app.example.com/api/ops/dashboard?window_days=7" \
  -H "Cookie: <auth>" | jq
```

Or paste the JSON into the existing Sentry / Grafana dashboards.

## Resilience

Each metric block is wrapped in its own `try/catch`. A partial failure
(e.g. a fresh tenant DB where `analytics.user_events` is empty) does
not zero the whole snapshot. Zero values + a non-200 don't get
confused with "DAU is genuinely 0".

## Test coverage

`apps/web/src/lib/ops/__tests__/dashboard-queries.spec.ts` (3 tests):

1. Zero snapshot when no data — does not throw, returns the expected
   shape with zeros.
2. Aggregates user activity from `analytics_user_events` — verifies
   the distinct-user logic.
3. Aggregates cost by provider — verifies the gemini/openai/anthropic/other
   split AND the per-DAU normalization.

## Authorization model

The route checks two flag locations in order:

1. `ops.feature_flags.operator_dashboard.read` — a global flag for the
   operator cohort.
2. `ops.user_feature_flag_overrides` — per-user override for ad-hoc
   beta-program staff.

To grant access to a single user:

```sql
INSERT INTO ops.user_feature_flag_overrides (user_id, flag_key, enabled)
VALUES ('<user-uuid>', 'operator_dashboard.read', TRUE);
```

To grant access to the operator cohort:

```sql
INSERT INTO ops.feature_flags (flag_key, enabled, scope)
VALUES ('operator_dashboard.read', TRUE, 'cohort:operators');
```

## Aggregation cadence

Today the endpoint is computed on-demand per request. For internal
beta volume this is fine (≤100 daily callers, ≤2s response). At higher
load the natural progression is:

- Materialized view refreshed every 5 minutes.
- Cached snapshot served from `ops.dashboard_cache` with a TTL.
- Stream-based DAU / WAU via materialized rollups.

These are deferred to Sprint Q+ when beta volume justifies them.
