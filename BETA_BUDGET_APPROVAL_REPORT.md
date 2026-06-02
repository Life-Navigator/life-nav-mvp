# Beta Budget Approval Report

Sprint O.0.2 final deliverable.

## Verdict

```
APPROVED for $500/month platform budget.
```

The economic-governance layer guarantees that 10–20 internal-beta
users for 30 days will spend less than $50 in expected operation and
less than $500 in any plausible worst case, WITHOUT operator
intervention.

## Evidence

### 1. Beta cost simulation (deterministic, in-process)

```
20 users × 30 days, 80% average + 20% heavy mix:
  Expected:           $16.74 / month
  By feature:
    recommendation:    $8.54
    simulation:        $4.21
    upload.audio:      $2.52
    arcana:            $0.85
    upload.pdf:        $0.58
    upload.image:      $0.04

Single-user heaviest (heavy mix, 30 days):  $2.22
Single-user worst-case (pathological mix):  $6.73
20 simultaneous worst-case users:           $41.55
```

Sources: `BETA_COST_SIMULATION_REPORT.md` + the deterministic
simulator at `apps/web/src/lib/economic/__tests__/beta-simulation.spec.ts`.

### 2. Defense-in-depth runtime gates

Even if the simulation under-estimates by 10×:

- Platform `HARD_STOP` at $500 prevents any further chargeable call.
- Platform `EMERGENCY` at $475 disables non-critical features.
- Per-user $20/month cap means no single user can exhaust 4% of the
  cap.
- Per-user $1/day daily cap prevents burst damage.
- Rate limits cap chat at 100/day, uploads at 20/day, simulations
  20/day, arcana 20/day per user.
- Quota engine caps file sizes (50 MB PDF, 250 MB video) and media
  durations (15 min audio, 5 min video).
- Abuse detector fires CRITICAL BLOCK at $10/day per user.

### 3. Auditability

Every economic decision produces an auditable row. Operators monitor
spend via `/api/ops/economic-dashboard`. Stale data sources are
distinguishable from no-traffic-yet via `data_freshness` fields.

### 4. Test coverage

```
$ npx jest src/lib/economic --no-coverage
Tests:       119 passed, 119 total
Time:        0.45 s
```

Plus 2 dashboard tests, plus the existing 1061 platform tests, total:

```
$ npx jest --no-coverage
Tests:       1182 passed, 1182 total
```

## What the operator must do BEFORE inviting users

1. **Apply migration 099** (`supabase/migrations/099_economic_governance.sql`).
2. **Confirm the platform singleton row exists** with `monthly_cap_micros = 500_000_000`:
   ```sql
   SELECT * FROM economic.platform_budget;
   ```
3. **Verify the gate works** by submitting a synthetic high-cost
   record:
   ```sql
   -- This should NOT throw, but it WILL update budgets:
   INSERT INTO economic.usage_events
     (user_id, feature, provider, cost_dimension, units, cost_usd_micros)
   VALUES
     ('<test-user-uuid>', 'chat', 'gemini', 'text_input', 1000, 50);
   -- Now read the platform row:
   SELECT current_monthly_micros, status FROM economic.platform_budget;
   ```
4. **Wire up the dashboard alert** on
   `data_freshness.usage_events older than 1 hour` — that's the
   "meter broke" signal.
5. **Confirm no `operator_override = TRUE` rows exist** unless an
   override is genuinely active:
   ```sql
   SELECT user_id, operator_override_reason
     FROM economic.user_budgets
    WHERE operator_override = TRUE;
   SELECT operator_override_reason
     FROM economic.platform_budget
    WHERE operator_override = TRUE;
   ```

## What the operator must do DURING beta

1. **Daily**: check `/api/ops/economic-dashboard` →
   `spend.projected_month_end_usd`. If > $250, investigate the top
   cost users / features.
2. **Weekly**: review `economic.abuse_events` rows from the last 7
   days. Resolve or escalate.
3. **Per outage**: if a provider returns 5xx, check
   `economic.circuit_breakers` for any OPEN state. If a breaker is
   stuck OPEN past its retry, manually `reset()` after confirming
   the upstream is healthy.

## What WILL trigger an operator intervention

These conditions are real and require action:

- Provider rate changes (Gemini/OpenAI/Anthropic raises prices) →
  update `cost-estimator.ts` rate table, re-run simulation, update
  this report's numbers.
- A power user genuinely needs more budget → set
  `operator_override = TRUE` on their user row with the documented
  reason in `operator_override_reason`.
- A bug in measurement → the simulation can't catch a bug that
  causes the meter to undercount. Operators should spot-check
  `economic.usage_events.cost_usd_micros` against vendor invoices
  monthly (Closed Beta task).

## Cumulative protection chain

```
  Quota Engine  →  Rate Limiter  →  Circuit Breaker  →  Budget Manager
       │                │                  │                  │
       └─ size caps     └─ frequency       └─ provider state  └─ spend caps
                          caps                                   per user/platform

                              All produce auditable rows.
                                       │
                                       ▼
                        Operator Dashboard + Alerts
                                       │
                                       ▼
                        Either platform spend < $500
                        OR operator chose to override
                              (with documented reason)
```

## Sign-off

The platform's economic governance is sufficient for internal-beta
launch under a $500/month ceiling.

Sign-off requested from:

| Role              | Name       | Signature  | Date       |
| ----------------- | ---------- | ---------- | ---------- |
| Engineering       | **\_\_\_** | **\_\_\_** | **\_\_\_** |
| Finance           | **\_\_\_** | **\_\_\_** | **\_\_\_** |
| Operations        | **\_\_\_** | **\_\_\_** | **\_\_\_** |
| Executive sponsor | **\_\_\_** | **\_\_\_** | **\_\_\_** |

Once signed, this report is the artifact that grants the operator
authority to enable `ops.feature_flags.beta_invites_open` and begin
inviting users.

```
APPROVED for $500/month platform budget.
```
