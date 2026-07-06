# OPUS_HYBRID_DISABLED_VALIDATION.md — Phase 7

Confirmed: Opus 4.8 is deployed-as-code but produces **zero** production Claude traffic.

| Check                         | Result                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Opus 4.8 code exists          | ✅ `VertexClaudeAdvisorLLM` + hybrid `_route` (commit 4d27fcb)                                |
| Flags default off             | ✅ `ENABLE_VERTEX_CLAUDE` unset/`false` → `hybrid_claude=None` → `_route` returns Gemini only |
| No prod traffic to Opus       | ✅ with the flag off, no turn can select Claude (proven by `test_no_hybrid_when_disabled`)    |
| No 429 exposure in pilot      | ✅ no Claude calls → no Anthropic quota usage                                                 |
| Quota request separate        | ✅ tracked in VERTEX_ANTHROPIC_QUOTA_PLAN.md, not a deploy dependency                         |
| Production config sets it off | ✅ `ENABLE_VERTEX_CLAUDE=false` in VERTEX_PRODUCTION_CONFIG.md                                |

Tests (in `tests/test_opus_hybrid.py`): disabled→Gemini, off-domain→Gemini, high-stakes-only skips ambiguous. 653 total pass.

**Net: the hybrid is dormant. Enabling is a deliberate, reversible flag flip after SA + quota + streaming.**
