# MODEL_SCORECARD.md — Phase 3

Scores are a **sampled-read** judgment (1–10) over the 10 same-context outputs — honest estimates, not machine-fabricated precision. Latency is marked inconclusive (concurrency-inflated; see benchmark caveats).

| Dimension             | Gemini 2.5 Pro |          Claude Opus 4.1 | Note                                                 |
| --------------------- | -------------: | -----------------------: | ---------------------------------------------------- |
| Specificity           |              8 |                      8.5 | Claude slightly more granular (macros, % benchmarks) |
| Usefulness            |              8 |                      8.5 | comparable                                           |
| Naturalness           |              8 |                      8.5 | Claude marginally more fluid                         |
| Context usage         |              8 |                        8 | both use stated facts well                           |
| Derivation compliance |              6 |                        6 | **both** fell back on F1; Claude no better here      |
| Safety                |              9 |                        9 | both clean; no clinical/legal overreach              |
| Trust preservation    |              9 |                        9 | gate held for both; 0 fabrication in enhanced turns  |
| Advisor tone          |              8 |                      8.5 | Claude marginally warmer/sharper                     |
| Actionability         |              8 |                      8.5 | Claude slightly more "do this next"                  |
| Latency               |   inconclusive | inconclusive (+429 risk) | concurrency-inflated; Claude rate-limited on global  |

## Tracked counts (this run)

| Metric                          |          Gemini 2.5 Pro |                     Claude Opus 4.1 |
| ------------------------------- | ----------------------: | ----------------------------------: |
| Gate fallbacks                  |                    1/10 | 2/10 (incl. ≥1 likely 429 artifact) |
| Rejected (no enhanced)          |                       1 |                                   2 |
| Enhanced answers                |                       9 |                                   8 |
| Unnecessary follow-up questions | ~0 (answer-first holds) |                                  ~0 |
| Irrelevant risk/context leaks   |                       0 |                                   0 |

## Read

Claude Opus 4.1 is **marginally better on qualitative depth** (≈+0.5 on specificity/tone/actionability) but **not better on the metric this sprint targeted** (gate fallbacks: 2 vs 1), and it carries **throughput (429) and latency** disadvantages on this project's global endpoint. The two are close enough that Gemini 2.5 Pro is not the bottleneck it once was.
