# Model Routing Policy

Roles map to models in `app/services/model_registry.py` (ROLES + MODELS). Business logic references ROLES,
never raw model names. All enablement/limits are env-overridable. Trust spine runs on every model.

## Role → model (current registry)

| Role                | Primary           | Fallback                     | Premium? | Basis                                |
| ------------------- | ----------------- | ---------------------------- | :------: | ------------------------------------ |
| classification      | gemini_flash_lite | gemini_flash                 |    no    | cheap/fast; sufficient (inferred)    |
| advisor_general     | gemini_2_5_pro    | gemini_flash                 |    no    | Pro 7.60 clears 7.5 (measured)       |
| finance_high_stakes | claude_opus_4_8   | gemini_2_5_pro               | **yes**  | Opus 4.8 8.82 vs Pro 7.71 (measured) |
| health_high_stakes  | claude_opus_4_8   | health_safety→gemini_2_5_pro | **yes**  | Opus 4.8 8.88 vs Pro 6.44 (measured) |
| career              | gemini_2_5_pro    | gemini_flash                 |    no    | Pro wins; Opus not worth cost        |
| education           | gemini_2_5_pro    | gemini_flash                 |    no    | Pro wins; Opus not worth cost        |
| family              | gemini_2_5_pro    | gemini_flash                 |    no    | Pro wins/ties; Opus not worth cost   |
| report_writer       | claude_opus_4_8   | gemini_2_5_pro               | **yes**  | Opus long-form strength (offline)    |
| critic              | claude_opus_4_8   | gemini_2_5_pro               | **yes**  | **DISABLED (benchmark pending)**     |

## Routing inputs → role

- domain (health→finance→career/education/family→general, classified deterministically), risk (finance/health
  floor at medium; high-stakes phrasing/large $ → high), user tier, budget state, model enablement.
- finance+high → finance_high_stakes; health+(high|medium) → health_high_stakes; career/education/family → that
  role; else advisor_general. Disabled roles (critic) fall to advisor_general.

## Demotion rules (graceful, user-invisible)

A premium primary is demoted to its fallback when: PREMIUM_ROUTING_ENABLED off, the model's kill switch off,
the user's tier is ineligible, or the premium budget is exhausted. Free tier is never eligible for premium.
Models with no kill switch (Flash/Flash-Lite) are always available → routing never hard-fails.

## Routing decision (logged per turn)

`{selected_role, selected_model, provider, reason, fallback, risk_level, domain, plan_tier, budget_state,
estimated_cost, estimated_latency_ms, premium, notes}` — emitted as a `model_route` log event; never exposes
model names to the user.

## To activate (currently all default-off except health safety)

`MODEL_ROUTER_ENABLED=true` + `GEMINI_PRO_ADVISOR_ENABLED=true` (Pro advisor) + (for premium domains)
`PREMIUM_ROUTING_ENABLED=true` + `CLAUDE_OPUS_4_8_ENABLED=true` + Vertex SA creds. Disable instantly by
unsetting `MODEL_ROUTER_ENABLED`.
