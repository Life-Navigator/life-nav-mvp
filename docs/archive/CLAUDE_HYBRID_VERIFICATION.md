# CLAUDE_HYBRID_VERIFICATION.md — Phase 8

Opus 4.8 hybrid is deployed-as-code but **disabled** — verified in production.

- In-machine env: `ENABLE_VERTEX_CLAUDE=false` → `get_advisor_orchestrator` builds `hybrid_claude=None` → `_route` returns Gemini only. Zero Claude traffic, zero Anthropic-quota/429 exposure.
- Routing/fallback logic present + unit-tested (`tests/test_opus_hybrid.py`, 5 tests): finance/health→Claude, off-domain→Gemini, disabled→Gemini, Claude error→Gemini same-tier fallback.
- Config (`CLAUDE_MODEL=claude-opus-4-8`, `CLAUDE_REGION=global`) staged for the future flip; remains off.

Enable later only after: Anthropic quota increase + streaming + seeded benchmark (VERTEX_ANTHROPIC_QUOTA_PLAN.md, OPUS_HYBRID_IMPLEMENTATION_PLAN.md).
