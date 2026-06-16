# Usage Ledger (Pilot Readiness)

Tracks premium/standard calls, reports, safety fallbacks, model fallbacks, and estimated cost — user- and
tenant-scoped.

## Storage (migration `supabase/migrations/20260616120000_pilot_routing.sql`)

`analytics.model_usage` PK (tenant_id, user_id, period 'YYYY-MM): premium_calls, standard_calls, reports,
safety_fallbacks, model_fallbacks, estimated_cost, updated_at. **RLS: service-role only** (no client access).
Atomic increments via `analytics.bump_model_usage(...)` (SECURITY DEFINER; service-role EXECUTE) — avoids
read-modify-write races.

## Write path

`AdvisorOrchestrator._persist_usage` (best-effort, fire-and-forget, after each turn) calls the RPC: premium vs
standard from the routing decision, safety/model-fallback from the trace, estimated_cost from the registry.
Gated by `USAGE_TRACKING_ENABLED` (default off → no-op until the migration is applied + flag set). tenant
defaults to user_id (single-tenant pilot).

## Read path

`model_router.budget_state` reads counts for plan enforcement. In-memory ledger (`InMemoryUsageLedger`) backs
tests + the current enforcement logic; a `SupabaseUsageLedger` read adapter is a small follow-up (route()
takes a usage snapshot so it stays sync/pure). The client now has `rpc()` for the increment.

## Status: SCHEMA + WRITE PATH + RPC + tests DONE. To go live: apply the migration, set

`USAGE_TRACKING_ENABLED=true`. Enforcement (read) on the DB is the snapshot follow-up; tracking works first.
