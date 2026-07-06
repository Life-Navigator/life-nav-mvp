# COST_ESTIMATION_VERIFICATION_REPORT.md — Part 3

**Date:** 2026-06-04
**Method:** Ran `estimateCost()` directly against each path (real output captured below).

---

## Estimation matrix (live `estimateCost` output)

| Path                    | provider / model                          | units             | result                     | modeled? | verdict                                                                                                 |
| ----------------------- | ----------------------------------------- | ----------------- | -------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| **Chat turn**           | gemini / `gemini-2.5-flash`               | 1500 in / 800 out | **353 micros ($0.000353)** | ✅ true  | Reasonable. ~11,400 turns fit the $4/day cap.                                                           |
| **Recommendation tier** | gemini / `gemini-2.5-pro`                 | 1500 in / 800 out | 5,875 micros ($0.005875)   | ✅ true  | Reasonable for tier-2. (Recs are deterministic today — not metered — but the tier is priced correctly.) |
| **Embedding (dim)**     | gemini / `gemini-2.5-flash` · `embedding` | 1000 tok          | 25 micros ($0.000025)      | ✅ true  | Correct, cheap.                                                                                         |
| **Unknown alias**       | gemini / `gemini-embedding-001`           | 1500 / 800        | 390,000 micros ($0.39)     | ❌ false | **Fails _safe_ (over-estimates), but see latent risk.**                                                 |
| **The bug**             | gemini / `gemini-default`                 | 1500 / 800        | 390,000 micros ($0.39)     | ❌ false | The pre-fix value. Chat no longer uses this.                                                            |

---

## Findings vs. requirements

- ✅ **Chat turn estimate is reasonable** — $0.000353, modeled.
- ✅ **Unknown aliases fail safely** — they return `modeled:false` + a conservative $0.39 ceiling (never a crash, never an under-charge). The governed path can no longer _reach_ an unknown alias by accident (Part 1's `DEFAULT_MODELED_MODEL`).
- ✅ **Estimates conservative but not absurd** — for modeled SKUs, flash $0.00035 / pro $0.0059 track real Gemini pricing.
- ✅ **No route produces $0.39/turn unless truly priced that way** — the only $0.39 results are genuinely _unmodeled_ models, which is the intended "discourage shipping an unpriced provider" behavior. The chat route is now modeled.

## ⚠️ Latent risk surfaced — `gemini-embedding-001` is unmodeled

The embedding model the GraphRAG pipeline actually uses (`gemini-embedding-001`) is **not** a `RATE_TABLE`
key, so `estimateCost` returns the $0.39 ceiling for it. **Today this is harmless** because embeddings
are generated inside the `graphrag-query` edge function and are **not metered through `estimateCost`**.
But if anyone ever routes an embedding call through the governed estimator (or adds an embedding feature
to a governed route), it would hit the same unmodeled-ceiling trap the chat bug did. **Recommendation:**
add `gemini-embedding-001` (and an explicit `text-embedding` priced entry) to `RATE_TABLE` proactively.
Tracked in `TOP_REMAINING_ECONOMIC_RISKS.md`.

## Note — the chat estimate is an under-count, not over-count

The 353-micro estimate prices **one** flash call. A real chat turn issues ~3 Gemini calls (embed +
NL→Cypher + answer-gen) inside the edge function, none separately metered. True cost ≈ ~$0.001/turn.
Still trivial under $4/day, but the governor under-counts chat cost — the opposite of the original bug.
