# Advisor V5 Results — Grounded Math & LIOS Gate

**Date:** 2026-06-16 · **Version:** `advisor-hybrid-5.0.0` (live, Fly)
**Method:** identical 50-scenario benchmark, identical 5-judge rubric, same Claude/ChatGPT outputs. Only LifeNavigator changed (V4 → V5). Raw: `raw/lifenavigator_v5.json`, `raw/merged_v5.json`, `raw/scores_v5.json`.

## Gate decision: **NO-GO on LIOS Runtime Phase 1.** And V5 **regressed** the all-50 score.

|                    |       V3 |       V4 |       V5 | V5 enhanced-only | Target | Claude |
| ------------------ | -------: | -------: | -------: | ---------------: | -----: | -----: |
| Decision framing   |      6.4 |      6.2 |      6.2 |          **7.8** |    8.0 |    8.6 |
| Tradeoff discovery |      6.4 |      6.1 |      5.5 |          **7.1** |    7.0 |    7.3 |
| Insight            |      4.4 |      5.8 |      5.1 |              6.6 |    7.0 |    8.1 |
| Actionability      |      3.8 |      4.4 |      4.0 |              5.0 |    7.0 |    8.5 |
| Trust              |      8.7 |      8.0 |  **7.6** |              8.4 |    8.3 |    8.1 |
| **OVERALL**        | **6.29** | **6.29** | **5.83** |         **7.28** |    7.5 |   8.10 |
| Fallbacks          |        2 |        7 |   **12** |                — |      — |      — |

## What V5 did

Added the approved **grounded-math verifier**: the advisor may compute a number only via a `derivations` entry, and a **deterministic checker** confirms every operand traces to a user figure and the arithmetic is correct (wrong math / invented operands rejected). The number gate's guarantee widened from "the user's own numbers" to "the user's own **or a verified-correct computation from them**."

## The two findings that matter

### 1. On the turns where it works, V5 is the best yet — 7.28 enhanced (framing 7.8, trust 8.4)

When the advisor can ground its math, it produces genuinely competitive counsel with real quantitative specifics ("$5,200/mo spending against $7,000 → about 1.35 months covered"; "$95k + $40k = $135k liquid"). Enhanced-only V5 (7.28) is the closest LifeNavigator has come to the 7.5 bar.

### 2. But the all-50 score REGRESSED to 5.83 — because grounded math _increased_ fallbacks (7 → 12)

Encouraged to compute, the model computes **aggressively** — and a large share of useful financial quantification needs an **assumed** number it cannot ground: "$31,200 (6 months of expenses)", "20% down = $124k", retirement projections needing a growth rate. The verifier correctly rejects all of these, and the **all-or-nothing fallback discards the entire turn** (→ a generic deterministic reply scoring ~1.7). 12 such turns (concentrated in number-heavy Finance, 6/12) dragged the average below V3/V4.

## The constraint has flipped — and the next lever is NOT another trust relaxation

We relaxed three things in sequence: expose reasoning (V3), allow advice (V4), allow grounded math (V5). Each lifted _enhanced_ quality but **the all-or-nothing fallback mechanism converts every grounding miss into a zero-quality turn**, and V5's extra computation created more misses than its math recovered. The binding constraint is now the **fallback mechanism itself**, not the advisor's intelligence:

- **V5 enhanced quality = 7.28.** If those 12 fallbacks had instead kept the validated remainder of the reply, all-50 would be ≈ **7.2** — at the bar.

The fix is **graceful degradation (repair-not-reject):** when one number fails verification, strip/qualitative-ize that number and keep the rest of the already-validated reply, instead of discarding the whole turn. **This is trust-neutral/positive** (it removes the ungrounded number and keeps the grounded counsel) and needs no further trust relaxation. It is the clear, highest-leverage next step.

## A real cost surfaced: advice can be CONCEPTUALLY wrong

Trust dropped 8.7 → **7.6 (below the 8.3 target)**. The number verifier holds (0 fabricated _numbers_ that it governs), but LifeNavigator earned its **first-ever** trust flag (fin-10) for a **conceptual** error — calling mortgage paydown "a tax-free return." This is the inherent cost of letting an advisor advise: once it takes positions and does math, it can be _wrong in reasoning_ even with numbers grounded (Claude is flagged the same way, twice). The number-grounding spine does not — and cannot — guarantee advice _correctness_.

## Production note

V5's **24% fallback rate** means ~1 in 4 real turns would return a generic non-answer — poor UX. **V4** (advice, 14% fallback) or **V3** (5-section, 4% fallback) are better production experiences today. Recommend running prod on **V4** until graceful degradation lands.

## Recommendation

1. **Do not start LIOS** (5.83).
2. **Stop relaxing trust** — V5 shows further relaxation now _lowers_ the net score and dropped trust below target. The remaining gap is an **engineering** problem (the fallback mechanism), not a trust-policy one.
3. **Build V6 = graceful degradation** (repair-not-reject + a single repair-retry that asks the model to drop any unverified number). This converts the proven 7.28 enhanced quality into a ~7.2 all-50 — the realistic path to the bar — with **no** further trust relaxation.
4. **Roll prod back to V4** for UX until V6 lands.
5. Accept that **advice correctness** is now a live risk to monitor (not just number fabrication).
