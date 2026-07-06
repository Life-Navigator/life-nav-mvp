# CLAUDE_VERTEX_IMPLEMENTATION_PLAN.md — Phase 5

Claude did **not** clearly win (MODEL_ROUTING_DECISION.md → Gemini stays primary), so this is the plan to keep ON HAND for the **hybrid opt-in** (Option C) — to execute only after a fair re-benchmark + a Vertex quota increase. **Do not deploy now.**

## Already in place (no new code needed for the simple swap)

- `VertexClaudeAdvisorLLM` (ADC, no key) — wired; `USE_VERTEX_CLAUDE=true` swaps the whole advisor.
- Selective router (`MODEL_ROUTER_ENABLED`/`PREMIUM_ROUTING_ENABLED`/`CLAUDE_OPUS_4_8_ENABLED`) — per-role routing, default OFF.
- Loud fallback + provider/model telemetry.

## Env / model IDs

```
# Hybrid (recommended shape) — Gemini primary, Claude for high-stakes:
MODEL_PROVIDER=vertex
VERTEX_PROJECT=gen-lang-client-0849161409
VERTEX_REGION=us-central1                 # Gemini
# Claude (the only available model/region for this project):
ADVISOR_MODEL=claude-opus-4-1@20250805
# Claude is served ONLY on the `global` endpoint here → the Claude client must use region=global
MODEL_ROUTER_ENABLED=true                 # only when ready
PREMIUM_ROUTING_ENABLED=true
```

**Code note:** the router's `vertex_anthropic` factory must pin `region="global"` for Claude (regional endpoints 404 for this project). Update `_llm_factory` to force global for the anthropic branch, OR set `VERTEX_REGION=global` only for the Claude client.

## Provider-router changes (small)

1. Pin Claude region=global in `dependencies._llm_factory` (anthropic branch).
2. Confirm `model_registry` role map points finance/health high-stakes → the Claude key, and that the key's `model_id` = `claude-opus-4-1@20250805`.
3. Keep Gemini 2.5 Pro as the fallback model within the premium tier (so a Claude 429 degrades to Gemini, not to deterministic text).

## Fallback policy

- Claude 429/5xx/timeout → fall back to Gemini 2.5 Pro (same-tier), logged `advisor_model_fallback` with reason. Never silent. (This is the single most important guard given the observed 429s.)

## Logging / metadata

- Already emits provider/model per turn; add a counter/alert on `advisor_model_fallback reason=429` to watch Claude quota.

## Tests

- Unit: router selects Claude for finance/health high-stakes when flags on; 429 → Gemini fallback (mock).
- Add a region-pin test (Claude factory uses global).

## Deploy path

1. Request a Vertex Anthropic **quota increase** for the project (the 429s are blocking at scale).
2. Re-benchmark sequentially (rate-limited) to get true latency + a clean enhanced-rate — gate must show Claude ≥ Gemini before enabling.
3. Reconcile branch → `main` (per MODEL_BRANCH_DEPLOYMENT_PLAN.md); deploy core-api from `main`.
4. Enable flags for a canary (internal users) first; watch `advisor_model_fallback` 429 rate + latency.

## Rollback

- Set `USE_VERTEX_CLAUDE=false` / `MODEL_ROUTER_ENABLED=false` → instantly back to Gemini 2.5 Pro. No data migration; flags only.

## Status: plan ready, NOT executed. Prerequisite = quota increase + fair re-benchmark showing a real Claude win.
