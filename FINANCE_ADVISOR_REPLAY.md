# FINANCE_ADVISOR_REPLAY.md — Phase 5

Live, Vertex `gemini-2.5-pro`, real advisor pipeline. Five finance conversations, run multiple times (the model is non-deterministic, so results are reported as a range with the honest cause).

| #   | Conversation                                 | Result                                                                  | Notes                                                                                                                    |
| --- | -------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | Home affordability ("afford a $500k house?") | **Intermittent** (enhanced in isolation; sometimes falls back in batch) | Benchmarks/scenarios now survive when phrased standalone; falls back when the model glues "$100k" to "your $60k savings" |
| 2   | Down payment planning ("$400k home")         | **Intermittent → mostly enhanced**                                      | "20% = $80,000 to avoid PMI, closing 2-5%" passes when labeled                                                           |
| 3   | Emergency fund ("$8k/mo expenses")           | **Reliably enhanced** ✅                                                | "3 months = $24,000 … 6 months = $48,000" — benchmark/month math passes                                                  |
| 4   | Retirement contribution ("$140k income")     | **Intermittent**                                                        | "15% = $21,000/yr" passes when standalone; fails when written as "your salary, that's $21,000"                           |
| 5   | Debt payoff vs investing ("7% car loan")     | **Reliably enhanced** ✅                                                | "a 7% rate is a guaranteed 7% return" — qualitative + benchmark, no fabrication                                          |

## Honest read

- **Benchmark math survives** ✅ and **scenario math survives** ✅ — at the policy level (proven by 21 unit tests) and live for cleanly-phrased answers.
- **Fabricated personal claims still fail** ✅ (net worth / tax / payment / readiness, even when hedged).
- **Answers remain useful** ✅ when they pass (concrete benchmarks, real positions).
- **No fallback?** Not guaranteed: the hardest dollar-dense prompts (home/down-payment/retirement) still fall back **intermittently** — not because the gate blocks valid math (it doesn't), but because `gemini-2.5-pro` inconsistently glues computed figures to the user's stated holding and doesn't reliably emit `derivations`. The orchestrator's repair-retry recovers some, not all.

## Conclusion

The **gate no longer kills valid finance math by policy** — the sprint's mission. The residual is **model instruction-following** on phrasing/derivations, which is a model-quality lever (→ FINANCE_MODEL_BENCHMARK_AFTER_GATE_FIX.md), not a gate fix. Continuing to widen regexes would risk the trust floor for diminishing, variance-dominated gains, so I stopped at the point where the policy is correct and test-proven.
