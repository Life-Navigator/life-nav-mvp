# LIOS Simulation & Evaluation Framework

> Phase 5 — **evaluation/simulation only.** No code, no orchestration, no deploy, no Vertex, no Claude, no
> beta change. The goal is evidence to decide whether LIOS should be built **as designed, simplified,
> partially, or delayed**. Every number is grounded in measured reality or an explicitly-stated assumption —
> no idealized performance.

Companions: `AGENT_EFFECTIVENESS_MODEL.md`, `DECISION_QUALITY_EVALUATION.md`,
`RECOMMENDATION_QUALITY_EVALUATION.md`, `ONBOARDING_QUALITY_EVALUATION.md`, `COST_SIMULATION.md`,
`LATENCY_SIMULATION.md`, `LIOS_VS_CURRENT_ADVISOR.md`, `LIOS_RISK_ANALYSIS.md`, `LIOS_BUILD_DECISION.md`.

---

## 1. The grounded baseline (measured this program — use these everywhere)

| Quantity                                       | Value                                           | Source                              |
| ---------------------------------------------- | ----------------------------------------------- | ----------------------------------- |
| Single advisor turn latency                    | **avg ~9–10s, p50 ~9.2s, p95 ~13–16s**          | live eval (`advisor_turns`/metrics) |
| `llm_generate` share of a turn                 | **~76%**                                        | parsed `stages_ms`                  |
| Tokens per turn                                | **~3,110 (max ~3,800)**                         | live telemetry                      |
| Fallback rate (post-fix)                       | **0%**                                          | eval round 5                        |
| Trust violations                               | **0**                                           | all eval rounds                     |
| Decision evasiveness                           | **~19% vision-deflection** (down from majority) | decisions probe                     |
| Coverage (data-rich quality)                   | **UNMEASURED**                                  | only fresh-user/empty-state tested  |
| Model                                          | gemini-2.5-flash, AI Studio, Fly-only           | `config.py:26`                      |
| Cost ceiling                                   | **~$4/day** Gemini cap + prepay-credit posture  | ops                                 |
| Complex query cost (projected)                 | **~10–30× a simple query**                      | `COST_MODEL.md`                     |
| Complex query latency (projected, unmitigated) | **~40–55s avg / 60–90s p95**                    | `LATENCY_MODEL.md`                  |

> The single most important measured fact: **one LLM call ≈ 7–8s and ≈ 3k tokens.** Every LIOS design choice
> that adds an LLM call adds ~7–8s and ~3k tokens. This is the unit of all simulation here.

## 2. The simulation unit: "LLM-call count"

Because latency and cost are dominated by the model call, we simulate everything in **LLM-calls per turn**:

- latency ≈ (parallel LLM stages: max over the group) + (serial LLM stages: sum) + ~2–3s deterministic overhead;
- cost ≈ (LLM-calls) × ~3k tokens × price/token (deterministic agents are ~free).

This makes the design's economics legible: **the architecture's viability is a function of how many serial
LLM calls a complex turn requires.** Fewer serial LLM calls = faster + cheaper, almost linearly.

## 3. What LIOS actually adds (and where the cost lives)

| LIOS addition                                               | LLM-calls added             | Deterministic?                      | Where the value claim is                 |
| ----------------------------------------------------------- | --------------------------- | ----------------------------------- | ---------------------------------------- |
| Intent detection                                            | +0–1 (can be cheap/sampled) | classifier + det fallback           | routing correctness                      |
| Agent selection                                             | 0                           | deterministic rules                 | routing correctness                      |
| Prompt composition                                          | 0                           | deterministic                       | consistency/quality of the existing call |
| Per-domain LLM agents (Finance/Family/…)                    | +1 **each**                 | no                                  | "deeper" domain reasoning (unproven)     |
| Decision pipeline (Scientist→Scenario→Tradeoff→Explanation) | **+4 serial**               | no (math is deterministic)          | structured decision reasoning            |
| Recommendation Agent                                        | +0–1                        | RecommendationOS is deterministic   | already evidence-or-nothing today        |
| Critic                                                      | +1 (high-stakes only)       | no                                  | adversarial safety                       |
| Compliance LLM-assist                                       | +1 (optional)               | deterministic gate is authoritative | higher-order checks                      |

**Observation that drives the whole analysis:** the design's most expensive parts (per-domain LLM agents +
the 4-call decision pipeline) are exactly the parts whose quality gain is **unproven** (coverage unmeasured),
while the cheap parts (intent routing, prompt composition, deterministic tools/recommendations) carry most of
the defensible value. This is the tension the build decision must resolve.

## 4. Merge hypotheses to test (do not assume more agents = better)

| Hypothesis                                                                                                                                                | Rationale                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **H1:** Goal Discovery + Goal Conflict + Missing Data → one "Discovery Analyst"                                                                           | all three operate on the same discovery context in one reasoning step; 3 calls → 1                        |
| **H2:** Decision Scientist + Scenario + Tradeoff + Decision Explanation → one "Decision Engine" agent that calls the deterministic tools and reasons once | collapses the **4-serial-call tail** (the #1 latency killer) into 1 LLM call + N deterministic tool calls |
| **H3:** Per-domain LLM agents → keep domains DETERMINISTIC (the live summary services) and feed their summaries into ONE reasoning call                   | avoids +1 LLM call per domain for unproven gain                                                           |
| **H4:** Critic only on high-stakes                                                                                                                        | already the recommendation                                                                                |
| **H5:** Compliance LLM-assist deferred                                                                                                                    | the deterministic gate already delivers 0 trust violations                                                |

If H1–H3 hold, a "complex" query drops from ~6–10 LLM calls to **~2–3**, turning ~40–90s into ~15–25s and
cutting cost ~3–4×. The simulations test exactly this.

## 5. Evaluation method (grounded, honest)

- **Decision quality:** simulate 100 canonical decisions; for each, compare current-advisor path vs LIOS path
  on LLM-calls, tools, graph use, and _expected_ quality gain (labeled, with a stated basis — never invented
  metrics). Subjective quality is a reasoned estimate, flagged as such, not a fabricated score.
- **Recommendation quality:** reason from the live RecommendationOS (evidence-or-nothing) — does multi-agent
  change _what_ gets recommended, or only _how it's narrated_?
- **Onboarding quality:** reason about goal/constraint/tradeoff/family capture vs today's discovery.
- **Cost/latency:** the LLM-call model above, across 20/100/1k/10k users.
- **No fabricated wins:** where we cannot measure (coverage), we say "unproven," not "improved."

## 6. The decision this evidence must support

After the simulations, `LIOS_BUILD_DECISION.md` chooses A (as designed) / B (simplified) / C (selected
portions) / D (delay), and answers the final question: _the smallest LIOS that delivers 80% of the value at
20% of the complexity._ The framework's bias, stated up front and to be tested: **the cheap, deterministic-
adjacent additions are likely most of the value; the expensive LLM fan-out is likely most of the complexity
and the unproven part.**
