# SEEDED_MODEL_BENCHMARK.md — Phase 8

## Status: BLOCKED — needs real seeded users on live Supabase (not available in this environment)

Every benchmark so far used `FakeSupabase` (EMPTY context) — it measured model reasoning, NOT personalized grounding (ADVISOR_CONTEXT_QUALITY_AUDIT.md). The seeded benchmark is the one missing measurement and the only way to answer "is retrieval the bottleneck for PERSONALIZED advice."

## Runbook (after deploy + seeded users exist)

1. Seed 3 users on live Supabase: finance-heavy (accounts/transactions/goals), health-heavy (logs/goals), family/document-heavy (dependents/uploaded will+insurance).
2. For each, run the 10 prompts + personalized variants ("given MY accounts, rebalance"; "given MY will, what's missing") through the live advisor — two arms: **Gemini baseline** and **Opus hybrid** (ENABLE_VERTEX_CLAUDE=true).
3. Capture per turn from `analytics.advisor_turns`: the fact-packet contents (did it retrieve the user's real rows?), `provider`/`model`, `llm_status`, citations, latency, fallback reason.
4. Score: context usage · personalization · finance precision · health usefulness · trust · latency · fallback rate.

## What it will settle

- Whether the fact packet actually surfaces each user's real data (the production "retrieval" quality).
- Whether Opus 4.8 lifts PERSONALIZED finance/health (the empty-context benchmark showed a generic-finance lift; personalization is untested).
- The true ROI ranking: Opus hybrid vs streaming vs fact-packet enrichment.

## Status: runbook ready; execution BLOCKED on deploy + seeded live users.
