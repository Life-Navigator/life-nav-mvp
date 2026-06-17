# LIOS Execution Architecture (master)

> **Phase 3 — design/specification only.** No production code, no Gemini wiring, no runtime change, no
> deploy, no Vertex, no beta change. This is the blueprint a future orchestration layer will implement.
> Everything here is derived from the existing LIOS docs; nothing invents a new agent responsibility or lets
> any agent violate its spec or bypass Compliance.

**Source of truth (an execution rule that contradicts these is wrong):** `LIOS_ARCHITECTURE.md`,
`AGENT_INTERACTION_DIAGRAM.md`, `docs/lios-agent-specifications/*` (25 specs + 5 contracts),
`docs/lios-prompt-operating-system/*`.

Companion docs in this directory: `ORCHESTRATION_ENGINE.md`, `AGENT_SELECTION_ENGINE.md`,
`PARALLELIZATION_MODEL.md`, `TOOL_EXECUTION_MODEL.md`, `GRAPHRAG_RETRIEVAL_MODEL.md`,
`CONFIDENCE_PROPAGATION_MODEL.md`, `CONFLICT_RESOLUTION_MODEL.md`, `COMPLIANCE_PIPELINE.md`,
`RESPONSE_ASSEMBLY_MODEL.md`, `EXECUTION_STATE_MACHINE.md`, `WORKFLOW_LIBRARY.md`,
`MULTI_AGENT_EXECUTION_PATTERNS.md`, `OBSERVABILITY_MODEL.md`, `EXECUTION_EVALUATION_FRAMEWORK.md`,
`EXECUTION_READINESS_REVIEW.md`.

---

## 1. What "execution" means in LIOS

Execution is how the Orchestrator turns one request into a governed response by sequencing agents over a
**deterministic DAG** — never a free-for-all agent swarm. The runtime properties LIOS requires:

- **Deterministic-first.** The deterministic turn (Relationship Manager) runs before any LLM agent and is
  the trust floor — a correct, safe response exists even if every LLM fails.
- **Single entry/exit.** The Orchestrator is the only thing the surface talks to; only the Response Composer
  (post-Compliance) produces user-facing text.
- **Acyclic + bounded.** Agents never call each other directly; they return `escalated` and the Orchestrator
  routes. Chains are hop-bounded and terminate.
- **Gated.** No LLM-authored text reaches the user without passing the Compliance gate.
- **Observed.** Every stage emits telemetry sufficient to answer "why did it do that?"

This generalizes the live advisor path (`AdvisorOrchestrator.converse`/`converse_stream`) to all domains and
the decision pipeline.

## 2. The execution lifecycle

Every request flows through these stages. Each stage has: **inputs · outputs · confidence · failure state ·
observability event**. (Stages that don't apply to a given intent are skipped by the selection engine, never
by ad-hoc choice.)

```
User Message
   ↓
[1] Intent Detection          → intent, risk level, domains-implicated
   ↓
[2] Agent Selection           → the agent set + execution order (DAG)
   ↓
[3] Graph Retrieval Plan      → what GraphRAG to fetch (or skip)
   ↓
[4] Tool Plan                 → which deterministic tools to run, in what order
   ↓
[5] Agent Execution           → domain/reasoning agents run (parallel where safe)
   ↓
[6] Conflict Resolution       → reconcile disagreeing agents into framed tradeoffs
   ↓
[7] Recommendation Generation → Recommendation Agent mints evidence-backed recs (if any)
   ↓
[8] Critic Review             → adversarial refutation for high-stakes claims (conditional)
   ↓
[9] Compliance Review         → accept / repair / block (mandatory, unbypassable)
   ↓
[10] Response Assembly        → Response Composer builds the governed user-facing output
   ↓
User
                              (and, in parallel at every stage) → Audit / Observability
```

The **deterministic turn** is executed by the Orchestrator at the very start (before stage 1's LLM work),
so the safe fallback text and persisted outcomes exist independently of stages 1–10.

## 3. Stage contracts (inputs / outputs / confidence / failure / observability)

| #   | Stage                     | Inputs                                        | Outputs                                                  | Confidence                             | Failure state                                          | Observability event          |
| --- | ------------------------- | --------------------------------------------- | -------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------ | ---------------------------- |
| 0   | Deterministic turn        | message, user ctx (JWT)                       | safe text, persisted confirmable outcomes, context panel | n/a (certain)                          | never fails the user (this _is_ the floor)             | `det_turn`                   |
| 1   | Intent Detection          | message, conversation/session, recent context | `{intent, risk_level, domains[]}`                        | intent-confidence                      | ambiguous → default to discovery (safest)              | `intent`                     |
| 2   | Agent Selection           | intent + domains + risk                       | agent set + DAG (order, parallel groups)                 | n/a (deterministic rules)              | no rule matches → discovery path                       | `route_plan`                 |
| 3   | Graph Retrieval Plan      | selected agents, intent                       | edges/evidence to fetch, or skip                         | edge confidences                       | empty graph → abstain from relationship claims         | `graph_plan`                 |
| 4   | Tool Plan                 | selected agents, decision frame               | ordered tool calls                                       | n/a                                    | tool unavailable → `blocked` for that branch           | `tool_plan`                  |
| 5   | Agent Execution           | bounded context (Memory), tools, graph        | per-agent envelopes (status+confidence+payload)          | per-agent                              | `needs_data`/`blocked`/`escalated` per agent           | `agent_exec` (one per agent) |
| 6   | Conflict Resolution       | agent outputs                                 | framed tradeoffs + reconciled view                       | aggregated (down-weighted on conflict) | unresolvable → surface as open tradeoff (not an error) | `conflict`                   |
| 7   | Recommendation Generation | evidenced findings                            | recommendations (evidence-or-nothing)                    | rec confidence                         | no evidence → none minted                              | `recommendation`             |
| 8   | Critic Review             | high-stakes claim + its evidence              | verdict (real/refuted)                                   | refutation confidence                  | refuted → drop claim, lower-confidence response        | `critic`                     |
| 9   | Compliance Review         | candidate output + bounded context            | accept / repair / block + reasons                        | verdict confidence                     | block → deterministic fallback; repair → loop          | `compliance`                 |
| 10  | Response Assembly         | validated content + deterministic outcomes    | governed user-facing output                              | final response confidence              | empty → fallback                                       | `compose`                    |
| —   | Audit                     | every stage's event                           | durable turn record + rollups                            | n/a                                    | non-blocking (swallow)                                 | (the sink)                   |

## 4. Determinism boundary (what is rules vs. what is the LLM)

| Deterministic (rules/engines — authoritative)                                                                                                          | LLM (gated, advisory)                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Intent → agent selection rules, parallelization, tool ordering, conflict ranking math, confidence aggregation, Compliance gate, persistence, telemetry | Intent classification (with a deterministic fallback), domain reasoning, decision framing/explanation, the Critic's refutation, the Advisor's language |

Intent detection is the one stage where an LLM may assist classification — but it always has a deterministic
fallback (default to discovery), and the _consequences_ of the intent (which agents run) are deterministic
rules, not "LLM intuition." See `ORCHESTRATION_ENGINE.md`.

## 5. Invariants the execution layer must preserve (inherited, non-negotiable)

1. The LLM is never the source of truth; it never persists; it never faces the user directly.
2. No fabrication (allowed-numbers, citation contract, evidence-or-nothing).
3. Compliance is mandatory and unbypassable before any user-facing text.
4. The call graph is a DAG; no agent calls another directly; chains are hop-bounded.
5. Numbers come only from deterministic tools (with a trace) or the user's data.
6. Every stage is observable; the deterministic floor guarantees a safe response on any failure.

## 6. What this phase is NOT

No code, no Gemini calls, no runtime change, no deploy. The live advisor remains exactly as-is. This is the
implementation contract the next phase (Gemini orchestration) must satisfy — and only after the
`EXECUTION_READINESS_REVIEW.md` gaps are addressed and the design is accepted.
