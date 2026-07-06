# MODEL_ROUTING_LIVE_VALIDATION.md — Phase 8

**Status: BLOCKED on owner ADC.** Code is complete + unit-tested (620 pass) and the loud-failure path is verified against the real ADC-absent environment. The live replay below runs once the owner authenticates.

## Verified now (no ADC needed)

- ✅ With ADC absent, `VertexGeminiClient.generate_with_usage` raises `VertexAuthError` (loud); `GeminiAdvisorLLM` logs a WARNING and returns None → deterministic fallback (never a crash, never silent). Reproduced live this session.
- ✅ Vertex endpoint + provider/model identity correct (`vertex_gemini` / `gemini-2.5-pro`, `…/publishers/google/models/…:generateContent`).
- ✅ Response now carries `provider` + `model`; turn telemetry records them; fallbacks emit `advisor_model_fallback`.

## Live replay runbook (after `gcloud auth application-default login` + Vertex enabled)

Env: `MODEL_PROVIDER=vertex`, `VERTEX_PROJECT=gen-lang-client-0849161409`, `VERTEX_REGION=us-central1`. Run core-api, then for each scenario hit `/v1/life/advisor/chat` and assert:

| Scenario                        | Assertions                                                                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Failed workout conversation** | response `provider=vertex_gemini`, `model=gemini-2.5-pro`; `llm_status=enhanced` (NOT `fallback:*`); a concrete plan (sets/reps/calories survive the scoped number gate); no fabricated personal $ |
| **Finance advisor prompt**      | intended model used (provider/model echoed); no `advisor_model_fallback` in logs; grounded personal figures only                                                                                   |
| **Health advisor prompt**       | health facts grounded; wellness coaching present; no clinical-medical advice                                                                                                                       |
| **Estate prompt**               | no silent downgrade; legal directives deferred to a professional (visible, not refusal)                                                                                                            |
| **Education prompt**            | decision framing present; `provider/model` prove the intended model                                                                                                                                |
| **Finance page**                | `/dashboard/finance/overview` still renders correct canonical data (regression check from the finance sprint)                                                                                      |

For each: capture `provider`, `model`, `llm_status` from the response; `flyctl logs | grep advisor_model_fallback` should be empty; compare answer quality to the previous (Flash + restrictive-gate) response — the workout reply must be strictly better (concrete plan vs. deflection).

## Pass criteria

1. Every scenario shows `provider`=the intended Vertex provider, `model`=the intended model.
2. Zero `advisor_model_fallback` warnings during the run (no fallback).
3. Workout/finance/health answers improved vs. the prior baseline.
4. Metadata proves provider/model (now a response field).
5. Finance overview data unchanged/correct.

## Final status until executed

**MODEL_AUTH_AND_ROUTING_FIXED (code) / BLOCKED (live validation)** — the only remaining gate is the owner ADC step + Vertex API/model access. No code work remains for the Gemini-on-Vertex path.
