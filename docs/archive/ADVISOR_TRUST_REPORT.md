# Advisor Trust Report

Synthesis of the observability audit + the live evaluation + GraphRAG/recommendation audits. Written from
the perspective of QA lead + CFP/CPA/attorney + compliance + skeptical beta user, on a **real bounded live
sample** (12 personas / 24 advisor turns + adversarial; deterministic criteria decisive, subjective dims
sampled).

## Verdict

**The trust spine is sound. The advisor does not fabricate.** Across every deterministic Success Criterion
— invented goals, risks, opportunities, recommendations, numbers; rejected-goal resurfacing; archetype
leakage; ungrounded retirement risks; provenance — the live advisor **passed**. The remaining issues are
**experience and observability**, not integrity: it is slow, it over-falls-back on the highest-value
questions, and almost none of its behavior is observable in production.

## Top strengths

1. **Zero fabrication, live.** No invented goals/risks/opps/numbers across 24 turns + adversarial.
2. **Honest under-specification.** Decision questions with no data → asks for inputs, never a made-up answer.
3. **Provenance is honest** — records the user's words as `user_stated` rather than inferring.
4. **Rejected goals are terminal** — suppressed end-to-end through the live stack.
5. **Evidence-or-nothing recommendations** — no rec without ≥1 cited evidence statement.
6. **GraphRAG grounding contract** — "no cited edge ⇒ no claimed relationship," validator-enforced.

## Top weaknesses

1. **17% fallback rate, all `more than one question`** — the validator discards the LLM's richer reply on
   the best questions ("How much down payment?", "Can I afford it?") and serves a generic canned prompt.
2. **~9s latency per turn** (p95 11.5s) — every message lags.
3. **Generic fallback copy** — doesn't acknowledge the specific decision asked.
4. **No advisor turn log / telemetry** — the single biggest production risk: we can't see hallucinations,
   fallbacks, validator rejections, or memory failures after the fact, and the advisor is unmetered.

## By failure class

| Class                   | Found?                                                                                   | Detail                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Hallucinations          | **None**                                                                                 | 0 invented goals/risks/opps/numbers in 24 turns + adversarial                                                        |
| Trust violations        | **None**                                                                                 | all deterministic criteria passed                                                                                    |
| Missing provenance      | **Partial (data-model)**                                                                 | per-turn provenance derived in API, not stored; `public.goals`/`life.risks/opps/deps` lack source/confidence columns |
| Memory failures         | **None in-session**; cross-session **untested** (no turn log to verify long-term recall) |
| Tradeoff failures       | **None observed** — debt-vs-save framed correctly                                        |
| Recommendation failures | **None** — empty-when-no-data is correct; _coverage_ untested (no data-rich persona)     |
| GraphRAG failures       | **None** — abstain-when-no-edges correct; _retrieval logging_ missing                    |

## Most important fixes (summary — see TOP_20_FIXES.md)

1. **Persist `advisor.turns`** (unblocks all production observability + post-hoc trust review).
2. **Fix the fallback-on-high-value-questions problem** — either trim the LLM to one question (repair, not
   reject) or tighten the prompt so it asks exactly one; and make the fallback copy address the question.
3. **Cut advisor latency** (stream, or parallelize the `my_life` aggregation; cache snapshot).
4. **Wire CostMeter + latency into the advisor turn.**
5. **Make provenance first-class** (columns on the remaining tables) rather than API-derived.

## Prioritized roadmap

- **P0 (before beta):** advisor turn log + fallback-quality fix (the two things beta users will hit
  immediately — lag-then-generic-answer on their hardest questions).
- **P1:** latency reduction; CostMeter/latency wiring; data-rich eval personas (measure rec coverage);
  seeded-graph persona in the standing eval (exercise grounded citations).
- **P2:** first-class provenance columns + `<ProvenanceBadge>` on every dashboard item; per-turn GraphRAG
  retrieval log; request correlation ids.

## Beta-readiness call

**Trust: ready.** The platform does what it claims — it does not confuse assumptions with facts and it does
not invent. **Experience + observability: not yet** — ship the turn log and the fallback-quality fix first,
or the 20 beta users will experience a slow advisor that gives generic answers to their most important
questions, and we will have no way to see it happening.
