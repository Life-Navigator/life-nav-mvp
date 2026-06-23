# MODEL_AUTH_POLICY_AUDIT.md — Phase 1

Every model-provider auth path in the core-api, classified against the org policy (**API keys disallowed → ADC/SA required**). file:line evidence.

## The headline

Before this sprint the advisor had **no key-free model path**: generation went through AI Studio with `?key=GEMINI_API_KEY`, and the only Vertex path (Claude) used a **static** `VERTEX_ACCESS_TOKEN`. Neither is ADC/service-account. Under the org policy both are effectively blocked → the advisor would silently fall to deterministic rules. This sprint adds a real ADC path (`vertex_auth.py` + `VertexGeminiClient`) and makes failure loud.

## Auth-path inventory

| Path                                     | Where                                                                 | Auth method                                                                           | Classification                                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GeminiClient` (generation + embeddings) | `app/clients/gemini.py:46-110`; built in `dependencies.py:get_gemini` | `?key=` query param, `settings.gemini_api_key`                                        | **API-key dependent → blocked by policy**                                                           |
| `GeminiClient.embed`                     | `gemini.py:embed` (`generativelanguage.googleapis.com`)               | `?key=`                                                                               | **API-key dependent → blocked** (embeddings still on this path — see residual)                      |
| `VertexGeminiClient` **(new)**           | `gemini.py` (this sprint)                                             | ADC bearer via `AdcTokenProvider`                                                     | **ADC compatible ✅ / service-account compatible ✅**                                               |
| `AdcTokenProvider` **(new)**             | `app/clients/vertex_auth.py`                                          | `google.auth.default()` + refresh                                                     | **ADC + SA compatible ✅** (dev: user ADC; deploy: metadata SA or `GOOGLE_APPLICATION_CREDENTIALS`) |
| `VertexClaudeAdvisorLLM`                 | `app/services/advisor_llm.py:266+`                                    | was static `VERTEX_ACCESS_TOKEN`; **now** `token_provider` (ADC) when no static token | **ADC compatible ✅** (static-token mode still available for one-off experiments)                   |
| `_llm_factory` (router premium models)   | `dependencies.py:320-334`                                             | `google_aistudio` branch → API key; `vertex_anthropic` branch → ADC (this sprint)     | google branch **API-key dependent**; anthropic branch **ADC ✅**. Router default OFF.               |
| Document-extraction model                | worker / `app/services` (extraction)                                  | uses `GEMINI_API_KEY` (AI Studio) — **unverified exact model**                        | **API-key dependent → blocked** (needs migration to Vertex; flagged)                                |

## Env / config surface

- `GEMINI_API_KEY` — AI Studio key (policy-blocked). Used by `GeminiClient`, `_llm_factory` google branch, extraction.
- `GOOGLE_API_KEY` — **not referenced** in core-api (grep clean).
- `model_provider` **(new)** — `ai_studio` (default, key) | `vertex` (ADC). Production under the policy MUST set `vertex`.
- `vertex_project` / `vertex_region` / `vertex_gemini_model` **(new)** + legacy `VERTEX_PROJECT`/`VERTEX_REGION`/`ADVISOR_MODEL`/`USE_VERTEX_CLAUDE`/`VERTEX_ACCESS_TOKEN`.

## Classification summary

- **ADC/SA compatible (key-free):** `VertexGeminiClient`, `AdcTokenProvider`, `VertexClaudeAdvisorLLM` (ADC mode), router anthropic branch.
- **API-key dependent (policy-blocked):** legacy `GeminiClient` generation **and embeddings**, router google branch, document extraction.
- **Unknown / needs live verification:** exact model used by Reports + Document extraction (see PRODUCTION_MODEL_RUNTIME_MAP.md).

## Residuals (not closed this sprint)

1. **Embeddings** still run through AI-Studio `GeminiClient.embed` (`?key=`). Under the policy this must move to Vertex embeddings (`text-embedding` on Vertex) — separate from the advisor generation path fixed here.
2. **Document extraction** model/auth not yet migrated to ADC.
3. `model_provider` defaults to `ai_studio` for dev backward-compat; **production deploy must set `vertex`** (see VERTEX_GEMINI_SETUP.md).
