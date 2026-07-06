# OPUS_HYBRID_IMPLEMENTATION_PLAN.md — Phase 5

The code is built (OPUS_HYBRID_FIX_REPORT.md). This is the **rollout plan** to enable it safely.

## Target

- Domains: **finance, health** (high-stakes only). Reports later (separate flag/role).
- Model: `claude-opus-4-8` on `global` (the only enabled, callable Opus; VERTEX_ANTHROPIC_MODEL_CATALOG.md).
- Fallback: Gemini 2.5 Pro same-tier, loud, metadata — already implemented.

## Prerequisites (in order)

1. **Prod service account** for Vertex ADC (GEMINI_BASELINE_DEPLOY_PLAN.md) — required for ANY Vertex call in prod.
2. **Anthropic quota increase** (VERTEX_ANTHROPIC_QUOTA_PLAN.md) — else high-stakes turns intermittently fall back to Gemini under load.
3. **Advisor streaming** live — Opus 4.8 runs ~26s/turn raw; streaming masks it (ack ~1.3s). Without it the hybrid degrades perceived latency on exactly the high-stakes turns.

## Enable sequence (after prereqs)

1. Set on Fly: `ENABLE_VERTEX_CLAUDE=true`, `CLAUDE_MODEL=claude-opus-4-8`, `CLAUDE_REGION=global`, `CLAUDE_DOMAINS=finance,health`, `CLAUDE_HIGH_STAKES_ONLY=true`.
2. Canary: internal users only first. Watch `analytics.advisor_turns` for `provider=vertex_anthropic`, `advisor_model_fallback reason~=429`, latency, and trust (0 fabrication).
3. If fallback-429 rate is low and quality lifts on finance → widen to pilot.
4. Rollback = unset `ENABLE_VERTEX_CLAUDE` → instant return to Gemini. Flags only; no data migration.

## Acceptance before pilot-wide

- Claude `provider/model` proven on finance/health turns; off-domain turns stay Gemini.
- 429-fallback rate < a few %; latency acceptable with streaming.
- Seeded-user benchmark shows a real finance/health lift (SEEDED_MODEL_BENCHMARK.md).
