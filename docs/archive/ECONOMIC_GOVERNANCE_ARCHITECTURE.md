# Economic Governance Architecture

Sprint O.0.2 deliverable.

## Position in the platform

Sprint L2 protects users. Sprint N.2 protects the database. Sprint O.0
makes the platform measurable. Sprint O.0.2 makes the platform
**economically sustainable**.

Economic governance is the layer that decides:

- Is this user allowed to spend more money?
- Is the platform allowed to spend more money?
- Should this provider call run, queue, or reject?
- Is this user pattern abusive?

## Component map

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Economic Governance                          │
│                                                                     │
│ ┌────────────────┐  ┌─────────────────┐  ┌────────────────────┐     │
│ │ BudgetManager  │  │ CostEstimator   │  │ ModelSelectionPolicy│     │
│ │ user/tenant/   │  │ pre-call cost   │  │ tier 1 / 2 / 3      │     │
│ │ platform caps  │  │ projection      │  │ cost-aware routing  │     │
│ └────────────────┘  └─────────────────┘  └────────────────────┘     │
│                                                                     │
│ ┌────────────────┐  ┌─────────────────┐  ┌────────────────────┐     │
│ │ UsageMeter     │  │ RateLimiter     │  │ QuotaEngine        │     │
│ │ writes ledger  │  │ token-bucket    │  │ file size/duration │     │
│ │ updates budgets│  │ daily caps      │  │ daily upload cap   │     │
│ └────────────────┘  └─────────────────┘  └────────────────────┘     │
│                                                                     │
│ ┌────────────────┐  ┌─────────────────┐                             │
│ │ AbuseDetector  │  │ CircuitBreaker  │                             │
│ │ flood / burn   │  │ feature-state   │                             │
│ │ persisted      │  │ degrade/queue   │                             │
│ └────────────────┘  └─────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

## Files shipped

| Module                                         | File                                           |
| ---------------------------------------------- | ---------------------------------------------- |
| Types + defaults                               | `apps/web/src/lib/economic/types.ts`           |
| Cost estimation (vendor rate tables)           | `apps/web/src/lib/economic/cost-estimator.ts`  |
| Usage meter (ledger writer + budget increment) | `apps/web/src/lib/economic/usage-meter.ts`     |
| Budget manager (pre-call decision)             | `apps/web/src/lib/economic/budget-manager.ts`  |
| Rate limiter (token bucket)                    | `apps/web/src/lib/economic/rate-limiter.ts`    |
| Quota engine (file + duration caps)            | `apps/web/src/lib/economic/quota-engine.ts`    |
| Model selection policy (cost-aware routing)    | `apps/web/src/lib/economic/model-selection.ts` |
| Abuse detector                                 | `apps/web/src/lib/economic/abuse-detector.ts`  |
| Circuit breaker                                | `apps/web/src/lib/economic/circuit-breaker.ts` |
| Entry / re-exports                             | `apps/web/src/lib/economic/index.ts`           |

| Schema                           | File                                              |
| -------------------------------- | ------------------------------------------------- |
| Tables + RLS + views + self-test | `supabase/migrations/099_economic_governance.sql` |

| API                         | File                                                   |
| --------------------------- | ------------------------------------------------------ |
| Economic dashboard endpoint | `apps/web/src/app/api/ops/economic-dashboard/route.ts` |
| Aggregation helper          | `apps/web/src/lib/ops/economic-dashboard-queries.ts`   |

| Tests                          | File                                               |
| ------------------------------ | -------------------------------------------------- |
| Cost estimator (12 tests)      | `__tests__/cost-estimator.spec.ts`                 |
| Usage meter (16 tests)         | `__tests__/usage-meter.spec.ts`                    |
| Budget manager (10 tests)      | `__tests__/budget-manager.spec.ts`                 |
| Rate limiter (15 tests)        | `__tests__/rate-limiter.spec.ts`                   |
| Quota engine (20 tests)        | `__tests__/quota-engine.spec.ts`                   |
| Model selection (13 tests)     | `__tests__/model-selection.spec.ts`                |
| Abuse detector (13 tests)      | `__tests__/abuse-detector.spec.ts`                 |
| Circuit breaker (11 tests)     | `__tests__/circuit-breaker.spec.ts`                |
| Beta cost simulation (5 tests) | `__tests__/beta-simulation.spec.ts`                |
| Economic dashboard (2 tests)   | `ops/__tests__/economic-dashboard-queries.spec.ts` |

= **119 economic tests + 2 dashboard tests = 121 tests, all green.**

## How it composes at runtime

### Upload flow (post-O.0.2)

```
classify + validate
  ↓
QuotaEngine.checkFile (size / pages / duration)
QuotaEngine.checkDailyUploadBudget
RateLimiter.consume('upload', user_id)
  ↓
SCAN (malware)
  ↓
STORE
  ↓
INJECTION SCAN
  ↓
EXTRACT  → CostEstimator pre-call gate (when provider is invoked)
  ↓
UsageMeter.recordUsage  → updates user + platform budget
  ↓
PROMOTE
```

### Recommendation flow

```
guardOutgoing (governance + injection)
  ↓
ModelSelectionPolicy.selectModel(feature)  → tier 1/2/3 model
  ↓
CostEstimator.estimateCost(provider, model, units)
  ↓
BudgetManager.evaluate(user, estimated_micros)
   ALLOW | WARN | THROTTLE | BLOCK | HARD_STOP
  ↓
provider.callChat({ messages })  [if ALLOW or WARN]
  ↓
UsageMeter.recordUsage(actual_cost)
  ↓
AbuseDetector signals refreshed on the user
```

## Decision precedence (highest wins)

1. Platform `HARD_STOP` (100% of monthly cap) — reject everything
2. Platform `EMERGENCY` (95%) — reject all non-critical features
3. User `BLOCKED` (100% of any window) — reject
4. User `THROTTLED` (90%) — defer/queue
5. AbuseDetector `BLOCK` — reject
6. CircuitBreaker `DISABLED` — reject
7. CircuitBreaker `DEGRADE` / `QUEUE` — modify the call
8. `WARN` / `ALLOW` — proceed

## Operator overrides

Both `economic.user_budgets.operator_override` and
`economic.platform_budget.operator_override` (boolean) flip the
behavior from BLOCK/HARD_STOP to WARN/EMERGENCY. The override is
audited via `metadata.operator_override_reason`. It exists for
legitimate operator escalation; using it is a deliberate decision.

## Why `economic` is its own schema

`economic.*` is intentionally distinct from `ops.*`. The two have
different reader audiences:

- `ops.*` is operations + observability — feature flags, cohorts,
  feedback. Owners: ops.
- `economic.*` is money — budgets, ledger, rate buckets, circuit
  state. Owners: finance + ops + on-call.

Keeping them apart simplifies access-control review and makes it
clear that economic decisions have their own audit chain.

## RLS posture

- `user_budgets`, `usage_events`, `abuse_events` — owner-read +
  service-role-write. A user can audit their own spend.
- `platform_budget`, `rate_limit_buckets`, `circuit_breakers` —
  service-role-only. Operators read via the dashboard route.

## Auditability invariant

Every economic decision must produce at least one row in either
`economic.usage_events` (chargeable action) or `economic.abuse_events`
(non-charging action that triggered a policy). The dashboard's
`active_throttles` + `active_blocks` come from these rows.

## What this enables operationally

- **Cost control:** the platform cannot exceed $500/month without
  explicit operator override.
- **Beta survivability:** 10-20 users + realistic activity stays
  well under cap (simulation: $17 expected, $42 worst case).
- **Abuse prevention:** seven categories detected; persistence into
  `economic.abuse_events` so security can review.
- **Operator visibility:** `/api/ops/economic-dashboard` returns the
  whole picture in one JSON.

## What is NOT in scope

- **Per-tenant budgets.** The schema supports `tenant_id` on
  `user_budgets`, but the `tenant_budgets` aggregate is a Sprint Q+
  expansion when the platform onboards its first paying tenant.
- **Cost reconciliation against vendor billing.** Today we use
  published rates; the actual invoice may differ. Closed Beta task.
- **Per-tenant rate limits.** RateLimiter accepts a tenant_id but the
  default policy is user-scoped.
- **Real-time threshold notifications.** The platform-budget row
  carries `last_threshold_notified` so an external poller can fire
  alerts at 50/75/90/95/100%. No notification channel ships this
  sprint.
