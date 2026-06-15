# Beta Go / No-Go Report

**Question:** Is LifeNavigator ready for a 20-person beta?
**Decision:**

# 🔴 NO GO

Narrowly — and now down to **a single blocker**. The trust foundation is solid, the fallback fix is proven
live, and the durable observability is now live in production (migration applied, metrics endpoint
verified). The remaining blocker is one hard success criterion: **latency, missed by ~2.4×**. It is not a
trust problem; it is a speed problem with a measured root cause and a known fix (streaming).

> **Update (post-decision, same session):** B2 below is **RESOLVED** — migration `160` applied,
> `analytics.advisor_turns` live, inserts verified, `GET /v1/admin/advisor-metrics` returns 200. The
> verdict remains **NO GO solely on latency (B1)**.

All numbers below are **measured live on v89** (2026-06-14): 40 advisor turns (12 personas + adversarial +
16 hard-decision probes) + a 17-surface fresh-user E2E. No estimates.

## Success criteria — measured

| Criterion                      | Target | Measured (live)                            | Verdict     |
| ------------------------------ | ------ | ------------------------------------------ | ----------- |
| Fallback rate                  | < 5%   | **0%** (0/40)                              | ✅ PASS     |
| Latency — average              | < 4 s  | **9.7 s**                                  | ❌ **FAIL** |
| Latency — p95                  | < 6 s  | **12.7 s** (17.5 s on context-heavy turns) | ❌ **FAIL** |
| Trust violations               | 0      | **0**                                      | ✅ PASS     |
| Hallucinations (fabricated $)  | 0      | **0**                                      | ✅ PASS     |
| Archetype leakage              | 0      | **0**                                      | ✅ PASS     |
| Provenance violations          | 0      | **0**                                      | ✅ PASS     |
| Critical user-journey failures | 0      | **0** (17/17 surfaces HTTP 200, 0 errors)  | ✅ PASS     |

**7 of 8 criteria pass. The single failure is latency — and it fails badly.**

## Why NO GO (one blocker remains; the second was resolved this session)

### B1 — Latency is 2.4× over target (hard fail)

Every advisor message takes ~10 s (up to 17.5 s with context). Measured root cause (not guessed): the
Gemini generation call is **75.9%** of the turn (`llm_generate` mean 7380 ms); `context_build` is 16%;
validation/compose are ~0 ms. A 10–17 s wait per message — often for a question that _defers_ the user's
question (see B-quality) — is a churning beta experience. The fix is **streaming** (buffer for the
validator, type the answer out) + parallelizing `context_build`; both were **out of scope this sprint**
("no new features"). See `LATENCY_BREAKDOWN.md`.

### B2 — Durable observability ✅ RESOLVED (this session)

Migration `160_advisor_turns.sql` is **applied**. `analytics.advisor_turns` (table) +
`analytics.advisor_turn_metrics` (view) exist; inserts verified live (`stages_ms` stored as a proper jsonb
object after a follow-up fix, v90); `GET /v1/admin/advisor-metrics` returns **200** with the rollup for an
admin JWT. You can now durably monitor 20 live users. See `ADVISOR_METRICS_BASELINE.md`. **No longer a
blocker.**

## What IS ready (do not re-litigate)

- **The validator fix works, proven live.** 17% → **0%** fallback; the repair (`multi_question_trimmed`)
  fired 3× and salvaged every turn that used to fall back. No safety gate weakened. (`VALIDATOR_POSTFIX_AUDIT.md`)
- **Trust spine is sound.** Across 40 live turns + adversarial: 0 invented goals/risks/opps/recs, 0
  fabricated $, 0 archetype leakage, 0 advice/medical language, rejected goal never resurfaced, provenance
  honest (`user_stated`). (`EVAL_ROUND_2_RESULTS.md` Phase 7)
- **Every user journey works.** Fresh user, no data: 17/17 surfaces 200, honest empty states, no mock data,
  no broken routes. (`FRESH_USER_E2E_REPORT.md`)
- **Observability is built and correct** — per-turn telemetry, stage latency, token capture, trace mode,
  metrics endpoint. (Just needs B2 to persist.)

## Quality caveat (not a trust issue, but it compounds B1)

The advisor is **safe but evasive on decisions.** 9/16 hard-decision turns ignored the financial context
the user gave one turn earlier ("$60k saved, $450k house" → "Can I afford this?" → an open question that
never references the numbers). Combined with 10 s latency, a beta user asking "Can I afford this house?"
waits 10 s for "what does affording mean to you?". The top-3 fixes (use stated context; decision-framing
instead of vision-deflection; streaming) are in `TOP_20_ADVISOR_IMPROVEMENTS.md`.

## Path to GO (concrete — one real item left)

1. ~~Apply migration 160~~ ✅ **DONE** — table live, endpoint returns 200.
2. **Ship streaming** for the advisor turn (+ parallelize `context_build`). Re-measure: target avg < 4 s,
   p95 < 6 s. _(unblocks B1 — the sole gating item)_
3. **Decision-engagement prompt fix** (`TOP_20` #1–2): use the user's just-stated numbers; frame the
   decision instead of deflecting to vision. _(turns "safe but evasive" into "useful"; complements B1)_
4. Re-run `advisor-eval.mjs` + `advisor-decisions-probe.mjs`; confirm fallback still 0%, latency in target,
   trust still clean → flip to **GO**.

Item 2 (streaming) is the real work and the **only** reason this is NO GO. **Trust is not the blocker;
observability is now live; speed is the one thing left.**

---

_Evidence:_ `EVAL_ROUND_2_RESULTS.md`, `VALIDATOR_POSTFIX_AUDIT.md`, `ADVISOR_METRICS_BASELINE.md`,
`LATENCY_BREAKDOWN.md`, `FRESH_USER_E2E_REPORT.md`, `TOP_20_ADVISOR_IMPROVEMENTS.md`. Raw data:
`/tmp/eval_results.json`, `/tmp/decisions_probe.json`, `/tmp/fresh_user_e2e.json`, `/tmp/advisor_fly_logs.txt`.
