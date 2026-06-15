# LIOS Agent Effectiveness Model

> A ruthless per-agent estimate of value vs. latency/token cost vs. quality gain, with a classification
> (Essential / Useful / Optional / Unnecessary) and a merge review. Evidence only — no code. Grounded in
> `LIOS_SIMULATION_FRAMEWORK.md` (1 LLM call ≈ 7–8s / ~3,110 tokens; deterministic ≈ free) and the
> simulation results (`DECISION_/RECOMMENDATION_/ONBOARDING_QUALITY_EVALUATION.md`, `COST_/LATENCY_SIMULATION.md`).

> The governing fact: **an agent that is deterministic or adds no LLM call is nearly free; an agent that adds
> a serial LLM call costs ~7–8s and ~3k tokens.** "More agents" is not better — it is slower and costlier,
> and only justified by a _proven_ quality gain. Coverage is unmeasured, so most LLM-fan-out gains are
> **unproven** and scored accordingly.

---

## 1. Scoring key

- **Value** = how much it contributes to a trustworthy, useful answer.
- **Latency cost / Token cost** = added LLM calls (0 = deterministic/free).
- **Quality gain** = expected improvement over today, with `(proven)` or `(unproven)`.
- **Class:** Essential (build) · Useful (build, cheap/proven) · Optional (defer; value unproven vs real cost)
  · Unnecessary (do not build as a separate LLM agent; merge or it already exists deterministically).

## 2. The model (per agent)

| Agent                                                                                 | Value             | Latency cost            | Token cost   | Quality gain                                                                   | Class                                                       | Note                                                               |
| ------------------------------------------------------------------------------------- | ----------------- | ----------------------- | ------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| **Orchestrator**                                                                      | very high         | +0 (deterministic)      | ~0           | enables everything (proven need)                                               | **Essential**                                               | thin router; mostly exists                                         |
| **Memory/Context**                                                                    | very high         | +0                      | ~0           | the grounding (proven)                                                         | **Essential**                                               | LIVE (`AdvisorContextBuilder`)                                     |
| **Compliance (deterministic)**                                                        | very high         | +0                      | 0            | the trust spine — 0 violations (proven)                                        | **Essential**                                               | LIVE (`advisor_validator`)                                         |
| **Relationship Manager**                                                              | very high         | +0                      | 0            | the safe floor + persistence (proven)                                          | **Essential**                                               | LIVE; the only conversational writer                               |
| **Response Composer**                                                                 | high              | +0                      | 0            | renders validated output (proven)                                              | **Essential**                                               | LIVE (`_compose`)                                                  |
| **Audit/Observability**                                                               | high              | +0                      | 0            | "why did it do that" (proven)                                                  | **Essential**                                               | LIVE; extend events                                                |
| **Advisor (LLM)**                                                                     | very high         | +1                      | ~3k          | the product itself (proven)                                                    | **Essential**                                               | LIVE; this is the 1 call we already pay for                        |
| **Tool Execution**                                                                    | very high         | +0 (deterministic)      | 0            | exact math + traces (proven)                                                   | **Essential**                                               | LIVE engines (`tools.py`, `scenario_compare`)                      |
| **Recommendation writer**                                                             | very high         | +0                      | 0            | evidence-or-nothing (proven)                                                   | **Essential**                                               | LIVE `RecommendationOS`; as a _deterministic writer_               |
| **Intent detection**                                                                  | high              | +0–1 (sample/cheap)     | small        | correct routing (proven-ish)                                                   | **Useful**                                                  | can use a cheap model / be sampled                                 |
| **Agent selection**                                                                   | high              | +0                      | 0            | correct routing (proven)                                                       | **Useful**                                                  | deterministic rules                                                |
| **Prompt composition**                                                                | high              | +0                      | 0            | consistency/quality of the existing call (proven)                              | **Useful**                                                  | factors today's prompt; free                                       |
| **Missing Data**                                                                      | high              | +0 (fold into one call) | ~0           | ranked gaps drive the next question (med, proven-ish)                          | **Useful**                                                  | mostly LIVE (`discovery_coverage`); merge — see H1                 |
| **GraphRAG (retrieval)**                                                              | high              | +0                      | 0            | citation contract (proven)                                                     | **Useful**                                                  | LIVE retrieval; keep read-only                                     |
| **Critic (high-stakes only)**                                                         | medium-high       | +1 (≤~15% of turns)     | ~3k on those | adversarial safety on the few risky turns (med)                                | **Useful**                                                  | build, but high-stakes-only (option B)                             |
| **Decision reasoning (collapsed)**                                                    | high              | **+1** (collapsed)      | ~3k          | structured tradeoffs on multi-domain decisions (med, partly unproven)          | **Useful (merged)**                                         | see H2 — one call, not four                                        |
| **Goal Discovery (separate LLM agent)**                                               | medium            | +1                      | ~3k          | candidate goals (LIVE deterministically)                                       | **Unnecessary (merge)**                                     | H1 → Discovery Analyst                                             |
| **Goal Conflict (separate LLM agent)**                                                | medium            | +1                      | ~3k          | tradeoff surfacing (real but mergeable)                                        | **Unnecessary (merge)**                                     | H1 → Discovery Analyst                                             |
| **Per-domain LLM agents** (Finance/Family/Career/Education/Health)                    | low–med           | **+1 each**             | ~3k each     | "deeper" reasoning (**unproven**; engines already summarize deterministically) | **Optional → keep deterministic (H3)**                      | the biggest cost for the least proven gain                         |
| **Decision Scientist / Scenario / Tradeoff / Decision Explanation (as 4 LLM agents)** | medium            | **+4 serial**           | ~12k         | the serial-tail latency killer                                                 | **Unnecessary (merge → 1)**                                 | H2 collapses to one Decision Engine call + N deterministic tools   |
| **Recommendation (as a separate LLM agent)**                                          | low               | +1                      | ~3k          | none over RecommendationOS (the guard is the quality)                          | **Unnecessary**                                             | mint deterministically; LLM only narrates within the composed call |
| **Life Model (as an LLM agent)**                                                      | medium            | +0 if deterministic     | 0            | aggregation (proven)                                                           | **Essential as deterministic; Unnecessary as an LLM agent** | LIVE `MyLifeService`; don't add an LLM call                        |
| **Onboarding (as a separate agent)**                                                  | high              | +0 over advisor         | —            | it IS the advisor specialized                                                  | **Useful as an advisor variant**                            | not a separate LLM agent                                           |
| **Document Intelligence**                                                             | high (data layer) | +0 to the turn          | —            | acquisition (proven)                                                           | **Essential, but offline**                                  | runs at upload, not in the turn — out of the latency path          |
| **Compliance LLM-assist**                                                             | low (today)       | +1                      | ~3k          | higher-order checks (the det gate already = 0 violations)                      | **Optional → defer (H5)**                                   | revisit only if the det gate proves insufficient                   |

## 3. The classification, summarized

- **Essential (build / already live):** Orchestrator, Memory/Context, Compliance (deterministic), Relationship
  Manager, Response Composer, Audit, Advisor, Tool Execution, Recommendation writer, Document Intelligence
  (offline). **Most of these already exist.**
- **Useful (build — cheap or proven):** Intent detection, Agent selection, Prompt composition, Missing Data,
  GraphRAG retrieval, Critic (high-stakes-only), a single collapsed Decision-reasoning agent.
- **Optional (defer — value unproven vs real cost):** per-domain LLM agents (keep domains deterministic),
  Compliance LLM-assist.
- **Unnecessary as separate LLM agents (merge / already deterministic):** Goal Discovery, Goal Conflict
  (→ merge with Missing Data), the 4 decision sub-agents (→ one Decision Engine), a separate Recommendation
  LLM agent (RecommendationOS), a Life Model LLM agent (it's deterministic aggregation).

## 4. Merge review (the simplification — confirmed by the sims)

| Merge  | From → To                                                                                                                  | Saves                                                                                           | Evidence                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **H1** | Goal Discovery + Goal Conflict + Missing Data → **Discovery Analyst** (1 call)                                             | 3 calls → 1 (~14–16s, ~6k tokens)                                                               | onboarding eval: H1 holds; pieces already deterministic                      |
| **H2** | Decision Scientist + Scenario + Tradeoff + Decision Explanation → **Decision Engine** (1 LLM call + N deterministic tools) | **4 serial calls → 1** (the biggest latency mover: complex 68s → ~35s, full collapse → ~15–24s) | latency sim: the serial tail IS the gap                                      |
| **H3** | Per-domain LLM agents → **deterministic domain summaries feeding one reasoning call**                                      | +1 call per domain → 0                                                                          | recommendation eval: content quality is the deterministic guard, not the LLM |
| **H4** | Critic every-turn → **high-stakes-only**                                                                                   | a full call off ~80–90% of turns                                                                | critic runtime analysis                                                      |
| **H5** | Compliance LLM-assist → **deferred**                                                                                       | +1 call avoided                                                                                 | det gate already 0 violations                                                |

Applying H1–H5 turns a "complex" turn from **~6–10 LLM calls** into **~2–3** — i.e. close to today's single
call plus the decision reasoning — which is the difference between economically/operationally viable and not.

## 5. The ruthless conclusion

The **Essential** set is ~90% already built (the deterministic spine + the one advisor call). The genuine
_new_ value of LIOS concentrates in cheap additions (intent routing, prompt composition, ranked missing
data, a single decision-reasoning step over the existing tools, and a high-stakes Critic). The **expensive**
parts of the design — per-domain LLM agents and the 4-call decision pipeline — are simultaneously the
**least proven** (coverage unmeasured) and the **most costly** (latency + budget). Build the cheap value;
merge or defer the expensive, unproven fan-out. This is the input to `LIOS_BUILD_DECISION.md`.
