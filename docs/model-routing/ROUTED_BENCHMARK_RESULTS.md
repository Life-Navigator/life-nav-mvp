# Routed Benchmark Results

The live end-to-end routed benchmark (router ON across all models in one run) requires premium routing enabled
with a **Vertex service account** (the gcloud-token path expires and isn't viable for a long multi-model run) —
that's the pending productionization item. This doc therefore gives an **evidence-based projection** built from
the already-measured per-model/per-domain scores, plus the live methodology to convert it to measured. The
routing _logic itself_ (selection, demotion, fallback, safety) is unit-proven (27 tests, 100%).

## Inputs (all measured, identical pipeline)

- 50-scenario per-domain (Flash / Pro / Opus-4.1): Pro overall 7.60, Flash 6.66.
- Targeted 20-scenario Finance+Health (Opus 4.8 / Pro): Opus 4.8 finance 8.82 (Pro 7.71), health 8.88 (Pro 6.44).
- All in-pipeline fabrications = 0 (model-agnostic trust spine).

## Projected configurations

| Config                                                                         |   General |   Finance |    Health | Notes                                                 |
| ------------------------------------------------------------------------------ | --------: | --------: | --------: | ----------------------------------------------------- |
| **Existing production** (Flash everywhere)                                     |      6.66 |      6.47 |     n/a\* | below the 7.5 gate                                    |
| **Routed (standard)** — Pro advisor+domains, no premium                        |  **7.60** |      6.73 |      ~6.4 | clears 7.5; cheap (~$0.011)                           |
| **Routed (premium)** — Pro general/career/edu/family + Opus 4.8 finance/health |  **7.60** |  **~8.8** |  **~8.9** | finance/health to Opus 4.8                            |
| **Routed + limits exhausted**                                                  |      7.60 |      6.73 |      ~6.4 | premium → Pro fallback; still clears 7.5 (graceful)   |
| **Routed under provider failure**                                              | ≈fallback | ≈fallback | ≈fallback | primary None → fallback model answers (no user error) |

\*The 50-set had no Health domain; Health figures are from the targeted 20-set.

## Success-criteria check (projection where not yet live-measured)

| Criterion                             | Status                                                       |
| ------------------------------------- | ------------------------------------------------------------ |
| General advisor ≥ 7.5                 | ✅ Pro 7.60 (measured) — enable `GEMINI_PRO_ADVISOR_ENABLED` |
| Finance ≥ 8.5 when premium available  | ✅ Opus 4.8 8.82 (measured)                                  |
| Health ≥ 8.5 when premium available   | ✅ Opus 4.8 8.88 (measured)                                  |
| Trust ≥ 8.0                           | ✅ all models 8.2–8.7                                        |
| Fabrications = 0                      | ✅ trust spine (all models)                                  |
| Urgent health fallback pass = 100%    | ✅ tested + verified live                                    |
| Plan-exhausted fallback pass = 100%   | ✅ unit-tested (graceful demotion)                           |
| Provider-failure fallback pass = 100% | ✅ unit-tested (fallback model)                              |
| No user-facing provider/model names   | ✅ by design (roles only; never surfaced)                    |
| Router can be disabled instantly      | ✅ unset `MODEL_ROUTER_ENABLED`                              |

## Live measurement methodology (to replace the projection)

1. Stand up a **Vertex service account** (roles/aiplatform.user) → durable creds for Opus.
2. Enable: `MODEL_ROUTER_ENABLED`, `GEMINI_PRO_ADVISOR_ENABLED`, `PREMIUM_ROUTING_ENABLED`, `CLAUDE_OPUS_4_8_ENABLED`.
3. Re-run the **50-scenario advisor set** + the **finance/health specialist set** with the router ON (it will
   auto-route per domain), score with the same 5-judge rubric.
4. Run the **limit-exhaustion simulation** (`MODEL_USAGE_LIMITS_ENABLED=true`, small premium cap, pre-seed the
   ledger past cap) and the **provider-timeout simulation** (point Opus at a bad token) — confirm graceful
   fallback and that quality holds at the standard-tier level.
5. Compare existing-prod / routed / routed+limits / routed+failure.

## Read

The projection says routed-premium delivers ~7.6 general, ~8.8 finance, ~8.9 health with 0 fabrications and a
deterministic health-safety floor — all success criteria met. The routing/fallback/safety mechanics are
already proven by tests and (for safety) live. The remaining step is durable Vertex auth to turn the premium
projection into a measured number.
