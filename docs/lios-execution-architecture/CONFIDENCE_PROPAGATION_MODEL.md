# LIOS Confidence Propagation Model

> **Design/spec only.** No code, no Gemini wiring, no runtime, no Vertex, no beta change. This is the
> deterministic aggregation contract a future orchestration layer will implement.
> Derived from `docs/lios-agent-specifications/AGENT_CONFIDENCE_MODEL.md` (the 5-component formula),
> `docs/lios-agent-specifications/DECISION_SCIENTIST_AGENT.md`,
> `docs/lios-agent-specifications/GOAL_CONFLICT_AGENT.md`,
> `docs/lios-agent-specifications/GRAPHRAG_AGENT.md`, `RELATIONSHIP_LIFECYCLE.md`,
> `ORCHESTRATION_ENGINE.md`, `EXECUTION_ARCHITECTURE.md`.

**Confidence is never vibes.** Every confidence at every level carries its **components + weights +
explanation**; a bare score is invalid and Compliance rejects it (`AGENT_CONFIDENCE_MODEL.md`). Aggregation
is **deterministic** — fixed math the Orchestrator computes, not "the model's gut feel."

---

## 1. The propagation tree (low → high)

```
 facts (provenance ladder) ─┐
 cited edges (edge_conf) ───┼─▶ [AGENT confidence]  (5-component: DC EC TA GC PQ)
 tool results / similarity ─┘        │
                                     ├─▶ [DOMAIN confidence]   (agent aggregates its sub-findings)
                                     │
   option models + inputs ──────────┼─▶ [DECISION confidence] (Decision Scientist)
                                     │
   evidence × provenance × tool ────┼─▶ [RECOMMENDATION confidence]
                                     │
                                     ▼
            parallel contributing agents ─▶ [FINAL RESPONSE confidence]
                 (min for conjunctive · weighted-mean for aggregate ·
                  conflict down-weights · Critic refutation lowers)
                                     │
                              thresholds gate:
                  success ≥0.75 · critic-review <0.85 or high-risk · response floor
```

Each level reuses the **same 5 components** where they apply; higher levels add deterministic
**combination rules** over the level below.

---

## 2. AGENT confidence (the 5-component model — the base)

The single formula every agent uses (`AGENT_CONFIDENCE_MODEL.md` §2):

```
confidence = wDC·DC + wEC·EC + wTA·TA + wGC·GC + wPQ·PQ
```

| Component | Meaning                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------- |
| DC        | fraction of required inputs present and fresh                                                   |
| EC        | fraction of claims backed by evidence/citation                                                  |
| TA        | required tools available AND returned a result (1 if none needed)                               |
| GC        | mean confidence of cited graph edges (1 if no graph claim; **N/A** if none — renormalize)       |
| PQ        | provenance-weighted quality of facts used (ladder: user_confirmed 1.00 … advisor_inferred 0.20) |

Default weights wDC .25 / wEC .25 / wPQ .20 / wTA .15 / wGC .15 (each spec may override and MUST state
them). **N/A component ⇒ drop it and renormalize the rest to sum 1.0** (mark `"n/a"`, never 0 — a 0 would
unfairly penalize). Every agent attaches the full confidence object: `score, band, components, weights,
na_components, explanation`. No `success` below 0.75.

---

## 3. DOMAIN confidence (a domain agent over its sub-findings)

When a domain agent (Finance/Family/Career/…) computes several sub-findings, its domain confidence is the
agent confidence whose components are **aggregated over the sub-findings**, then run through the same
formula:

```
DC_domain  = mean(DC of each sub-finding)            # input coverage across findings
EC_domain  = (# claims backed by evidence) / (# claims)   # fraction, conjunctive in spirit
TA_domain  = min(TA over findings that needed tools)  # a missing tool result caps the domain
GC_domain  = mean(edge_confidence of cited edges)     # N/A if the domain makes no graph claim
PQ_domain  = mean(provenance weight over all facts used)
confidence_domain = renormalize(wDC·DC + wEC·EC + wTA·TA + wGC·GC + wPQ·PQ)
```

Rule of thumb: **coverage components average** (DC, PQ, GC), **gating components take the floor** (TA, and
EC behaves conjunctively — one unevidenced claim drags EC down and, by invariant 4, that claim must not be
asserted at all). A domain agent may not return `success` below 0.75; below that it returns `needs_data`
with ranked gaps.

---

## 4. DECISION confidence (Decision Scientist)

Decision Scientist **frames, never decides**. Its confidence is the global formula with framing weights
(`DECISION_SCIENTIST_AGENT.md` §10), where **inputs completeness dominates**:

```
confidence_decision = renormalize(0.35·DC + 0.20·EC + 0.20·GC + 0.15·PQ + 0.10·TA)
```

- DC = (required_inputs present) / (required_inputs total) — a frame is only as good as its inputs;
  decisive missing inputs dominate. Below 0.40 ⇒ `needs_data` with ranked `missing_inputs`.
- GC = mean cited-edge confidence for the cross-domain links the frame asserts (N/A if none; a cross-domain
  relevance claim **requires** a cited edge — citation contract).
- A decision is **"modelable"** only when DC reports required-inputs present; the Orchestrator never forces
  a low-confidence decision through (`ORCHESTRATION_ENGINE.md` §7).

This is a confidence in the _frame_, not in any option being "best" — the agent never ranks an answer.

---

## 5. RECOMMENDATION confidence (evidence strength × provenance × tool-result quality)

A recommendation is **evidence-or-nothing** — none is minted without ≥1 evidenced finding
(`ORCHESTRATION_ENGINE.md` §3). Its confidence multiplies the three things that make a rec trustworthy:

```
confidence_rec = EC_rec · PQ_rec · TQ_rec
  EC_rec = evidence strength   = fraction of the rec's claims with cited backing (citation/edge coverage)
  PQ_rec = provenance quality  = mean provenance-ladder weight of the facts the rec rests on
  TQ_rec = tool-result quality = 1 if no tool needed; else (tool available AND returned a usable result)
```

Multiplicative (not additive) on purpose: a rec is only as strong as its **weakest pillar** — perfect
evidence on `advisor_inferred` facts (PQ low) or with a failed calculator (TQ→0) is not a confident rec.
If any pillar drives the product below the success band, the rec is not minted (no low-confidence advice).
The rec carries this object with components + explanation, same contract as every other confidence.

---

## 6. FINAL RESPONSE confidence (aggregation across contributing agents)

The Orchestrator (deterministic) combines the confidences of the agents that actually contributed to the
user-facing answer. The combination rule depends on the **claim shape**:

| Claim shape                                                                    | Rule                                                                                               | Why                                                                           |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Conjunctive** ("A _and_ B both hold", a chain where every link must be true) | `min(conf_i)` over contributors                                                                    | the weakest link bounds a conjunction                                         |
| **Aggregate view** (a synthesized overview blending several domains)           | weighted mean `Σ wᵢ·confᵢ / Σ wᵢ`, weight wᵢ = each agent's evidence coverage / contribution share | an overview is an average of its parts, weighted by how grounded each part is |
| **Single-source claim**                                                        | that agent's confidence verbatim                                                                   | no combination needed                                                         |

Then apply the two deterministic **adjustments**:

- **Conflict down-weight.** If Conflict Resolution (Stage [6]) finds contributors disagree, multiply the
  combined confidence by a conflict penalty `(1 − κ)`, κ ∝ conflict severity. An unresolved conflict is
  surfaced as an open tradeoff (both sides' evidence) at a deliberately lowered confidence — the system
  **models, never decides** (see `CONFLICT_RESOLUTION_MODEL.md`).
- **Critic refutation.** If the Critic (Stage [8]) refutes a high-stakes claim, that claim is **dropped**
  and the response confidence is recomputed without it (lower). A partial refutation lowers EC for the
  affected claim, which lowers the combined score.

The final response confidence carries the union of contributing components + an explanation naming which
component/agent dragged it (no vibes).

---

## 7. Thresholds (deterministic gates)

From `AGENT_CONFIDENCE_MODEL.md` §3 and `ORCHESTRATION_ENGINE.md` §7:

| Threshold          | Value                                                                                      | Effect                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **Agent success**  | ≥ 0.75                                                                                     | below ⇒ `needs_data`/`needs_confirmation` (0.40–0.75) or `blocked`/`escalated` (<0.40) |
| **Critic review**  | confidence < 0.85 **OR** risk_level ∈ {high, regulated} **OR** decision/cross-domain claim | invoke the Critic before the claim ships                                               |
| **Response floor** | final < 0.5                                                                                | downgrade toward "here's what I'd need" rather than an assertion                       |

A decision is only modelable when required-inputs are present (DC); the Orchestrator never pushes a
low-confidence decision through as an answer.

---

## 8. Worked examples

- **Aggregate overview, two grounded domains.** Finance conf 0.91 (EC .9), Family conf 0.80 (EC .8).
  Weighted mean = (0.9·0.91 + 0.8·0.80)/(0.9+0.8) = **0.86**. No conflict, no critic flag ⇒ ships ≥0.75.
- **Conjunctive cross-domain claim.** "Buying the house _and_ keeping your runway both hold" — Finance 0.88,
  Decision frame 0.72. `min` = **0.72** → below 0.85 ⇒ Critic invoked; if Critic confirms, ships; if
  refuted, claim dropped and confidence recomputed.
- **Conflict present.** Above conjunctive claim with a Finance↔Family conflict, κ=0.3 ⇒ 0.72·0.7 = **0.50**
  → response floor: surface as an open tradeoff, not an assertion.

---

## 9. Invariants

1. Every confidence, at every level, carries components + weights + explanation. No vibes; no bare score.
2. Aggregation is deterministic math (min / weighted-mean / multiply), computed by the Orchestrator.
3. N/A components are dropped and renormalized (marked `n/a`), never scored 0.
4. Conjunctive claims take the `min`; aggregate views take an evidence-weighted mean.
5. Conflict down-weights; an unresolved conflict ⇒ open tradeoff at lowered confidence (model, don't decide).
6. A Critic refutation drops the claim and lowers the response confidence.
7. Thresholds gate deterministically: success ≥0.75; critic-review <0.85 or high-risk; response floor 0.5.
8. EC near 0 with claims present ⇒ those claims are not asserted (evidence-or-nothing).
