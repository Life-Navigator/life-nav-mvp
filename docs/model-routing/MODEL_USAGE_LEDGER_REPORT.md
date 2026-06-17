# Model Usage Ledger Report

## Implemented

`model_router.UsageLedger` (interface) + `InMemoryUsageLedger` (process-local default). Tracks per
(tenant_id, user_id): `premium_calls`, `standard_calls`, `reports`, `safety_fallbacks`, `model_fallbacks`.
`ModelRouter.record_usage` increments premium/standard per turn and counts model fallbacks. `budget_state`
reads it for plan enforcement.

## ⚠️ Production gap (the one real follow-up here)

The in-memory ledger is **not durable** and **not tenant-isolated at the DB layer**. Production needs a
DB-backed implementation:

- New table (e.g. `analytics.model_usage` or `ops.model_usage`): columns tenant_id, user_id, period (month),
  premium_calls, standard_calls, reports, safety_fallbacks, model_fallbacks, updated_at.
- **RLS**: tenant/user-scoped (mirror the existing `analytics.advisor_turns` RLS pattern).
- Monthly reset via `period` keying (no destructive resets).
- A `SupabaseUsageLedger(UsageLedger)` adapter implementing get/increment against that table (service-role
  writes; RLS reads). Wire it into `ModelRouter` in `dependencies.py`.

This is a standard migration; the interface is already in place so the swap is localized (no router/orchestrator
changes). Until then, keep `MODEL_USAGE_LIMITS_ENABLED=false`.

## Observability fields logged per turn (`_finish` + `_route`)

turn_id, user, plan_tier, domain, intent/role, risk_level, selected_model, fallback_model, fallback_reason
(notes), budget_state, estimated_cost, latency_ms, validator_result, trust/safety flags. (Extend the persisted
`advisor_turns` row with the routing block when the DB ledger lands.)
