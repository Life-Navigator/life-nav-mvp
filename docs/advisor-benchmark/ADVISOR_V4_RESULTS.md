# Advisor V4 Results — Grounded Advice & LIOS Gate

**Date:** 2026-06-16 · **Version:** `advisor-hybrid-4.0.0` (live, Fly)
**Method:** identical 50-scenario benchmark, identical 5-judge rubric, same Claude Opus 4.1 + ChatGPT outputs. Only LifeNavigator changed (V3 → V4). Raw: `raw/lifenavigator_v4.json`, `raw/merged_v4.json`, `raw/scores_v4.json`.

## Gate decision: **NO-GO on LIOS Runtime Phase 1.** (overall 6.29, target 7.5)

V4 was the approved **Option A** — let the advisor give grounded recommendations (a scoped, signed-off relaxation of the no-advice rule). It worked where it ran, but a newly-exposed constraint held the overall flat.

## What V4 changed

- Added a 6th section, **Recommendation ("My read:")** — the advisor takes a clear, hedged position grounded in the user's facts, plus one non-obvious insight, plus a disclaimer.
- **Scoped compliance relaxation (authorized):** strategic / personal-finance / planning advice now ALLOWED; **medical, legal, tax, and specific investment-product advice remain hard-blocked** (verified live + in tests). The **number-grounding gate (zero fabrication) was left unchanged.**

## Scoreboard (V2 → V3 → V4 vs targets)

| Criterion          |       V2 |       V3 |             V4 | Target | Claude |
| ------------------ | -------: | -------: | -------------: | -----: | -----: |
| Understanding      |      7.4 |      7.6 |            7.2 |      — |    8.9 |
| Context usage      |      6.9 |      7.2 |            6.7 |      — |    8.4 |
| **Insight**        |      4.2 |      4.4 | **5.8** (+1.4) |  7.0 ✗ |    7.9 |
| Tradeoff discovery |      4.3 |      6.4 |            6.1 |  7.0 ✗ |    7.3 |
| Decision framing   |      4.5 |      6.4 |            6.2 |  8.0 ✗ |    8.5 |
| Question quality   |      6.8 |      6.7 |            6.3 |      — |    6.4 |
| Personalization    |      6.1 |      5.9 |            5.9 |      — |    8.0 |
| Executive presence |      6.1 |      5.8 |            6.2 |      — |    8.5 |
| **Actionability**  |      3.2 |      3.8 | **4.4** (+0.6) |  7.0 ✗ |    8.6 |
| Trust              |      8.3 |      8.7 |            8.0 |  8.3 ✗ |    8.2 |
| **OVERALL**        | **5.78** | **6.29** |       **6.29** |  7.5 ✗ |   8.08 |

**Wins: Claude 48, LifeNavigator 1 (fin-03 — its first ever win), ChatGPT 1. LN was runner-up in 33/50** (V3: 14, V2: 1). **0 LN fabrications** (Claude flagged on 2).

## The result that matters: enhanced vs fallback

| Subset          |  Overall | Actionability | Framing | Insight | Trust |
| --------------- | -------: | ------------: | ------: | ------: | ----: |
| **All 50**      |     6.29 |           4.4 |     6.2 |     5.8 |   8.0 |
| **43 enhanced** | **7.03** |           5.0 |     7.0 |     6.6 |   8.4 |
| **7 fallbacks** |     1.74 |           1.0 |       — |       — |     — |

**When V4 actually answers, it scores 7.03** — within striking distance of the 7.5 bar, with trust 8.4 and framing 7.0. The all-50 average is dragged to 6.29 entirely by **7 fallbacks**.

## Why it still missed — one root cause, now clearly identified

Both remaining ceilings trace to the **zero-fabrication number gate** (which we deliberately did NOT touch — your hard "no fabrication" rule):

1. **The 7 fallbacks** (fin-07, fin-08, car-02, car-09, crs-03, crs-04, crs-07) all occurred because the recommendation reached for a **derived number** (a payoff figure, a conventional benchmark like "20% down") and the gate rejected the whole reply. Good quantitative advice naturally wants to compute; the gate forbids any number not verbatim the user's. Eliminating these → projected overall **~7.03**.
2. **Actionability caps at 5.0 even on enhanced turns** because LN can only give **qualitative** advice ("keep a larger cushion", "prioritize the high-interest debt") — never the **quantitative** specifics that earn Claude's 8.6 ("you'd net ~$X", "that's about N months of runway"). The gate forbids arithmetic even of the user's _own_ numbers.

Minor: trust dipped 8.7 → 8.0 — taking a position is inherently scored slightly lower on "groundedness/uncertainty" than V3's question-only stance, though still 0 fabrications.

## The next decision (the now-binding constraint)

We have relaxed two things in sequence: **expose reasoning** (V3) and **allow advice** (V4). The constraint that now caps the score is the **zero-fabrication number gate forbidding derived arithmetic.** To clear 7.5, the realistic path is:

- **V5 — allow grounded arithmetic from the user's OWN numbers** (e.g. "20% of your $620k ≈ $124k", "$40k is about 2 months at your $5,200/mo"). This would eliminate the 7 fallbacks AND lift quantitative actionability toward Claude's level. **It is a real trust-architecture change:** computed numbers can be _wrong_ (Claude was dinged for exactly this twice), so it must ship with a **deterministic arithmetic verifier** (compute the number ourselves and check the model's against it) — not a blanket "trust the model's math." This needs your explicit sign-off, like the advice relaxation did.
- **Alternative — accept ~7.0 and reposition.** V4-enhanced at 7.03 with 8.4 trust and 0 fabrications is a credible "grounded decision partner." If that's the product, re-set the LIOS gate to ~7.0-on-enhanced and ship a fallback-reduction pass first.

## Recommendation

**Do not start LIOS yet** (6.29 < 7.5). The advice relaxation was the right call and proved out on enhanced turns (7.03). The remaining gap is now a single, well-understood lever: **derived-number grounding.** Decide V5 (grounded arithmetic + verifier) vs reposition before more advisor work. Either way, a quick **fallback-reduction pass** (the model still occasionally derives a number despite instructions) is worth ~+0.7 overall on its own.
