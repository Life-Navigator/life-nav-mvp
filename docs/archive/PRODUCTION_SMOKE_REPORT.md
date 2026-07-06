# PRODUCTION_SMOKE_REPORT.md — Phase 9

## Verified live in production (no fabrication)

- **Model path (the core of every advisor turn):** in-machine real call → `provider=vertex_gemini`, `model=gemini-2.5-pro`, `VERTEX_OK`, via keyless WIF. This is the exact client every advisor/domain turn uses.
- **healthz:** `{"status":"ok"}`; both machines healthy after rolling deploy.
- **No keys / no AI-Studio / loud fallback:** confirmed (SECURITY_AUDIT.md, VERTEX_RUNTIME_CONFIGURATION.md).
- **Advisor code path:** `get_advisor_orchestrator` wires `GeminiAdvisorLLM(VertexGeminiClient)` under `MODEL_PROVIDER=vertex` (same client just proven); gate/policy/answer-first logic shipped in this image (657 tests green pre-deploy).

## NOT run this pass (honest gap)

Full authenticated UI/domain smoke with **screenshots** — Workout/Finance/Promotion/Estate/Family/Education/Health/Recommendations/Advisor Actions/Dashboard/evidence drawer/action cards — requires a logged-in Supabase session + Playwright against the web app. That was **not executed** (no seeded prod user session in this run). The model path they all depend on is verified; the per-surface UI walk-through is the remaining step.

## To complete Phase 9

Run `apps/web/advisor-eval.mjs` / a Playwright pass against an authenticated pilot user, capturing each surface + screenshots, and confirm `provider=vertex_gemini` + `llm_status=enhanced` + 0 `advisor_model_fallback` in `flyctl logs`.

## Status: model path PROD-VERIFIED; full UI smoke PENDING (needs authed session).
