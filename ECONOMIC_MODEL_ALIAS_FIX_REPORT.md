# ECONOMIC_MODEL_ALIAS_FIX_REPORT.md — Part 1: Structural Model Fix

**Date:** 2026-06-04
**Commit:** `da00228`
**Status:** ✅ Implemented + unit-verified. Deploying to production (`f85271d`).

---

## What was wrong

`createGovernedHandler` (the single gate every model-facing route flows through) estimated each
turn's cost with a **fabricated model id**:

```ts
// apps/web/src/lib/governance/governed-route.ts (pre-fix)
estimateCost({
  provider,
  model: `${provider}-default`,
  units: { text_input: 1500, text_output: 800 },
});
```

`'gemini-default'` is **not** a key in `cost-estimator.ts`'s `RATE_TABLE` (which contains only
`gemini-2.5-flash` and `gemini-2.5-pro`). `estimateCost` therefore returned `modeled: false` and applied
its **unmodeled conservative ceiling** (`text_input: 100_000/1k`, `text_output: 300_000/1k`) =
**~390,000 micros ($0.39) per turn**, vs. the true ~$0.00035. Against the $1/day cap that capped real
users at ~2 chat turns → **110/130 (85%) of live chat calls returned HTTP 429 `budget_exceeded`.**

---

## The five verification points

| #   | Requirement                                                      | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `createGovernedHandler` no longer defaults to `gemini-default`   | ✅     | `governed-route.ts`: estimate now uses `options.model ?? DEFAULT_MODELED_MODEL[provider]`; the `'${provider}-default'` string is deleted.                                                                                                                                                                                                                                                                                             |
| 2   | `/api/agent/chat` explicitly sets the modeled Gemini SKU         | ✅     | `apps/web/src/app/api/agent/chat/route.ts`: `model: 'gemini-2.5-flash'` (matches the model the edge fn actually generates with, `graphrag-query/index.ts:50`).                                                                                                                                                                                                                                                                        |
| 3   | The cost estimator recognizes the configured model               | ✅     | `estimateCost({provider:'gemini', model:'gemini-2.5-flash', …})` returns `modeled: true`, total **353 micros** for a 1500/800 turn.                                                                                                                                                                                                                                                                                                   |
| 4   | Unknown aliases cannot silently fall back to extreme overpricing | ✅     | New `DEFAULT_MODELED_MODEL: Record<ProviderId,string>` maps every provider to its **cheapest real RATE_TABLE entry** (gemini→`gemini-2.5-flash`, openai→`gpt-4o-mini`, anthropic→`claude-3-5-haiku`). Any route that omits `model` now estimates against a _modeled_ SKU, never the ceiling. The unmodeled ceiling still exists by design for genuinely-unknown providers, but the governed path can no longer reach it accidentally. |
| 5   | Unit tests lock this regression                                  | ✅     | `cost-estimator.spec.ts` — two tests: the old `'gemini-default'` alias asserts `modeled:false` + `>300_000` micros + ≤3 turns/$1day; the fixed `gemini-2.5-flash` path asserts `modeled:true` + `<1_000` micros + thousands of turns. **12/12 estimator, 123/123 economic suite, `tsc` clean.**                                                                                                                                       |

---

## Blast radius

`createGovernedHandler` is the **only** governed model route in the codebase
(`grep createGovernedHandler` → just `agent/chat/route.ts`). The recommendation engine is deterministic
(no model call), so nothing else was over-charged. Platform monthly spend sat at **$12.48 / $500** — the
overcharge was absorbed by per-user daily caps, not the platform, so no platform-level damage.

## Residual note (tracked in Part 3 / risks)

The chat estimate counts **one** flash call, but a chat turn actually issues ~3 Gemini calls inside the
edge function (embed + NL→Cypher + answer-gen), none separately metered through the governor. Real cost
≈ 3× ≈ $0.001/turn — still trivial under the $4/day cap, but the estimate is a known **under-count**, not
an over-count. Flagged for follow-up metering.
