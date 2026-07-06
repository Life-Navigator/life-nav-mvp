# ADVISOR_MODEL_QUALITY_AUDIT.md — Phase 2

## Which model runs in production (proven)

**Every advisor turn → `GeminiAdvisorLLM` → Google AI Studio `gemini-2.5-flash`.**

- Default wiring: `dependencies.py:311-312` instantiates `GeminiAdvisorLLM(gemini)`; model string `config.py:26` (`gemini_generation_model = "gemini-2.5-flash"`).
- `USE_VERTEX_CLAUDE` default `"false"` → Claude branch skipped (`dependencies.py:294,304-310`).
- `MODEL_ROUTER_ENABLED` default `"false"` → router bypassed, single Gemini client used (`advisor_orchestrator.py:216-230`; `model_registry.py:18-26`).

## Models wired but OFF

- **`VertexClaudeAdvisorLLM`** (`advisor_llm.py:260`) — Claude via Vertex `rawPredict`; identical prompt/parse to Gemini, so any benchmark delta is **model-only**. Default model string `claude-opus-4-1@20250805` (`dependencies.py:308`); registry id `claude-opus-4-8` (`model_registry.py`).
- To activate the simple swap: `USE_VERTEX_CLAUDE=true` + `VERTEX_ACCESS_TOKEN` + `VERTEX_PROJECT`.
- To activate selective routing (health/finance high-stakes → Claude): ALL of `MODEL_ROUTER_ENABLED`, `PREMIUM_ROUTING_ENABLED`, `CLAUDE_OPUS_4_8_ENABLED` = true + premium/enterprise tier + Vertex creds. All default OFF.
- No `gemini-default` alias / daily-cap bug in this Python backend (that was the Vercel/TS side, historically fixed). `cost_meter.py` is observability-only here.

## Existing benchmark evidence (in-repo, `docs/advisor-benchmark/`)

Running identical prompts/context through models has **already been done** and committed:

- `LIFENAVIGATOR_VS_CHATGPT_VS_CLAUDE.md` (2026-06-16, 50 real scenarios, 5 LLM-judge agents): **Claude Opus 8.2 · ChatGPT 6.2 · LifeNavigator 5.8.** Wins: **Claude 48/50, ChatGPT 2/50, LN 0/50.** LN led only on Question quality (6.8) + tied Trust (8.3); lost actionability −5.5, decision framing −4.1, insight −3.8.
- `CLAUDE_CONTROL_EXPERIMENT.md`: swapping **only** the model (Gemini→Claude, same pipeline/context) moved overall **6.66 → 7.30 (+0.64)**, improved every quality criterion; trust dipped 8.5→8.2. Did not alone clear the 7.5 bar.
- Registry-encoded measured scores: `gemini-2.5-flash` 6.66/trust 8.5; `gemini-2.5-pro` 7.60/8.7; `claude-opus-4-8` 8.84/9.3 (`model_registry.py:48,54,60`).

## The 6 test prompts — static expectation under the CURRENT pipeline

I cannot re-run live models without Vertex creds + a running backend. But the pipeline behavior is deterministic enough to predict failure modes (validated against the trace + benchmark data):

| Prompt                                         | Predicted current failure (pipeline, not just model)                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1. Workout + nutrition plan                    | Number gate kills rep/calorie/macro numbers; no health grounding; forced into decision-frame + question. **No usable plan.**        |
| 2. I got promoted                              | Routes OK; but advisor over-asks (mandatory question) and can't state comp benchmarks (number gate).                                |
| 3. What if I die tomorrow?                     | Estate/insurance reasoning blocked by "no legal advice" + number gate on coverage multiples (10–15× income → rejected).             |
| 4. UT AI master's before house?                | The one prompt the decision-frame fits — but "20% down", typical rates, projections all rejected by number gate → qualitative mush. |
| 5. Trust vs life insurance conflict?           | "no legal advice" + ungrounded-relationship gate → likely fallback.                                                                 |
| 6. Prepare financially + physically for a baby | Cross-domain; finance benchmarks + fitness numbers both gated; health ungrounded.                                                   |

## Conclusion

Model quality is a **real, measured ~half of the gap** (+0.64 from Claude swap; Claude beats LN 48/0 head-to-head). But model is **not the whole story** — even on Claude the pipeline plateaued below 7.5 because the **number gate + forced structure** cap actionability regardless of model. **Fixing the model without fixing the gate leaves money on the table; fixing the gate without the model leaves ~0.6 on the table.** Both are needed.

> Live multi-model re-run (Phase 2 as literally specified) requires Vertex creds + running backend — NOT executed in this pass. The in-repo benchmark already supplies the head-to-head evidence.
