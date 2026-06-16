# Model Capability Analysis (Workstream A)

**Date:** 2026-06-16 · **Basis:** the Claude Control Experiment (identical pipeline, model swapped) + the V2–V6 arc. All scores are the 5-judge benchmark on the same 50 scenarios.

## Headline scores

|                                           | Overall | Trust | Actionability | Insight | Framing | Tradeoff |
| ----------------------------------------- | ------: | ----: | ------------: | ------: | ------: | -------: |
| **Gemini V6** (prod, gemini-2.5-flash)    |    6.66 |   8.5 |           4.7 |     6.1 |     6.7 |      6.5 |
| **Claude V6** (LN arch + Claude Opus 4.1) |    7.30 |   8.2 |           6.2 |     7.0 |     7.3 |      6.9 |
| **Raw Claude** (no platform)              |    8.00 |   8.2 |           8.5 |     7.9 |     8.4 |      7.0 |

## Claude Uplift (Claude V6 − Gemini V6) — the value of the MODEL, pipeline held constant

| Criterion          |         Δ |
| ------------------ | --------: |
| **Overall**        | **+0.64** |
| Actionability      |  **+1.5** |
| Insight            |      +0.9 |
| Question quality   |      +0.8 |
| Personalization    |      +0.8 |
| Executive presence |      +0.8 |
| Decision framing   |      +0.6 |
| Understanding      |      +0.4 |
| Tradeoff discovery |      +0.4 |
| Context usage      |      +0.3 |
| Trust              |      −0.3 |

**Every quality criterion improved with the model swap alone.** The biggest gains are exactly the criteria the
V-series could not move with prompting (actionability, insight). The lone regression is trust (−0.3), explained
below.

## Platform Suppression (Raw Claude − Claude V6) — what the LN pipeline costs Claude

| Criterion            | Δ (raw − LN) | Note                                                                           |
| -------------------- | -----------: | ------------------------------------------------------------------------------ |
| **Overall**          |    **+0.70** | concentrated in fallbacks                                                      |
| Actionability        |         +2.3 | number gate caps quantitative advice (even enhanced: 6.9 vs 8.5)               |
| Decision framing     |         +1.1 |                                                                                |
| Executive presence   |         +1.1 |                                                                                |
| Understanding        |         +1.0 |                                                                                |
| Insight              |         +0.9 |                                                                                |
| Personalization      |         +0.7 |                                                                                |
| Tradeoff             |         +0.1 |                                                                                |
| Trust                |          0.0 | equal score, but LN had **0 fabrications vs raw Claude's 3**                   |
| **Question quality** |     **−0.8** | LN is HIGHER (7.2 vs 6.4) — the one-sharp-question discipline beats raw Claude |

**Critical nuance:** on the 44 non-fallback turns, **LN+Claude overall = 8.08 ≈ raw Claude 8.00** — net parity.
The 0.70 all-50 suppression is almost entirely the **6 number-gate fallbacks** (~1.7 each). The one persistent
_per-criterion_ suppression even on passed turns is **actionability** (the number gate blocks benchmark/
projection quantification), offset by LN's higher question-quality and its fabrication catching.

## Trust / Actionability / Insight / Framing / Tradeoff deltas (summary)

- **Trust:** model swap −0.3 (Claude takes more positions → more conceptual-error risk), but the **platform
  neutralizes Claude's number fabrication** (raw Claude 3 fab → LN+Claude 0). Net: equal trust _score_,
  strictly safer _numbers_. This is the platform's core value.
- **Actionability:** the single largest model lever (+1.5) AND the single largest residual platform cost
  (−2.3 vs raw). The model wants to quantify; the number gate restrains it.
- **Insight (+0.9), Framing (+0.6), Tradeoff (+0.4):** all model-driven; prompting plateaued these in V3–V6.

## Latency / Cost / Token deltas (estimates from measured latency + public pricing)

|                           | Gemini-2.5-flash | Claude Opus 4.1 |      Ratio |
| ------------------------- | ---------------: | --------------: | ---------: |
| Latency p50 (measured)    |        **12.7s** |         **61s** | ~5× slower |
| Latency p95 (measured)    |             ~28s |            ~79s |            |
| Est. input price /M tok   |           ~$0.30 |            ~$15 |        50× |
| Est. output price /M tok  |           ~$2.50 |            ~$75 |        30× |
| Est. cost / advisor turn¹ |          ~$0.003 |     ~$0.12–0.18 |    ~40–50× |

¹ ~3.5k input + ~0.7k output tokens/turn; Opus higher with longer outputs + the repair-retry. Tokens were not
captured per-turn in the benchmark JSON (the harness records latency + llm_status only); cost is an estimate
from public list pricing and typical turn size, flagged as such. **Conclusion: Opus delivers +0.64 quality at
~5× latency and ~40–50× cost — not viable as a blanket interactive model; viable selectively.**

## Where the quality comes from (decomposition)

| Source                      | Contribution to the gap (prod 6.66 → ceiling 8.00) | Evidence                                             |
| --------------------------- | -------------------------------------------------: | ---------------------------------------------------- |
| **Model capability**        |                                   **~48%** (+0.64) | Gemini→Claude, identical pipeline                    |
| **Validator / number gate** |                                   **~50%** (+0.70) | enhanced-only parity (8.08≈8.00); 6 fallbacks        |
| Prompt design               |                                       ~0% residual | V3–V6 already captured prompt gains; enhanced parity |
| Response composition        |                                                ~0% | enhanced parity (structure is neutral/positive)      |
| Compliance (advice scope)   |                                                ~0% | no advice blocks fired on Claude                     |
| Architecture (LIOS absence) |                                                ~0% | not on the critical path (proven)                    |

(Historical note: the V2→V6 climb of **+0.88** _was_ prompt/mechanism — exposing reasoning, advice, grounded
math, graceful degradation. That work is done and banked. The _residual_ gap is model + number gate.)

## Conclusion

Model capability and the validator's number gate are the two — and only two — material levers left, in roughly
equal measure. Both are addressable **without LIOS**: route the high-stakes advisor work to Claude (selective,
for latency/cost), and refine the number gate to admit document/tool/verified numbers. See
`ROOT_CAUSE_ATTRIBUTION.md`, `NUMBER_GATE_FORENSICS.md`, and `LIOS_MODEL_ROUTING_PROPOSAL.md`.
