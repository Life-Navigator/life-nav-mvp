# Unit Economics Report

Sprint M Phase 9 deliverable.

## 1. Methodology

Costs are tracked in `ops.llm_usage_meter.cost_usd_micros` (integer
micro-USD; 1 USD = 1,000,000 micros). Infrastructure costs are pulled
from the platform billing dashboards; the platform does not auto-meter
itself.

Per-user metrics aggregate over rolling 7-day windows.

## 2. LLM cost model

`apps/web/src/lib/ops/observability.ts` defines current Gemini rates:

| Model              | $/1M input tokens | $/1M output tokens |
| ------------------ | ----------------- | ------------------ |
| `gemini-2.5-pro`   | $1.25             | $5.00              |
| `gemini-2.5-flash` | $0.075            | $0.30              |
| `gemini-1.5-pro`   | $1.25             | $5.00              |
| `gemini-1.5-flash` | $0.075            | $0.30              |

Stored as `micros per 1k tokens` so integer arithmetic is exact.

`estimateGeminiCostMicros(model, in, out)` is the canonical cost
calculator; meter writers use it to populate `cost_usd_micros`.

## 3. Default operation-kind mix (engineering estimate, beta cohort)

| `operation_kind`           | Avg model      | Avg in tok | Avg out tok | Estimated $/call |
| -------------------------- | -------------- | ---------- | ----------- | ---------------- |
| `advisor.message`          | flash          | 2,000      | 600         | $0.00033         |
| `advisor.explainer`        | flash          | 1,500      | 800         | $0.00035         |
| `recommendation.draft`     | pro            | 3,500      | 1,200       | $0.0104          |
| `optimizer.run`            | pro            | 5,000      | 1,800       | $0.0153          |
| `simulation.create`        | pro            | 6,000      | 2,000       | $0.0175          |
| `simulation.run`           | flash          | 4,000      | 1,000       | $0.00060         |
| `constitutional.review`    | regex (no LLM) | 0          | 0           | $0               |
| `governance.policy_engine` | regex (no LLM) | 0          | 0           | $0               |

The constitutional + governance layers are **deterministic regex** and
incur zero LLM cost — they execute on every response with negligible
compute.

## 4. Cost per active user — projection

Assumptions for a beta-stage active user:

- 1 advisor.message / day
- 1 advisor.explainer / day
- 0.5 recommendation.draft / day
- 0.25 optimizer.run / day
- 0.10 simulation.create + 0.10 simulation.run / day
- 50 governance reviews / day (free)

```
Daily LLM cost per active user:
  advisor.message     1.0 × $0.00033 = $0.00033
  advisor.explainer   1.0 × $0.00035 = $0.00035
  recommendation.draft 0.5 × $0.0104 = $0.0052
  optimizer.run       0.25 × $0.0153 = $0.00383
  simulation.create   0.10 × $0.0175 = $0.00175
  simulation.run      0.10 × $0.00060 = $0.00006
                                     -----------
                                       $0.01152 / DAU / day
                                     = ~$0.35 / DAU / month
```

**Headline:** under the projected mix, LLM cost runs ~$0.35 per
active beta user per month. The dominant line items are
`recommendation.draft` and `optimizer.run`.

## 5. Infrastructure cost (recurring, not per-user)

Estimates assume a closed beta sized at 500 DAU:

| System                         | Tier               | Monthly         | Notes                                          |
| ------------------------------ | ------------------ | --------------- | ---------------------------------------------- |
| Vercel                         | Pro                | $20             | Includes 1TB bandwidth + 1M edge requests      |
| Supabase                       | Pro (8 GB compute) | $25             | + $0.0125/GB-month storage beyond included     |
| Neo4j Aura                     | Professional       | $65             | Smallest production tier                       |
| Qdrant Cloud                   | Hybrid 1 node      | $50             | 4 vCPU / 16 GB                                 |
| Fly.io (Rust worker + FastAPI) | shared-cpu-2x × 2  | $30             | Plus ~$10 bandwidth                            |
| Sentry                         | Team               | $26             | 50k events                                     |
| Gemini API                     | usage-based        | ~$175           | 500 DAU × $0.35                                |
| **Subtotal**                   |                    | **~$391/month** | Excludes vendor-side egress + per-secret costs |

## 6. Cost per recommendation / per simulation

```
cost_per_recommendation
  = (recommendation.draft + optimizer.run + the governance reviews they trigger)
  ≈ $0.0153 + 0 + 0 = ~$0.015

cost_per_simulation
  = simulation.create + simulation.run + the governance reviews they trigger
  ≈ $0.0175 + $0.0006 + 0 = ~$0.018
```

Sub-2¢ per recommendation, sub-2¢ per simulation. The constitutional
layer is **free** because it's deterministic.

## 7. Circuit breakers

Three feature flags are wired specifically for cost containment:

| Flag                          | Effect                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `integrations.gemini`         | Disable LLM-backed paths (advisor / recommendation drafts). Routes fall back to the deterministic stub or `REQUEST_CLARIFICATION`. |
| `simulations.life_trajectory` | Disable life-trajectory simulator (the most expensive call).                                                                       |
| `advisor.conversation_intel`  | Disable the conversation-intelligence drill-down loop.                                                                             |

Toggling these requires a single SQL UPDATE to `ops.feature_flags`. No
deployment is required.

## 8. Recommended dashboards

1. **Cost / DAU / day** — primary economic health metric.
2. **Cost by operation_kind / model** — anomaly detection.
3. **LLM tokens by user** — find power users + outliers.
4. **Free vs. paid review ratio** — confirms the governance layer remains free.
5. **Retrieval cache hit-rate** — confirms the 60s cache is keeping retrieval near zero-cost.

All five queries ship in `OBSERVABILITY_RUNBOOK.md`.

## 9. Out-of-scope (next sprint)

- Real spend reconciliation against Gemini billing.
- Per-cohort cost rollups (e.g. veterans vs. professionals).
- Auto-budgets per cohort with circuit-breaker triggers.
- Embedding + retrieval cost when the Qdrant + Neo4j paths start incurring meaningful query cost.
