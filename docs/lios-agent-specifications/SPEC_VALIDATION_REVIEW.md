# LIOS — Agent Specification Validation Review

> Cross-checks the 25 agent specifications + 5 cross-cutting contracts for overlaps, ownership conflicts,
> circular dependencies, undefined escalation/confidence, and the anti-fabrication invariants. Documents all
> gaps found. Specification review only — no code, no prompts, no runtime.

---

## 1. Validation checklist (the sprint's requirements)

| Requirement                                       | Result  | Evidence                                                                                                            |
| ------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| No responsibility overlaps                        | ✅ pass | each spec §2 has a distinct "Owns" set; no two agents own the same capability                                       |
| No ownership conflicts                            | ✅ pass | recommendation-creation owned only by Recommendation Agent; DB-writes only by Tool Execution; edge-creation by none |
| No circular dependencies                          | ✅ pass | `AGENT_INTERACTION_CONTRACTS.md` defines a DAG; no self-invocation; hop-bounded; all routing via Orchestrator       |
| No undefined escalation paths                     | ✅ pass | every escalation target in every §11 is a real agent in the roster (verified below)                                 |
| No undefined confidence calculations              | ✅ pass | every spec §10 references `AGENT_CONFIDENCE_MODEL.md` with explicit weights or a stated N/A                         |
| No agent creates recommendations without evidence | ✅ pass | only Recommendation Agent mints, via RecommendationOS evidence-or-nothing                                           |
| No agent creates risks without evidence           | ✅ pass | risks are recommendation-subtypes; same evidence-or-nothing chokepoint                                              |
| No agent creates graph edges without validation   | ✅ pass | no agent owns edge creation; projection-from-committed-truth is a separate sync; GraphRAG is read-only              |
| No agent persists data directly                   | ✅ pass | only Tool Execution writes (with RelationshipManager/RecommendationOS as the approved writers it runs)              |

**Overall: the specification layer is internally consistent and the trust invariants hold across all agents.**

---

## 2. Ownership matrix (no two agents own the same thing)

| Capability                                                 | Sole owner                                     | Everyone else                        |
| ---------------------------------------------------------- | ---------------------------------------------- | ------------------------------------ |
| Routing / sequencing / governed response                   | Orchestrator                                   | escalate to it; never self-route     |
| Conversational turn (reflection + one question, proposals) | Advisor (Onboarding specializes it)            | propose only; never persist          |
| Seed Life Model + onboarding gate                          | Onboarding                                     | —                                    |
| Life Model aggregation (with provenance)                   | Life Model                                     | read it; don't recompute it          |
| Candidate goals                                            | Goal Discovery                                 | confirm via approved writer          |
| Goal-to-goal conflicts/tradeoffs                           | Goal Conflict                                  | cite real edges only                 |
| Ranked missing inputs                                      | Missing Data                                   | consume its list                     |
| Bounded read-only context                                  | Memory                                         | the only context the LLM sees        |
| Real-knowledge retrieval (3-store)                         | GraphRAG                                       | read-only                            |
| Document → cited candidate facts                           | Document Intelligence                          | —                                    |
| Deterministic calc + approved writes                       | Tool Execution                                 | request via it; never write directly |
| Per-turn telemetry                                         | Audit                                          | —                                    |
| Accept/repair/reject verdict                               | Compliance                                     | unbypassable; pure gate              |
| Adversarial high-stakes refutation                         | Critic                                         | judges, never rewrites               |
| Final user-facing text                                     | Response Composer                              | only stage that faces the surface    |
| Domain state + evidenced risks/opps + missing              | Finance / Family / Career / Education / Health | not recommendations, not user text   |
| Decision framing                                           | Decision Scientist                             | models, never decides                |
| Option simulation (with trace)                             | Scenario                                       | numbers from Tool Execution only     |
| Option comparison (not a verdict)                          | Tradeoff                                       | never crowns an option               |
| Recommendation creation (evidence-or-nothing)              | Recommendation                                 | the sole minting authority           |
| Grounded decision narration                                | Decision Explanation                           | never "the answer"                   |

No row has two owners. No capability is unowned.

---

## 3. Escalation graph (acyclic, all targets defined)

Verified that every escalation target named in a spec §11 exists as an agent and that the union forms a DAG
terminating at Response Composer / safe fallback:

```
Onboarding → Goal Discovery → Goal Conflict
Advisor/Domains → Missing Data
Domains (Fin/Fam/Car/Edu/Hea) → Decision Scientist
Decision Scientist → Scenario → Tradeoff → Recommendation → Critic → Compliance → Response Composer
Decision Explanation → Compliance → Response Composer
any agent → Memory / GraphRAG (read) ; any agent → Tool Execution (calc/approved write)
all agents → Audit (telemetry, terminal)
```

No cycle, no self-edge, no orphan target. The Orchestrator mediates and hop-caps every route.

---

## 4. Anti-fabrication invariants — verified across all specs

1. **Numbers:** every domain/decision spec forbids invented numbers and requires the user's own
   (allowed-numbers) or a Tool Execution `calculation_trace`. ✅
2. **Relationships:** every graph-touching spec enforces the citation contract; no agent owns edge creation. ✅
3. **Recommendations/risks:** only Recommendation Agent mints, evidence-or-nothing; domains only _surface_
   evidenced risks/opps. ✅
4. **Persistence:** only Tool Execution writes; the LLM agents force `should_persist=false`. ✅
5. **Confidence:** no spec permits `success` below 0.75; all carry component breakdowns. ✅
6. **Review-before-output:** every user-facing path runs through Compliance before the Response Composer. ✅

---

## 5. Gaps & findings (documented, per the sprint)

These are **specification-level** observations to resolve before/at build time. None breaks consistency.

| #   | Gap / finding                                                                                                                               | Severity | Resolution at build                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| 1   | **Critic is PLANNED, not live** — its spec defines behavior but it doesn't exist yet; high-stakes turns currently rely on Compliance alone. | medium   | build the Critic in the multi-agent phase; until then, mark high-stakes turns and accept Compliance-only. |
| 2   | **Recommendation `missing_inputs` is first-class in the spec but only implicit in today's engine.**                                         | medium   | add the explicit field when wiring RecommendationOS to the spec.                                          |
| 3   | **Provenance columns are spec-required but partly derived in the API today**, not stored on every truth table.                              | medium   | the planned provenance-columns migration (see `TRUTH_AND_PROVENANCE_MODEL.md`).                           |
| 4   | **Coverage is unmeasured** — specs assume data-rich behavior; today's evals only test empty states.                                         | medium   | data-rich + seeded-graph eval personas (see `LIOS_EVALUATION_FRAMEWORK.md`).                              |
| 5   | **Cross-turn context carry** (decision/fact) is named in specs but not built; only same-message context is used today.                      | low      | thread session-stated facts into Memory's bounded context.                                                |
| 6   | **Per-turn retrieval-set logging** (exact node/edge/doc ids used) is specified in Audit but only counts are logged today.                   | low      | extend the turn record.                                                                                   |
| 7   | **Phrasing drift:** "evidence-or-nothing" appears verbatim in 6/25 specs; the _concept_ (evidence required) appears in all relevant specs.  | cosmetic | optional: normalize the phrase in a docs pass.                                                            |
| 8   | **Decision object** is conversational today; specs assume a first-class decision workspace with state.                                      | medium   | decide storage model in the multi-agent phase (see `DECISION_LIFECYCLE.md` open questions).               |
| 9   | **Goal Conflict / Missing Data** are PARTIAL today (logic exists inside other services, not as standalone agents).                          | low      | formalize as agents when orchestration is built.                                                          |

None of these are conflicts or circular dependencies — they are the known "spec ahead of implementation"
deltas that the build phases (Prompt OS → Orchestration → Multi-agent → Vertex/Claude) will close.

---

## 6. Definition-of-done check

A new engineer can now answer, from these specs alone (no implementation code):

- What does every agent do? → each §1–§2.
- What can it access? → §4, §8, §9.
- What can it NOT do? → §3.
- How does it think? → §6.
- How does it compute confidence? → §10 + `AGENT_CONFIDENCE_MODEL.md`.
- When does it escalate? → §11 + `AGENT_ESCALATION_MODEL.md`.
- How do agents communicate? → `AGENT_INTERACTION_CONTRACTS.md`.
- How are recommendations created? → Recommendation Agent (evidence-or-nothing).
- How are risks created? → recommendation-subtype, same chokepoint (`RISK_LIFECYCLE.md`).
- How are facts validated? → Compliance + `FACT_LIFECYCLE.md`.
- How is compliance enforced? → Compliance Agent + `COMPLIANCE_AND_SAFETY_FLOW.md`.

**Verdict: the Agent Specification Layer is complete and internally consistent.** It is ready to be the
foundation for Phase 2 (Prompt OS), Phase 3 (Gemini Orchestration), Phase 4 (Multi-agent execution), and
Phase 5 (Vertex/Claude) — each of which must conform to these contracts.
