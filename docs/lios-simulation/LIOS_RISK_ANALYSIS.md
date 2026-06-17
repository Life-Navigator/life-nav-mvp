# LIOS Risk Analysis

> Technical, product, cost, and operational risks of building LIOS — ranked, grounded, with the mitigation
> each implies. Evidence only — no code. Synthesizes the simulations + the runtime blueprint.

---

## 1. Technical risks

| #   | Risk                                                                                    | Severity     | Grounding                | Mitigation it implies                                               |
| --- | --------------------------------------------------------------------------------------- | ------------ | ------------------------ | ------------------------------------------------------------------- |
| T1  | **Serial decision-tail latency** — 4 chained LLM calls make complex p95 ~68s (p99 ~83s) | **Critical** | latency sim              | collapse to one Decision Engine (H2) — the single biggest mover     |
| T2  | **Per-domain LLM fan-out cost/latency** for unproven gain                               | High         | cost/recommendation sims | keep domains deterministic (H3)                                     |
| T3  | **The Critic does not exist** — a designed safety layer is absent                       | High         | runtime blueprint        | build it high-stakes-only before any high-stakes multi-agent output |
| T4  | **GraphRAG read-path seam** — live reads are Supabase; Neo4j/Qdrant are projection-side | Med          | runtime audit            | decide the execution read source before building GraphRAG runtime   |
| T5  | **Multi-agent risk surface** — more outputs to gate, more places to slip                | Med          | compliance flow          | the deterministic gate stays authoritative on every output          |
| T6  | **No per-turn budget enforcement**                                                      | Med          | cost model               | build a token/call ceiling with degrade-to-single-agent             |
| T7  | **Confidence is uncalibrated**                                                          | Low–Med      | eval framework           | golden sets + calibration before trusting confidence in routing     |

## 2. Product risks

| #   | Risk                                                                           | Severity     | Grounding           | Mitigation                                                                   |
| --- | ------------------------------------------------------------------------------ | ------------ | ------------------- | ---------------------------------------------------------------------------- |
| P1  | **A 40–90s answer is a worse product than a 10s one**                          | **Critical** | latency sim         | LIOS-minimal (~13–24s) + streaming first-token (live)                        |
| P2  | **Unproven value** — coverage unmeasured; multi-agent may not beat the advisor | High         | all quality evals   | measure coverage on data-rich personas BEFORE scaling fan-out                |
| P3  | **Complexity users don't feel** — more machinery, same recommendation content  | Med          | recommendation eval | build only the parts with a felt difference (decision framing, missing-data) |
| P4  | **Advice-boundary slip under composition**                                     | Med          | compliance          | gate every output; keep "frames + refers"                                    |
| P5  | **Trust regression during migration**                                          | Med          | —                   | per-phase eval gate (trust must stay 0); flag-gated                          |

## 3. Cost risks

| #   | Risk                                                | Severity | Grounding  | Mitigation                                                                       |
| --- | --------------------------------------------------- | -------- | ---------- | -------------------------------------------------------------------------------- |
| C1  | **LIOS-full breaches $4/day at ~46–100 users**      | High     | cost sim   | LIOS-minimal (~178–267 users) + per-turn budget                                  |
| C2  | **Complex-query tail** — 10–30× a simple query      | High     | cost model | route most queries to the cheap path; reserve the Decision Engine for the 47/100 |
| C3  | **Pricing is an assumption** from one measured turn | Med      | cost model | re-derive from real `advisor_turn_metrics` before any call-adding phase          |
| C4  | **Runaway uncapped complex turn**                   | Med      | cost model | hard per-turn call/token ceiling                                                 |

## 4. Operational risks

| #   | Risk                                                                                    | Severity      | Grounding           | Mitigation                                                       |
| --- | --------------------------------------------------------------------------------------- | ------------- | ------------------- | ---------------------------------------------------------------- |
| O1  | **Unbuilt runtime** — orchestrator/parallel/critic/decision-pipeline don't exist        | High          | runtime blueprint   | phased, flag-gated build; wrap first                             |
| O2  | **Reversibility** if a phase misbehaves                                                 | — (mitigated) | flag strategy       | `LIOS_ENABLED=false` returns to today's advisor exactly          |
| O3  | **Observability gaps** — retrieval-set logging is counts-only; no per-agent calibration | Med           | observability model | extend the live `advisor_turns` sink before acting on new stages |
| O4  | **Eval gaps** — no golden sets, coverage unmeasured                                     | Med           | eval framework      | build the data-rich + seeded-graph personas first                |
| O5  | **Gemini billing/quota** posture for higher volume                                      | Med           | cost model          | resolve before beta scale                                        |

## 5. The risk-weighted picture

The two **Critical** risks (T1 serial-tail latency, P1 slow product) are _both eliminated by the same move_:
**apply the merge hypotheses (especially H2) — do not build the per-domain LLM fan-out or the 4-call decision
pipeline.** Most High risks (T2, C1, C2, P2) are the _same expensive, unproven fan-out_ viewed through
different lenses. So the risk profile collapses to one decision:

> **Building LIOS-full carries Critical + multiple High risks for unproven gain. Building LIOS-minimal
> removes the Critical risks, halves the High ones, and is reversible.**

The residual risks of LIOS-minimal (T3 Critic, T4 read-seam, T6 budget, P2 unproven coverage) are all
**addressable before they matter** and are gated by flags + per-phase evals.

## 6. The one risk that must be retired first

**P2 / O4 — unproven coverage.** Before building _any_ multi-agent fan-out, measure whether multi-agent
actually produces better guidance than the advisor on data-rich personas. If it doesn't, even LIOS-minimal's
Decision Engine isn't worth it, and the answer is "improve the single advisor." This measurement is cheap
(extend the eval harnesses) and decisive — do it first.
