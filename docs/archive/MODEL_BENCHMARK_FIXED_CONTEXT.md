# MODEL_BENCHMARK_FIXED_CONTEXT.md — Phase 6

**Status: BLOCKED on owner ADC** (a fresh fixed-context benchmark needs live Vertex auth + running backend). This is the runbook + the existing in-repo evidence so the result isn't guessed.

## Existing fixed-context evidence (already committed, `docs/advisor-benchmark/`)

Same prompts/context, model swapped — the clean signal:

- **LIFENAVIGATOR_VS_CHATGPT_VS_CLAUDE.md**: Claude Opus **8.2** · ChatGPT **6.2** · LifeNavigator **5.8**; Claude won 48/50, LN 0/50. LN lost on actionability/decision-framing/insight, tied on trust.
- **CLAUDE_CONTROL_EXPERIMENT.md**: identical pipeline, Gemini→Claude = **6.66 → 7.30 (+0.64)**.
- Registry-encoded scores: `gemini-2.5-flash` 6.66 · `gemini-2.5-pro` 7.60 · `claude-opus-4-8` 8.84 (`model_registry.py`).

## What changed since that benchmark (must be re-measured)

1. Model default moved `gemini-2.5-flash` → `gemini-2.5-pro` (expected ~6.66 → ~7.60 on the model axis alone).
2. The **number gate** was scoped to personal-$ only, and the **forced-question / decision-structure** relaxed (prior sprint). The old benchmark ran with the restrictive gate, which capped actionability _regardless of model_. So the new pipeline should lift LN's actionability independent of the model swap — this is the whole point of re-running.

## Runbook (execute after `gcloud auth application-default login`)

1. Set `MODEL_PROVIDER=vertex`, `VERTEX_PROJECT`, region; deploy/run core-api.
2. Run the existing harness against the live endpoint for each arm:
   - **Arm A — current runtime** (whatever prod resolves to; confirm via the `provider`/`model` on the response).
   - **Arm B — Vertex Gemini 2.5 Pro** (`MODEL_PROVIDER=vertex`, `VERTEX_GEMINI_MODEL=gemini-2.5-pro`).
   - **Arm C — Vertex Claude** (`USE_VERTEX_CLAUDE=true`) _if Anthropic-on-Vertex access is granted; else record "unavailable" loudly (VERTEX_CLAUDE_SETUP.md)_.
     Harnesses already exist: `apps/web/advisor-eval.mjs`, `advisor-decisions-probe.mjs` (drive the live advisor, self-clean).
3. Fixed prompt set (identical context per arm): workout+nutrition plan · promotion impact · estate risk · education timing · trust/life-insurance conflict · baby planning.
4. Score each 0–10: specificity · context usage · naturalness · domain expertise · safety · usefulness. Use the 5-judge LLM panel from the prior benchmark for comparability.
5. Record per arm: the `provider`/`model` echoed on each response (proves the arm actually ran), fallback count from `flyctl logs grep advisor_model_fallback`, latency p50/p95.

## Expected (hypothesis to confirm, NOT a result)

Arm B > prior LN (model + relaxed gate); Arm C ≥ Arm B on actionability/insight. The workout prompt specifically should now return a concrete plan (number gate no longer nukes reps/calories) — that's the headline check, also covered in MODEL_ROUTING_LIVE_VALIDATION.md.

## Result table (fill on execution)

| Prompt                   | Arm A (current) | Arm B (Vertex Gemini Pro) | Arm C (Vertex Claude) |
| ------------------------ | --------------- | ------------------------- | --------------------- |
| Workout + nutrition      | —               | —                         | —                     |
| Promotion impact         | —               | —                         | —                     |
| Estate risk              | —               | —                         | —                     |
| Education timing         | —               | —                         | —                     |
| Trust/insurance conflict | —               | —                         | —                     |
| Baby planning            | —               | —                         | —                     |
