# VERTEX_CLAUDE_SETUP.md — Phase 4

Claude (Opus/Sonnet) via Vertex AI. Callable in code; availability depends on project model-access + ADC.

## State

- `VertexClaudeAdvisorLLM` (`app/services/advisor_llm.py:266+`) calls Vertex `…/publishers/anthropic/models/{model}:rawPredict` with the identical advisor prompt/parse as Gemini (so a quality delta is model-only).
- **Auth (this sprint):** now ADC by default via `token_provider` (`AdcTokenProvider`); a static `VERTEX_ACCESS_TOKEN` still takes precedence if set (for one-off experiments). No API key.
- **Activation flags:** `USE_VERTEX_CLAUDE=true` swaps the whole advisor to Claude; OR the selective router (`MODEL_ROUTER_ENABLED`+`PREMIUM_ROUTING_ENABLED`+`CLAUDE_OPUS_4_8_ENABLED` + premium tier) routes finance/health high-stakes to Claude. All default OFF.
- Default model id: `claude-opus-4-1@20250805` (`dependencies.py`); registry id `claude-opus-4-8` (`model_registry.py`).

## Turn it on (ADC, no key)

```bash
# After the owner ADC step (see VERTEX_GEMINI_SETUP.md)
USE_VERTEX_CLAUDE=true
VERTEX_PROJECT=gen-lang-client-0849161409
VERTEX_REGION=us-east5            # a region where the Anthropic model is offered on Vertex
ADVISOR_MODEL=claude-opus-4-1@20250805   # or the Sonnet id you have access to
```

The deploy SA needs `roles/aiplatform.user` AND the project must have **Anthropic model access granted in Vertex Model Garden** (separate enablement from Gemini).

## Finance & Health must not silently downgrade

Per the fallback policy (MODEL_FALLBACK_POLICY.md): if Claude is the intended model and it's unavailable (no access / auth fail / 4xx), the orchestrator now logs an `advisor_model_fallback` WARNING and records `provider`/`model` + `fallback_reason` on the turn. It will NOT silently serve Gemini-quality output as if it were Claude — the downgrade is visible in logs and telemetry.

## If Claude is intended but unavailable — fail visibly (checklist to document the gap)

1. **ADC present?** `gcloud auth application-default print-access-token` → token. If not: owner ADC step missing.
2. **Anthropic model access?** Vertex → Model Garden → request access to the Claude model in your project/region. A 404/403 on `rawPredict` = no access (loud).
3. **Region match?** Claude on Vertex is offered in specific regions (e.g. `us-east5`), not `global`. Mismatch = 404.
4. **Env set?** `USE_VERTEX_CLAUDE`, `VERTEX_PROJECT`, `ADVISOR_MODEL`.

## Status

ADC wiring COMPLETE + tested. Live callability BLOCKED on: owner ADC + Anthropic-on-Vertex model access for the project. Document the missing item from the checklist above when validating.
