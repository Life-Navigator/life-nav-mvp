# OPUS_HYBRID_FIX_REPORT.md — Phase 5/7 (implemented behind flags)

## Built (default OFF — no behavior change until flagged)

A domain-scoped Opus 4.8 hybrid in the existing routing layer:

- `dependencies.get_advisor_orchestrator`: when `ENABLE_VERTEX_CLAUDE=true`, builds a `VertexClaudeAdvisorLLM` (ADC, no key) and passes it as `hybrid_claude` with `claude_domains`.
- `AdvisorOrchestrator._route`: a clearly **finance/health** turn → returns `(claude, gemini)` = **Claude primary, Gemini same-tier fallback**. Off-domain or ambiguous turns → Gemini. (`route_domains` keyword match; `CLAUDE_HIGH_STAKES_ONLY` requires a focused, non-all-domain hit.)
- Fallback: Claude 429/error → `generate()` returns None → `_enhance` falls to the Gemini fallback_llm, sets `tr["model_fallback"]`, logs `advisor_model_fallback` — **never silent**. `provider`/`model` recorded per turn.

## Env flags (all default OFF / safe)

```
ENABLE_VERTEX_CLAUDE=true
CLAUDE_MODEL=claude-opus-4-8
CLAUDE_REGION=global          # Claude is served only on `global` for this project
CLAUDE_DOMAINS=finance,health
CLAUDE_HIGH_STAKES_ONLY=true
```

## Tests (646 total pass; +5 in `tests/test_opus_hybrid.py`)

- finance turn → Claude (Gemini fallback) ✅
- health turn → Claude ✅
- off-domain (education) turn → stays Gemini ✅
- hybrid disabled → Gemini, no fallback ✅
- high-stakes-only skips ambiguous turns → Gemini ✅

## Not done (by design)

- Not enabled in any environment (flag off).
- No global swap (this is domain-scoped; `USE_VERTEX_CLAUDE` remains the separate whole-swap path).
- Not deployed (blocked on the prod SA + quota; see GEMINI_BASELINE_DEPLOY_PLAN.md + VERTEX_ANTHROPIC_QUOTA_PLAN.md).

## Status: code complete + tested, OFF. Enable only after SA + quota + (ideally) streaming.
