# FINANCE_MODEL_BENCHMARK_AFTER_GATE_FIX.md — Phase 6 (optional)

## Why this phase is now the right lever

Phases 1–5 established that the **gate no longer blocks valid finance math by policy** (21 unit tests; benchmark/scenario math passes). The remaining live fallbacks on dollar-dense prompts are **model instruction-following variance** — `gemini-2.5-pro` inconsistently (a) phrases a computed figure as standalone vs. glued to "your income/savings", and (b) emits a `derivations` entry. That is exactly the axis a benchmark should now measure.

## Hypothesis

A stronger instruction-follower (Vertex **Claude Opus/Sonnet**) will comply more reliably with "label scenario figures / record derivations / don't glue to a possessive holding", so the SAME gate yields a higher finance pass-rate — not because the gate changed, but because the model follows the number discipline better.

## Runbook (not run here — needs the side-by-side models live)

1. Confirm gate fix in place (commit `5d7af09`); `MODEL_PROVIDER=vertex`, project `gen-lang-client-0849161409`.
2. Arms, identical context: **A** Vertex gemini-2.5-pro (current) · **B** Vertex Claude (`USE_VERTEX_CLAUDE=true`, needs Anthropic-on-Vertex access) · **C** ChatGPT baseline (if API available).
3. Prompts: the 5 finance conversations (FINANCE_ADVISOR_REPLAY.md) + the 6 critical conversations.
4. For each arm/prompt, run through the REAL orchestrator (so the repair-retry applies) and record: `llm_status` (enhanced vs fallback), whether a `derivations` entry was emitted, and the quality score (usefulness/specificity/actionability/trust).
5. Headline metric: **finance enhanced-rate (no fallback) per arm.** Expect B ≥ A on the dollar-dense prompts.

## Decision this informs

If Claude's finance enhanced-rate is materially higher, that — combined with its prior overall lead (8.84 vs 7.60) — is the case to enable Vertex Claude for the finance/health high-stakes roles (the selective-routing flags already exist; default OFF). If gemini-2.5-pro + the gate fix is "good enough", stay on it and rely on the repair-retry. **Run this before committing to the model spend.**

## Status: runbook ready; benchmark NOT executed (no ChatGPT/Claude side-by-side access in this environment).
