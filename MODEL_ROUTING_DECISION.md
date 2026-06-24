# MODEL_ROUTING_DECISION.md — Phase 4

## Recommendation: **Option A — Gemini 2.5 Pro remains primary** (with Claude wired as an opt-in, see Option C)

### Why (grounded in the live benchmark)

1. **Claude did not materially win.** Enhanced-rate: Gemini 9/10 vs Claude 8/10. Quality: comparable, Claude ≈+0.5 on specificity/tone/actionability — a marginal, not decisive, edge.
2. **Claude did not fix the gate-fallback bottleneck** — the thing this whole line of work targeted. F1 (home affordability) fell back for **both**. So switching models does not solve the dollar-dense phrasing issue.
3. **Reliability risk:** Claude Opus 4.1 returned **HTTP 429** under light concurrency on the project's `global` endpoint, and only that one model/region is enabled. Making it primary risks user-facing rate-limit fallbacks.
4. **Latency:** inconclusive but Claude trended slower; no evidence it's faster.
5. **Only Opus 4.1 is available** (not the 4.6/4.8 hoped for) — the upside ceiling is lower than assumed.

The premise that "the model is the bottleneck" no longer holds: **Gemini 2.5 Pro + the gate/policy fixes** already deliver 9/10 enhanced, answer-first, trust-preserving advice.

### The options

- **Option A (recommended): Gemini 2.5 Pro primary** for all roles. Cheaper, faster, no 429 risk, comparable quality. Ship this.
- **Option B (not recommended now): Claude Opus for advisor/finance/health.** Marginal quality gain doesn't justify the 429 reliability risk + latency, and it doesn't fix the gate fallback. Revisit if Opus 4.5+/Sonnet 4.5 becomes available with proper quota.
- **Option C (viable): Hybrid, Claude opt-in for select high-stakes turns.** Keep Gemini primary; allow Claude via the existing selective-router flags for finance/health _high-stakes_ turns only, **with a real quota + Gemini fallback within the same tier**. Worth it only after a fair (sequential, rate-limited) re-benchmark and a quota increase. The plumbing already exists (CLAUDE_VERTEX_IMPLEMENTATION_PLAN.md).

### Hard rules honored

- No model below the approved tier (Opus 4.1 ≥ Gemini 2.5 Pro tier).
- No silent fallback — every model fallback is logged with provider/model/reason.

## Verdict: **GEMINI_VERTEX_REMAINS_PRIMARY.** Claude is access-verified and wired; enabling it is a deferred, quota-gated option, not a now-win.
