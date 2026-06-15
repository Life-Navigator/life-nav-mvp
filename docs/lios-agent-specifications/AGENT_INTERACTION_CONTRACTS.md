# LIOS — Agent Interaction Contracts

> Which agents may communicate, which may not, and the structural rules that keep the multi-agent system
> safe and acyclic. Specification only — no code, no prompts, no runtime. Pairs with
> `AGENT_ESCALATION_MODEL.md`.

---

## 1. The five structural laws

1. **Everything routes through the Orchestrator.** Agents do not call each other directly; they return
   `escalated` and the Orchestrator routes (see `AGENT_ESCALATION_MODEL.md`).
2. **No agent may invoke itself.** No self-loops.
3. **No agent may bypass the Orchestrator** to reach a surface, the database, or Compliance.
4. **No domain/reasoning agent talks to the user.** Only the Response Composer's text (via the Orchestrator)
   reaches the surface, and only after Compliance.
5. **No agent writes to the database** except the approved writers, and only via Tool Execution (see the
   approved-save-path table in `DATA_FLOW_DIAGRAM.md`).

These make the call graph a **DAG with a single entry/exit (the Orchestrator)** — no swarms, no cycles, no
uncontrolled fan-out.

---

## 2. Allowed communication (Orchestrator-mediated)

```
Surfaces            ──▶ Orchestrator ──▶ Surfaces        (only the Orchestrator faces the user)

Orchestrator ──▶ { Relationship Manager, Onboarding, Advisor, Memory, GraphRAG,
                   Life Model, Goal Discovery, Goal Conflict, Missing Data,
                   Finance, Family, Career, Education, Health,
                   Document Intelligence, Decision Scientist, Scenario, Tradeoff,
                   Recommendation, Decision Explanation, Tool Execution,
                   Critic, Compliance, Response Composer, Audit }

# Referrals (expressed as `escalated`, sequenced by the Orchestrator):
Memory          ──▶ GraphRAG, Document Intelligence            (read)
any agent       ──▶ Memory, GraphRAG                           (read context)
any agent       ──▶ Tool Execution                             (deterministic calc / approved write)
Advisor/domain  ──▶ Missing Data                               (find highest-value gap)
Onboarding      ──▶ Goal Discovery ──▶ Goal Conflict
Finance/Family/Career/Education/Health ──▶ Decision Scientist  (cross-domain)
Decision Scientist ──▶ Scenario ──▶ Tradeoff ──▶ Recommendation
Recommendation  ──▶ Critic ──▶ Compliance ──▶ Response Composer
Decision Explanation ──▶ Compliance ──▶ Response Composer
all agents      ──▶ Audit                                      (telemetry, end of turn)
```

---

## 3. Forbidden communication (hard prohibitions)

| Forbidden edge                                                           | Why                                                                    |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Any domain agent → User                                                  | only the Composer (post-Compliance) faces the user                     |
| Advisor / Recommendation / Decision agents → User directly               | must pass Compliance first                                             |
| Any agent → Database (direct)                                            | only approved writers via Tool Execution                               |
| Compliance → Database                                                    | Compliance is a pure gate; it never writes                             |
| Response Composer → Database                                             | it renders; it never persists                                          |
| Recommendation Agent → Database                                          | persistence is RelationshipManager/RecommendationOS via Tool Execution |
| Any agent → Gemini/model directly (outside the gated LLM-agent boundary) | model access is confined to LLM agents on the backend                  |
| Agent → Agent (direct, not via Orchestrator)                             | breaks observability + acyclicity                                      |
| Agent → itself                                                           | no self-invocation                                                     |
| Any agent → another tenant's data                                        | RLS / tenant isolation                                                 |

---

## 4. Communication matrix (who may be routed to whom)

`O` = Orchestrator may route this; `R` = read-only referral; `—` = forbidden. (Rows = caller intent; the
Orchestrator is always the mediator.)

| From \ To          | Memory/GraphRAG | Tool Exec | Missing Data | Decision Sci | Recommendation | Critic | Compliance | Composer | User    | DB  |
| ------------------ | --------------- | --------- | ------------ | ------------ | -------------- | ------ | ---------- | -------- | ------- | --- |
| Advisor            | R               | O         | O            | O            | —              | —      | (via O)    | (via O)  | —       | —   |
| Domain (Fin/Fam/…) | R               | O         | O            | O            | (via Dec)      | —      | (via O)    | —        | —       | —   |
| Decision Scientist | R               | O         | O            | self✗        | O              | —      | (via O)    | —        | —       | —   |
| Recommendation     | R               | O         | —            | —            | self✗          | O      | (via O)    | —        | —       | —   |
| Critic             | R               | —         | —            | —            | —              | self✗  | O          | —        | —       | —   |
| Compliance         | —               | —         | —            | —            | —              | —      | self✗      | O        | —       | —   |
| Composer           | —               | —         | —            | —            | —              | —      | —          | self✗    | (via O) | —   |

(Persistence is never in this matrix as an agent target — it happens only through approved writers in Tool
Execution.)

---

## 5. The canonical pipelines

**Conversation/discovery turn:**
`Orchestrator → RelationshipManager(det) → Memory(+GraphRAG) → Advisor → Compliance → [Critic?] → Response Composer → Audit`

**Domain question:**
`Orchestrator → Memory(+GraphRAG, Doc Intel) → Domain Agent → Tool Execution → Recommendation → Compliance → Response Composer → Audit`

**Decision:**
`Orchestrator → Domain Agent(s) → Decision Scientist → Scenario → Tradeoff → (Recommendation) → Decision Explanation → Compliance → Response Composer → Audit`

Each is a straight DAG; the Orchestrator owns the sequencing and the Audit bookend.

---

## 6. Invariants

1. Single entry/exit: the Orchestrator. No agent faces the user or the DB.
2. Acyclic: no cycles, no self-invocation, hop-bounded chains.
3. Compliance is mandatory and unbypassable before any user-facing text.
4. Persistence only via approved writers in Tool Execution.
5. Reads (Memory/GraphRAG/Doc Intel) are referral-only and read-only.
6. Every routed message is bounded/typed and logged.
