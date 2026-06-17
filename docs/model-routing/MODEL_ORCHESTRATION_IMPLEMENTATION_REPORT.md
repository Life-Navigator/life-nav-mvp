# Model Orchestration — Implementation Report

**Date:** 2026-06-16 · **Scope:** the minimal, evidence-backed selective orchestration layer (NOT full LIOS
Runtime). Default-safe: with no env set, production keeps its existing single-model path; the only thing
active by default is the deterministic health-safety net.

## What shipped (code)

| Component                                         | Where                                                                   | Status                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Model Registry**                                | `app/services/model_registry.py`                                        | ✅ role→model map + per-model metadata + kill switches + plan limits (env-overridable) |
| **Capability Router**                             | `app/services/model_router.py` (`ModelRouter`)                          | ✅ domain/intent/risk/tier/budget → enabled model + fallback                           |
| **Domain + Risk Classifier**                      | `model_router.classify_domain/classify_risk`                            | ✅ deterministic keyword/heuristic                                                     |
| **Health urgent-care detector + safety response** | `model_router.detect_health_urgent / health_safety_response`            | ✅ deterministic, model-free                                                           |
| **Plan / Token Budget Manager**                   | `model_registry.plan_limits` + `model_router.budget_state`              | ✅ configurable; states available/nearing_limit/exhausted                              |
| **Fallback Engine**                               | `ModelRouter.route` (demotion) + `_enhance` (provider-failure fallback) | ✅ graceful, user-invisible                                                            |
| **Usage Ledger**                                  | `model_router.UsageLedger` (+ `InMemoryUsageLedger`)                    | ✅ interface + in-memory; ⚠️ DB-backed RLS impl pending (migration)                    |
| **Observability**                                 | `_route` + `_finish` structured logs; `tr["routing"]/["safety_flags"]`  | ✅ per-decision log                                                                    |
| **Kill switches**                                 | `model_registry.flag()` + env                                           | ✅ all default-safe (router OFF, premium OFF, health-safety ON)                        |

Wired into `AdvisorOrchestrator` (`converse` + `converse_stream`): (1) health-safety pre-check runs **before**
any model/ack; (2) when `MODEL_ROUTER_ENABLED`, the per-turn model is chosen by the router (else the DI LLM);
(3) the selected model's output still flows through the **unchanged trust spine** (validator/number-gate/
compliance/repair) — proven model-agnostic earlier (it caught Claude's fabrications).

## Kill switches (env, defaults)

```
MODEL_ROUTER_ENABLED=false           # router off → existing single-model path
PREMIUM_ROUTING_ENABLED=false        # no premium (Opus/Pro-premium) routing
CLAUDE_OPUS_4_8_ENABLED=false        # Opus 4.8 off (needs Vertex creds anyway)
GEMINI_PRO_ADVISOR_ENABLED=false     # Pro advisor off (flip on to make Pro the advisor)
HEALTH_SAFETY_FALLBACK_ENABLED=true  # deterministic safety net ON (no LLM, safe to keep on)
MODEL_USAGE_LIMITS_ENABLED=false     # plan caps off until commercial limits are set
```

**Router can be disabled instantly** by unsetting `MODEL_ROUTER_ENABLED` (default) → existing prod path.

## Tests (all passing)

`tests/test_model_router.py` (23) + `tests/test_advisor_hybrid.py` orchestration tests (4 new): routing rules,
domain/risk classification, **plan-limit exhaustion → graceful demotion**, **health-urgent → safety_fallback
(LLM skipped, 100%)**, finance/health → Opus when premium-on, career/education/family → Pro, free-tier never
premium, **provider-failure → fallback model**, kill-switch default-off, critic-role-disabled. Full backend
suite green.

## Final decisions

1. **Is selective orchestration production-ready?** **Yes for the safe core** (health-safety net + router
   scaffolding + graceful fallbacks, all behind kill switches). The **DB-backed RLS usage ledger** and **live
   premium (Opus) routing via a Vertex service account** are the two productionization items before turning
   premium routing on broadly.
2. **Should Gemini Pro become the default advisor?** **Yes** — flip `GEMINI_PRO_ADVISOR_ENABLED=true` (and set
   the advisor model to Pro). Measured 7.60 (clears 7.5) vs Flash 6.66, trust 8.7, ~$0.011/turn.
3. **Should Finance route to Opus 4.8?** **Yes, selectively** (high-stakes), once a Vertex SA is in place —
   measured 8.82 vs Pro 7.71.
4. **Should Health route to Opus 4.8?** **Yes** — measured 8.88 vs Pro 6.44, and Opus handled the urgent-care
   case Pro failed. The deterministic safety net is the floor regardless of model.
5. **Are plan/token fallback rules working?** **Yes** — unit-proven: exhausted premium budget demotes
   gracefully (no failure, no model names exposed); states available/nearing_limit/exhausted.
6. **Is LIOS Runtime Phase 1 still necessary now?** **No — wait.** This sprint delivers the routing value LIOS
   would have; no LIOS component is justified by a measured weakness. Prove the routed advisor stable first.
7. **Next highest-ROI sprint?** Stand up the **Vertex service-account auth + DB-backed usage ledger**, then
   **enable Gemini Pro as the advisor default + Opus 4.8 for finance/health behind premium routing**, and
   **re-run the routed benchmark live** (this report's projection → measured).

See: `MODEL_ROUTING_POLICY.md`, `PLAN_LIMIT_FALLBACK_REPORT.md`, `HEALTH_SAFETY_FALLBACK_REPORT.md`,
`MODEL_USAGE_LEDGER_REPORT.md`, `ROUTED_BENCHMARK_RESULTS.md`.
