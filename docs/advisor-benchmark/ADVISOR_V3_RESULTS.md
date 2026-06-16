# Advisor V3 Results — Re-run Benchmark & LIOS Gate

**Date:** 2026-06-16 · **Version:** `advisor-hybrid-3.0.0` (live, Fly)
**Method:** identical 50-scenario benchmark, identical 5-judge rubric, same Claude Opus 4.1 + ChatGPT outputs.
Only LifeNavigator changed (V2 `2.3.0` → V3 `3.0.0`). Raw: `raw/lifenavigator_v3.json`, `raw/merged_v3.json`, `raw/scores_v3.json`.

## Gate decision: **NO-GO on LIOS Runtime Phase 1.**

V3 overall **6.29 / 10** (target **7.5**). Improved but below the bar. Per the sprint rule, **do not begin LIOS, the orchestrator, agents, Claude integration, or multi-model routing.**

---

## What V3 did

Exactly what the sprint specified: it **exposes the reasoning the advisor already computes**, in five sections — Decision Frame → Tradeoffs → What We Know → What We Still Need → Best Next Question — **without touching the trust spine.** The only validator change widened the trust check to cover the new visible sections (same logic, more coverage). Compliance, RecommendationOS, provenance, data/storage model: unchanged.

## Scoreboard (V2 → V3 vs targets vs Claude)

| Criterion              |       V2 |       V3 |         Δ | Target |        Hit?        | Claude |
| ---------------------- | -------: | -------: | --------: | -----: | :----------------: | -----: |
| Understanding          |      7.4 |      7.6 |      +0.2 |      — |                    |    9.0 |
| Context usage          |      6.9 |      7.2 |      +0.3 |      — |                    |    8.5 |
| Insight                |      4.2 |      4.4 |      +0.2 |    7.0 |         ✗          |    8.2 |
| **Tradeoff discovery** |      4.3 |  **6.4** |  **+2.1** |    7.0 |         ✗          |    7.2 |
| **Decision framing**   |      4.5 |  **6.4** |  **+1.9** |    8.0 |         ✗          |    8.6 |
| Question quality       |      6.8 |      6.7 |      −0.1 |      — | (beats Claude 6.3) |    6.3 |
| Personalization        |      6.1 |      5.9 |      −0.1 |      — |                    |    8.2 |
| Executive presence     |      6.1 |      5.8 |      −0.3 |      — |                    |    8.5 |
| Actionability          |      3.2 |      3.8 |      +0.6 |    7.0 |         ✗          |    8.7 |
| **Trust**              |      8.3 |  **8.7** |      +0.4 |    8.3 |         ✓          |    8.3 |
| **OVERALL**            | **5.78** | **6.29** | **+0.51** |    7.5 |         ✗          |   8.14 |

Wins: Claude 48, ChatGPT 2, LifeNavigator 0 (unchanged). **But LN moved from 3rd to runner-up in 14 scenarios** (was ~1) — relative standing improved sharply.

## What worked (the thesis is validated)

- **Tradeoff discovery +2.1 and decision framing +1.9** — surfacing the internal reasoning closed roughly half each of those gaps to Claude. Exposing the reasoning was the right diagnosis.
- **Trust went UP (8.3 → 8.7) while exposing 3× more content** (avg 536 → 1,668 chars), with **0 fabrications** and fallbacks cut 5 → 2. This proves you can expose reasoning without weakening trust — the central risk of the sprint. The "echo the user's own numbers in their notation, never derive" rule fixed 3 of the 5 V2 validator fallbacks with no validator-logic change.

## Why it still missed 7.5 — and why that is structural, not a prompt failure

Two criteria did not move and they cap the overall:

1. **Actionability 3.2 → 3.8 (target 7.0).** This is the binding constraint. LifeNavigator **still never advises** — the `HARD RULE` / compliance gate forbids final financial/legal/tax/medical advice, and **Rule #1 of this sprint forbids changing compliance.** Exposing the frame and tradeoffs makes the user _understand_ the decision far better, but they still leave **without a recommendation or a likely answer.** Claude scores 8.7 here precisely because it commits to a direction. **You cannot reach actionability 7.0 while the advisor is structurally prohibited from advising.**
2. **Insight 4.2 → 4.4 (target 7.0).** The 5-section format organizes known reasoning but doesn't generate the non-obvious one-liners that win scenarios (e.g. "you can borrow for college, not for retirement"). No dedicated insight step was added (out of V3 scope).

Minor regressions: **executive presence −0.3 and personalization −0.1.** The rigid five-header format reads slightly more _form-like_ than V2's prose, and the model wraps the user's numbers in quotes (`'$40k saved'`) — both cosmetic and fixable, but they show that structure traded a little voice for a lot of framing.

## The strategic fork this surfaces (decision required)

The sprint's own success bar (**actionability ≥7.0, overall ≥7.5**) is **in direct tension with Rule #1** (don't change compliance / the no-advice gate). With the no-advice rule intact, the realistic ceiling for this advisor is ~6.5–7.0 overall — a **decision-framing partner**, not an advice engine. To clear 7.5 the product must choose:

- **Option A — Let the advisor give grounded recommendations** (a deliberate, scoped relaxation of the no-final-advice rule: allow a hedged recommendation built only from grounded inputs, e.g. "given what you've told me, the path that fits is X, because…; here's what would change that"). This is a **trust-architecture/compliance change** and must be an explicit product/leadership decision — it is exactly what Rule #1 put off-limits for V3. It is also the **only** path to actionability 7+.
- **Option B — Reposition.** Accept LifeNavigator as the best _decision-framing + trust_ layer (it already beats Claude on question quality and ties/leads on trust) and stop benchmarking it as an advice engine. Then the bar for LIOS should be re-set around framing/trust, not raw advice quality.

## Recommendation

**Do not start LIOS.** Before any further advisor work, make the Option A / Option B call — it determines whether the remaining gap is even reachable. If Option A: a V4 sprint adds a grounded-recommendation section (still validator-gated, still 0 fabrication) + an insight step + de-rigidifies the format, then re-runs this benchmark. Expected to reach ~7.5. If Option B: redefine the LIOS gate around framing/trust, where V3 is already competitive.

See `ADVISOR_V2_ROADMAP.md` (P0 items still apply: insight injection, voice de-rigidification, the validator k-notation/quote polish).
