# Orchestrator Agent — Specification

> Agent specification. Specification only — no code, no prompts, no runtime. Inherits the shared contracts
> (`AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`,
> `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`). Maps to the live `AdvisorOrchestrator`.

---

## 1. Identity

- **Agent Name:** Orchestrator
- **Mission:** Be the single, safe entry/exit point for all intelligence work — route, sequence, and
  guarantee a governed response.
- **Purpose:** Classify intent, select the agent path, enforce deterministic-first ordering, mediate all
  escalations, run Compliance before any user-facing text, and emit one telemetry record per turn.
- **Primary Responsibilities:**
  1. Receive the authenticated request (JWT `user_id`).
  2. Run the deterministic turn first (trust floor).
  3. Sequence the needed agents (no agent calls another directly).
  4. Ensure Compliance runs before the Response Composer.
  5. Guarantee a safe response on any failure; log the turn to Audit.

---

## 2. Ownership

**Owns:** intent classification, routing/sequencing, the per-turn telemetry envelope, the deterministic-first
guarantee, the "always a safe response" guarantee.

**Does NOT own:** facts, recommendations, calculations, persistence, user-facing language, compliance
verdicts (it _invokes_ Compliance; it doesn't decide). It coordinates; it never computes domain truth.

---

## 3. Boundaries (prohibited)

- Cannot write to the database.
- Cannot generate user-facing language itself (delegates to Response Composer).
- Cannot bypass Compliance.
- Cannot trust `user_id` from the request body (only the verified JWT).
- Cannot let agents call each other directly or form cycles.
- Cannot invent a route that skips the deterministic turn or the Audit bookend.

---

## 4. Inputs (allowed sources)

- The authenticated `UserContext` (JWT-derived `user_id`).
- The user message or domain/decision request; optional `conversation_id`, dev `trace` flag.
- The outputs of the agents it sequences (their common envelopes).

---

## 5. Outputs (schema)

Common envelope with the Orchestrator `payload`:

```json
{
  "turn_id": "",
  "route_plan": {
    "intent": "discovery|domain|decision|...",
    "selected_agents": [],
    "pipeline": []
  },
  "governed_response": {
    "assistant_message": "", // from Response Composer (post-Compliance) — or deterministic fallback
    "llm_status": "enhanced|fallback:<reason>|disabled",
    "structured_outcomes": {} // deterministic outcomes (goals, panel, etc.)
  },
  "telemetry_ref": "analytics.advisor_turns:<turn_id>"
}
```

The Orchestrator's `status` reflects the turn outcome (`success` or a fallback mapped to `blocked` /
`compliance_rejected`).

---

## 6. Cognitive Framework

```
Step 1  Authenticate + bind user_id (from JWT).
Step 2  Classify intent (discovery / domain question / decision / document / ...).
Step 3  Run the deterministic turn (Relationship Manager) — the safe floor.
Step 4  Assemble bounded context (Memory + GraphRAG/Doc Intel as needed).
Step 5  Select + sequence the agent pipeline for the intent (a DAG).
Step 6  Invoke each agent; handle `escalated` by routing (acyclic, hop-bounded).
Step 7  Run Compliance on any LLM-authored output; (Critic if high-stakes).
Step 8  Invoke Response Composer on accepted/repaired output; else use deterministic fallback.
Step 9  Emit the turn telemetry to Audit; return the governed response.
```

---

## 7. Tool Rules

- **Allowed:** invoking the other agents; reading the telemetry sink (write via Audit).
- **Required:** the deterministic turn (step 3) and the Audit bookend (step 9) on every turn.
- **Forbidden:** any domain calculation; any DB write; any direct model call (LLM access is inside the LLM
  agents).

## 8. GraphRAG Rules

- **May:** ask Memory/GraphRAG to assemble context. **May not:** read/create edges itself or cite
  relationships (it routes; it doesn't claim).

## 9. Memory Rules

- Reads only what it needs to route (intent signals, conversation id); never holds domain memory itself.

## 10. Confidence Model

- The Orchestrator does not assert facts, so it has **no domain confidence**; it **records** each leaf
  agent's confidence in telemetry and may use it to decide whether to invoke the Critic. (Confidence model
  N/A for its own payload; `na_components` = all.)

## 11. Escalation Rules

- The Orchestrator is the escalation **mediator**, not an escalator. It executes other agents' `escalated`
  outcomes, rejects cyclic/over-long routes, and caps hop count. On an unroutable escalation → safe
  fallback + Audit flag.

## 12. Failure Behavior

- Any unhandled error anywhere → deterministic fallback text, `llm_status=fallback:error` → mapped to
  `blocked`; never an exception to the user. A Compliance rejection downstream → `compliance_rejected`
  surfaced as fallback. The Orchestrator's prime directive: **always return a safe response.**

## 13. Compliance Requirements

- MUST route every LLM-authored output through Compliance before the Response Composer. MUST NOT expose any
  unvalidated LLM text. MUST log the compliance result on the turn.

---

## 14. Example Scenarios

**Positive (5):** (1) discovery turn sequenced det→ctx→advisor→compliance→composer→audit; (2) domain
question routed to Finance→Tool Exec→Recommendation→Compliance; (3) decision routed through the decision
pipeline; (4) streaming: emits deterministic ack first, then validated final; (5) high-stakes claim → Critic
invoked before Compliance.

**Negative (5):** (1) returns raw LLM text without Compliance — forbidden; (2) lets Finance call Decision
Scientist directly — forbidden (must mediate); (3) trusts body `user_id` — forbidden; (4) writes to DB —
forbidden; (5) throws an exception to the surface — forbidden (must fallback).

**Edge (5):** (1) LLM down → deterministic fallback; (2) escalation would form a cycle → reject route,
fallback; (3) hop cap exceeded → terminate at fallback + Audit; (4) Audit write fails → swallow, response
still returns; (5) ambiguous intent → default to discovery (safest path).

## 15. Unit Test Matrix

| Class         | Test                                   | Expected                                                         |
| ------------- | -------------------------------------- | ---------------------------------------------------------------- |
| Happy         | discovery turn                         | correct pipeline order; compliance before composer; audit logged |
| Happy         | streaming                              | ack emitted before final; final is validated                     |
| Missing       | LLM unavailable                        | deterministic fallback; `blocked`                                |
| Conflict      | agent A tries to call agent B directly | rejected; all routing via Orchestrator                           |
| Conflict      | cyclic escalation                      | route rejected; fallback                                         |
| Compliance    | LLM output bypass attempt              | impossible — compliance is mandatory pre-composer                |
| Hallucination | downstream invented claim              | rejected by Compliance → fallback surfaced                       |
| Security      | body `user_id` ≠ JWT                   | JWT wins; body ignored                                           |
| Observability | every turn                             | exactly one telemetry record emitted                             |
