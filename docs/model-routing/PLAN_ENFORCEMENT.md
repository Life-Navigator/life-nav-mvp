# Plan Enforcement (Pilot Readiness)

Four tiers, all limits configurable (env/DB) — no hardcoded commercial values.

## Tiers + placeholder limits (`model_registry.plan_limits`, env-overridable)

| Tier       |                       premium calls/mo | standard calls/mo | reports/mo | model eligibility |
| ---------- | -------------------------------------: | ----------------: | ---------: | ----------------- |
| free       |          0 (`PLAN_FREE_PREMIUM_CALLS`) |       unlimited\* |          0 | flash, flash-lite |
| plus       |         50 (`PLAN_PLUS_PREMIUM_CALLS`) |       unlimited\* |         10 | + gemini_2_5_pro  |
| premium    |     500 (`PLAN_PREMIUM_PREMIUM_CALLS`) |       unlimited\* |        100 | + claude_opus_4_8 |
| enterprise | 5000 (`PLAN_ENTERPRISE_PREMIUM_CALLS`) |       unlimited\* |       1000 | + claude_opus_4_8 |

\*`None` = unset placeholder. Enforcement requires `MODEL_USAGE_LIMITS_ENABLED=true` (default off until
commercial limits are set + the DB ledger is live).

## Budget states (`model_router.budget_state`)

available → nearing_limit (≥80%) → exhausted (≥cap). On exhausted/ineligible, the premium primary is demoted
to its fallback (graceful; see `PLAN_LIMIT_FALLBACK_REPORT.md`). Free tier is never premium-eligible.

## Enforcement path note

Decision logic is sync/pure (`route()`), so the read path for DB-backed limits passes a usage snapshot in
(small follow-up). Until then, enforcement runs on the in-memory ledger and is off in prod; **tracking** is
DB-backed (see `USAGE_LEDGER.md`). Tests cover all states + demotion + free-tier exclusion.

## Status: OPERATIONAL (logic + config + tests). Pending to enforce live: apply migration, enable

USAGE_TRACKING_ENABLED + MODEL_USAGE_LIMITS_ENABLED, set commercial limits.
