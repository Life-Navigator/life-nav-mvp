# PRODUCTION_MODEL_RUNTIME_MAP.md — Phase 2

What model each surface uses. **Configured** values are code-proven (file:line). **Actual-invoked / latency / response-metadata** require a live run with working auth — see the BLOCKED note; the new `provider`/`model` response fields (this sprint) make that verifiable in one call.

## Key structural fact

The "domain advisors" (Finance/Health/Family/Career/Education) are NOT separate models — they are prompt/scope variants of the **same** `AdvisorOrchestrator → GeminiAdvisorLLM` path. So they all use the same configured model and auth. There is no per-domain model routing in production (the `ModelRouter` exists but `MODEL_ROUTER_ENABLED` defaults OFF — `model_registry.py:18-26`).

| Surface                                                     | Configured model                                                                        | Provider                                         | Auth                     | Fallback on failure                                                      | Actual-invoked / latency              |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------ | ------------------------------------- |
| **Advisor**                                                 | `gemini-2.5-pro` (`config.py:gemini_generation_model`; was flash)                       | AI Studio (or Vertex if `model_provider=vertex`) | API key / **ADC (new)**  | deterministic rule text (now LOUD-logged + `provider/model` on response) | **live run needed**                   |
| **Finance** advisor                                         | same orchestrator path                                                                  | same                                             | same                     | same                                                                     | live run needed                       |
| **Health** advisor                                          | same orchestrator path                                                                  | same                                             | same                     | same                                                                     | live run needed                       |
| **Family / Career / Education** advisors                    | same orchestrator path                                                                  | same                                             | same                     | same                                                                     | live run needed                       |
| **Discovery** (`/v1/life/discovery/chat`, `mode=discovery`) | largely **deterministic** (rule engine); LLM enhancement gated by `ADVISOR_LLM_ENABLED` | n/a / Gemini                                     | n/a / API key→ADC        | deterministic by design                                                  | live run needed                       |
| **Reports** (PDF)                                           | readiness/report engine; narrative LLM use **unverified**                               | unknown                                          | unknown                  | unknown                                                                  | **needs verification — do not guess** |
| **Document extraction**                                     | uses `GEMINI_API_KEY` (AI Studio); exact model **unverified**                           | AI Studio                                        | API key (policy-blocked) | unknown                                                                  | needs verification                    |

## Auth method per surface (proven)

- Advisor generation: `model_provider=ai_studio` → `GeminiClient` (`?key=`); `model_provider=vertex` → `VertexGeminiClient` (ADC bearer). Selected in `dependencies.py:get_advisor_orchestrator`.
- Claude (when `USE_VERTEX_CLAUDE=true`): Vertex `rawPredict`, ADC token provider (or static `VERTEX_ACCESS_TOKEN`).

## How to prove "actual invoked model" (now one step)

This sprint added `base["provider"]` + `base["model"]` to the advisor response and `tr["provider"]/tr["model"]` to the `analytics.advisor_turns` telemetry (`advisor_orchestrator.py`). After auth is live, a single advisor call returns the real provider/model, and `flyctl logs` shows `advisor_model_fallback` warnings if it ever degrades. That removes the guesswork this phase used to require.

## BLOCKED

"Actual invoked model", latency, and response metadata for every surface require ADC configured (owner step) + the running backend. Configured values above are proven from code; the live column is filled by MODEL_ROUTING_LIVE_VALIDATION.md once the owner authenticates. **Reports + Document-extraction models must be verified, not assumed** — flagged rather than guessed, per the sprint's "stop guessing" rule.
