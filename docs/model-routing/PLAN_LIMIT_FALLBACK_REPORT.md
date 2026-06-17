# Plan / Token Limit Fallback Report

How user plan limits gate premium models and degrade gracefully — never failing, never shaming, never exposing
model names. Limits are placeholders, configurable via env/DB (commercial values TBD).

## Plan tiers (placeholder limits, `model_registry.plan_limits`)

| Tier  |       monthly_premium_model_calls | monthly_standard_model_calls | max_report_generations |
| ----- | --------------------------------: | ---------------------------: | ---------------------: |
| free  | 0 (env `PLAN_FREE_PREMIUM_CALLS`) |                  unlimited\* |                      0 |
| plus  |    50 (`PLAN_PLUS_PREMIUM_CALLS`) |                  unlimited\* |                     10 |
| elite |  500 (`PLAN_ELITE_PREMIUM_CALLS`) |                  unlimited\* |                    100 |

\*`None` = unset placeholder. All overridable by env (and later DB config). Free tier gets 0 premium → never
routes to Opus by default. `MODEL_USAGE_LIMITS_ENABLED` (default off) must be on for caps to apply.

## Budget states (`model_router.budget_state`)

`available` → `nearing_limit` (≥80% of premium cap) → `exhausted` (≥cap). With limits disabled, always
`available`.

## Fallback when premium exhausted/ineligible

The router demotes the premium primary to its fallback (e.g. finance_high_stakes → gemini_2_5_pro), records a
`premium_budget_exhausted` note, and serves a full standard answer. User-facing copy (frontend) should frame it
positively, e.g.: _"I can still help with a standard analysis. The deeper review is available again when your
plan renews — or if you upgrade."_ No provider/model names shown.

Fallback targets by tier: Plus/Elite exhausted → Gemini Pro; Free → Gemini Flash; deterministic tool/response
where applicable.

## Triggers that route to fallback (all logged, user sees a normal helpful reply)

user limit · provider error/timeout · cost ceiling · region outage · model disabled (kill switch). The
`_enhance` provider-failure path additionally tries the fallback model once if the routed primary returns None.

## Tests

- premium budget exhausted → demotes (not opus), note recorded, no failure.
- budget states available/nearing_limit/exhausted transition correctly.
- limits-off → always available.
- free tier excluded from premium (→ flash).
- provider-failure (primary returns None) → fallback model used, response still `enhanced`.

## Productionization note

The in-memory ledger must be replaced with a DB-backed, RLS-scoped ledger (see MODEL_USAGE_LEDGER_REPORT.md)
before enabling `MODEL_USAGE_LIMITS_ENABLED` in production.
