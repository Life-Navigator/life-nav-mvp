# Observability Runbook

Sprint M Phase 5 deliverable. Operating runbook for the production observability surface.

## 1. What's wired

| Surface                  | Library                                      | Wire-up                                                                                      |
| ------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Error capture            | `@sentry/nextjs` (optional dep, lazy-loaded) | `captureException` / `captureMessage` in `apps/web/src/lib/ops/observability.ts`             |
| Trace spans              | OTel collector (optional)                    | `withSpan(name, fn, attrs?)`                                                                 |
| LLM usage meter          | `ops.llm_usage_meter`                        | `recordLlmUsage(supabase, { provider, model, tokens_in, tokens_out, cost_usd_micros, ... })` |
| Retrieval cache meter    | `ops.retrieval_cache_meter`                  | written by `retrieveConstitutionalRuleSet` when `record_meter: true`                         |
| Governance interventions | `governance.decision_governance_audit`       | derived from `constitutional_verdict` + `severity`                                           |
| Crisis detections        | `governance.decision_governance_audit`       | derived from `risk_level`                                                                    |

The library is opt-in by env var; the package is not bundled when the
env is empty so cold-start cost is zero.

## 2. Env configuration

| Env var                       | Purpose                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `SENTRY_DSN`                  | Activates Sentry capture                                                            |
| `SENTRY_TRACES_SAMPLE_RATE`   | Optional; defaults handled at SDK init                                              |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Activates OTel forwarding stub (collector wiring deferred to Sprint M+1)            |
| `OTEL_EXPORTER_OTLP_HEADERS`  | Vendor auth (e.g. Honeycomb)                                                        |
| `USE_GOOGLE_SECRET_MANAGER`   | When `1`, pulls Sentry DSN + OTel headers from GSM via the Sprint M secrets adapter |

## 3. Counters & how to read them

### Active users

```sql
SELECT COUNT(DISTINCT user_id)
FROM ops.llm_usage_meter
WHERE created_at > NOW() - INTERVAL '7 days';
```

### Recommendations generated

```sql
SELECT COUNT(*)
FROM governance.decision_governance_audit
WHERE subject_kind IN ('recommendation','provider_recommendation','arcana_recommendation','optimizer_recommendation')
  AND created_at > NOW() - INTERVAL '7 days';
```

### Governance interventions (last 24h)

```sql
SELECT constitutional_verdict, COUNT(*)
FROM governance.decision_governance_audit
WHERE constitutional_verdict IN ('APPROVE_WITH_MODIFICATION','CONSTITUTIONAL_REDIRECTION','SAFE_CONSTITUTIONAL_RESPONSE','REQUEST_CLARIFICATION')
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 2 DESC;
```

### Crisis detections (HIGH/CRITICAL)

```sql
SELECT user_id, risk_level, created_at
FROM governance.decision_governance_audit
WHERE risk_level IN ('HIGH','CRITICAL')
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Failed retrievals

```sql
SELECT COUNT(*) FILTER (WHERE NOT retrieval_ok) AS failed,
       COUNT(*)                                AS total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE NOT retrieval_ok) / GREATEST(COUNT(*), 1), 2) AS pct_failed
FROM governance.review_iterations
WHERE created_at > NOW() - INTERVAL '1 hour';
```

### Simulation runs

```sql
SELECT COUNT(*) FROM governance.decision_governance_audit
WHERE subject_kind = 'simulation_output'
  AND created_at > NOW() - INTERVAL '7 days';
```

## 4. Cost rollups

`ops.llm_usage_meter.cost_usd_micros` is stored as integer micro-USD
(1 USD = 1_000_000 micros) so aggregation is exact.

```sql
-- Per-user 7d cost
SELECT user_id,
       SUM(tokens_in)  AS tokens_in,
       SUM(tokens_out) AS tokens_out,
       ROUND(SUM(cost_usd_micros) / 1e6, 4) AS cost_usd
FROM ops.llm_usage_meter
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY cost_usd DESC
LIMIT 25;
```

```sql
-- Per-operation 7d cost
SELECT operation_kind, model,
       COUNT(*)        AS calls,
       SUM(tokens_in)  AS tokens_in,
       SUM(tokens_out) AS tokens_out,
       ROUND(SUM(cost_usd_micros) / 1e6, 4) AS cost_usd
FROM ops.llm_usage_meter
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY 1,2
ORDER BY cost_usd DESC;
```

## 5. Cache-hit health

```sql
SELECT cache_kind,
       COUNT(*) FILTER (WHERE hit) AS hits,
       COUNT(*) AS total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE hit) / GREATEST(COUNT(*), 1), 2) AS hit_rate
FROM ops.retrieval_cache_meter
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY 1;
```

Expected steady-state: `constitutional_rule_set` hit_rate ≥ 95% (60s TTL, low write churn on `constitutional_entities`).

## 6. Alert thresholds (suggested)

| Metric                                                  | Warning            | Critical |
| ------------------------------------------------------- | ------------------ | -------- |
| `% retrieval_ok=false` over last hour                   | > 1%               | > 5%     |
| `% verdict=SAFE_CONSTITUTIONAL_RESPONSE` over last hour | > 0.5%             | > 2%     |
| `cost_usd / active user / day`                          | > $0.40            | > $1.00  |
| `crisis HIGH+ count in last hour`                       | > 0 (page on-call) | n/a      |
| Sentry `event_count / minute`                           | > 5                | > 50     |

## 7. Incident response

1. Constitutional retrieval failure → all routes will FAIL CLOSED. Check Supabase health + the `constitutional_entities` row count first.
2. Sentry spike → triage by tag (route, user_cohort). Roll back to last good Vercel deployment if the spike correlates with a deploy.
3. Cost spike → check `ops.llm_usage_meter` per operation_kind. Toggle the `integrations.gemini` flag off as a circuit-breaker.
4. Crisis HIGH/CRITICAL signal → on-call reviews, never auto-escalates; verifies the user got the safety response.

## 8. Out-of-scope (next sprint)

- Real OTel SDK + collector wiring (`OTEL_EXPORTER_OTLP_*` env vars are wired but the OTel SDK initializer ships next).
- Synthetic uptime probes against /api/governance/principles.
- PagerDuty / Opsgenie integration.
