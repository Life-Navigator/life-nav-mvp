# Advisor Excellence Projection (Workstream G)

Projected advisor score by configuration. **Scenarios A–D are the program's required set; the live data added
a fifth, decisive option (Gemini Pro) that was not anticipated and changes the conclusion.** Measured values
are from the 50-scenario / 5-judge benchmark; projections are labeled.

| Scenario | Config                                               |      Overall |   Trust | Actionability | Insight | Framing | Tradeoff | Source                                  |
| -------- | ---------------------------------------------------- | -----------: | ------: | ------------: | ------: | ------: | -------: | --------------------------------------- |
| A        | Current Gemini V6 (Flash)                            |         6.66 |     8.5 |           4.7 |     6.1 |     6.7 |      6.5 | **measured**                            |
| B        | Claude Sonnet                                        |     ~7.2–7.4 |    ~8.3 |          ~6.5 |    ~7.2 |    ~7.5 |     ~6.8 | _projected_ (untested — pending enable) |
| C        | Claude Opus (in-pipeline)                            |         7.30 |     8.2 |           6.2 |     7.0 |     7.3 |      6.9 | **measured**                            |
| **★**    | **Gemini Pro (in-pipeline)**                         |     **7.60** | **8.7** |           5.9 |     7.4 |     8.0 |      7.0 | **measured — clears 7.5**               |
| D        | **Best model (Gemini Pro) + Number-Gate Refinement** | **~7.9–8.1** |    ~8.7 |          ~7.0 |    ~7.6 |    ~8.2 |     ~7.2 | _projected_                             |

## Basis for the Scenario D projection (Gemini Pro + number-gate fix)

- Gemini Pro measured **7.60** all-50; **enhanced-only 8.18** (already above raw Claude 8.00).
- 4 fallbacks remain (number gate). `NUMBER_GATE_REFINEMENT_PLAN.md` (strip-not-reject + admit doc/tool/
  verified numbers) recovers ~all of them; each fallback ≈ +0.1–0.13 overall.
- Recovering ~4 fallbacks lifts all-50 from 7.60 toward the enhanced-only 8.18 → **projected ~7.9–8.1**, with
  actionability rising as the gate stops blocking grounded quantification (~5.9 → ~7.0).
- Trust stays ~8.7 (gate refinement preserves the guarantee; 0 fabrications).

## What this means

- **Advisor excellence (≥7.5) is already achievable today** by switching the advisor model **Flash → Gemini
  Pro** (7.60). No Claude, no LIOS.
- **~8.0 is reachable** with the cheap, trust-neutral number-gate refinement on top of Pro (Scenario D).
- Claude Opus (Scenario C, 7.30 in-pipeline) is **dominated** by Gemini Pro for the advisor role — lower score,
  higher cost, higher latency. Opus's value is offline/premium only.
- Sonnet (Scenario B) is plausible but **unnecessary for the advisor** given Pro already clears the bar cheaper.

## Confidence

- A, C, ★ are **measured** (high confidence).
- D is a projection from the measured enhanced-only ceiling + the quantified fallback impact (medium-high
  confidence; verify by re-running the benchmark after the gate fix).
- B is a pricing/capability estimate only (low-medium; run the live Sonnet benchmark to confirm).
