# Model Routing Implementation (Pilot Readiness)

Operationalizes registry-driven, plan-aware selective routing. Builds on the orchestration layer
(`MODEL_ORCHESTRATION_IMPLEMENTATION_REPORT.md`); this doc records the pilot-grade additions.

## Roles (provider-agnostic; no model names in business logic)

`classification · advisor (general) · finance · health · career · education · family · report_writer ·
executive_review · critic(disabled, benchmark pending)` — in `app/services/model_registry.py` ROLES.
Resolution (`model_router._role_for`): finance+high→finance_high_stakes; health+(high|medium)→health_high_stakes;
career/education/family→that role; else advisor_general.

## Routing dimensions (`ModelRouter.route`)

domain · risk · plan tier · premium budget · model enablement · provider fallback. Output = a logged
`RoutingDecision` (selected_role/model, provider, reason, fallback, risk, domain, tier, budget_state,
estimated_cost, estimated_latency_ms, premium, notes) + the resolved primary/fallback `AdvisorLLM` instances.

## Current routing table (evidence-backed)

| Role                             | Primary           | Fallback       | Premium |
| -------------------------------- | ----------------- | -------------- | :-----: |
| classification                   | gemini_flash_lite | gemini_flash   |   no    |
| advisor_general                  | gemini_2_5_pro    | gemini_flash   |   no    |
| finance_high_stakes              | claude_opus_4_8   | gemini_2_5_pro |   yes   |
| health_high_stakes               | claude_opus_4_8   | gemini_2_5_pro |   yes   |
| career/education/family          | gemini_2_5_pro    | gemini_flash   |   no    |
| report_writer / executive_review | claude_opus_4_8   | gemini_2_5_pro |   yes   |
| critic                           | (disabled)        | gemini_2_5_pro |    —    |

## Tiers → eligibility

free → flash/flash-lite only · plus → +gemini_2_5_pro · premium/enterprise → +claude_opus_4_8. Premium models
gated by PREMIUM_ROUTING_ENABLED + per-model kill switch + tier + budget.

## Wiring (default-OFF)

`AdvisorOrchestrator._route` selects the per-turn model only when `MODEL_ROUTER_ENABLED`; else the DI LLM
(unchanged prod). `_enhance(llm, fallback_llm)` runs the routed model through the unchanged trust spine, with a
provider-failure fallback. Health-safety pre-check runs before everything.

## Tests

23 router + 4 orchestrator integration (routing rules, tier eligibility, premium demotion, budget exhaustion,
provider-failure fallback, health-urgent skip, kill-switch default-off, critic disabled). Green.

## Status: OPERATIONAL (behind kill switches). To activate: MODEL_ROUTER_ENABLED + GEMINI_PRO_ADVISOR_ENABLED

(advisor→Pro); for finance/health premium add PREMIUM_ROUTING_ENABLED + CLAUDE_OPUS_4_8_ENABLED + a Vertex
service account (token path expires). Disable instantly: unset MODEL_ROUTER_ENABLED.
