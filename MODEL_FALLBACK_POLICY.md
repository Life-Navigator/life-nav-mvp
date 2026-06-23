# MODEL_FALLBACK_POLICY.md — Phase 5

## Current behavior (audited, file:line)

The orchestrator (`advisor_orchestrator.py:_enhance`) already records fallback telemetry to `tr` (→ `analytics.advisor_turns`) and `base["llm_status"]`:

- `fallback:unavailable` (LLM returned None — provider/auth failure or unparseable)
- `fallback:<validator reasons>` (output rejected by the trust gate)
- `fallback:empty`, `fallback:error`
  Plus `tr["fallback_used"]`, `tr["fallback_reason"]`, an optional router `model_fallback`, and a one-shot router fallback model when `MODEL_ROUTER_ENABLED`.

**Gap before this sprint:** the fallback to deterministic rule-text was logged at info/telemetry level only and did **not** expose the provider/model — so an auth-driven silent quality drop was possible to miss, and there was no key-free model to fall back _to_.

## New rules (implemented this sprint)

1. **Loud always.** Any model fallback (unavailable/error) emits a `log.warning` `advisor_model_fallback` with `turn_id`, `provider`, `model`, `reason` (+ `detail` on error). Auth failures (`VertexAuthError`) are logged by the LLM wrapper too. (`advisor_orchestrator.py`, `advisor_llm.py`, `vertex_auth.py`)
2. **Provider/model on every response.** `base["provider"]` + `base["model"]` (and the same on the turn row) prove what actually answered — so a downgrade is visible in the response metadata, not just inferable.
3. **No silent Flash downgrade.** The default model is config-driven (`gemini-2.5-pro`); there is no code path that silently swaps to Flash. The router can only _demote within premium tiers_ and only when explicitly enabled (`MODEL_ROUTER_ENABLED`, default OFF).
4. **No API-key fallback under the policy.** When `model_provider=vertex`, the advisor uses ADC only; if ADC fails it falls to the **deterministic safe text** (loudly) — it does NOT fall back to the API-key path. (The key path is reachable only by explicitly setting `model_provider=ai_studio`.)
5. **Capability-tier discipline.** A model→model fallback (router) is allowed only within the same capability tier and only when configured; cross-tier silent substitution is not a code path. The deterministic rule-text is a _safety_ floor, always labeled as a fallback — never presented as model output.

## Not allowed (enforced by the above)

- ❌ silent Gemini-Flash downgrade — no such path.
- ❌ generic model substitution without visibility — every swap sets `provider/model` + logs.
- ❌ API-key fallback when `model_provider=vertex` — ADC-only.
- ❌ a fallback that changes advisor quality invisibly — `llm_status` + `provider/model` + WARNING make it visible.

## How to monitor

- `flyctl logs -a lifenavigator-core-api | grep advisor_model_fallback` — every loud fallback.
- `analytics.advisor_turns`: `fallback_used`, `fallback_reason`, `provider`, `model`, `llm_status` per turn; `GET /v1/admin/advisor-metrics`.
- A spike in `fallback:unavailable` with `provider=vertex_gemini` ⇒ ADC/permission problem (not a model-quality problem).
