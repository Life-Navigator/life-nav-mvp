# Orchestrator Output Schema (Layer 8)

> **Layer:** 8 (output contract) for the Orchestrator — the route-plan + governed-response output. Wraps the
> common envelope (`AGENT_OUTPUT_SCHEMA.md`); only the `payload` is defined here.
> **Source of truth:** `docs/lios-agent-specifications/ORCHESTRATOR_AGENT.md`, `AGENT_OUTPUT_SCHEMAS.md`,
> `AGENT_FAILURE_BEHAVIOR.md`, `AGENT_ESCALATION_MODEL.md`.
> **Version:** orchestrator-schema-1.0.

The Orchestrator is the single safe entry/exit point. It routes, sequences, runs Compliance before any
user-facing text, and emits exactly one telemetry record per turn. It asserts no domain facts, so its
`confidence.na_components` = all (it records each leaf agent's confidence in telemetry instead).

---

## Schema

The common envelope (`AGENT_OUTPUT_SCHEMA.md`) with this `payload`:

```json
{
  "turn_id": "",
  "route_plan": {
    "intent": "discovery | domain | decision | document | ...",
    "selected_agents": [""],
    "pipeline": [""],
    "risk_level": "low | medium | high | regulated",
    "compliance_required": true,
    "retrieval_plan": { "memory": true, "graphrag": false, "doc_intel": false },
    "missing_data_path": "missing_data | advisor | onboarding | none"
  },
  "governed_response": {
    "assistant_message": "",
    "llm_status": "enhanced | fallback:<reason> | disabled",
    "structured_outcomes": {}
  },
  "telemetry_ref": "analytics.advisor_turns:<turn_id>"
}
```

## Field rules

| Field                                   | Rule                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `turn_id`                               | unique per turn; the key for the single Audit telemetry record                                               |
| `route_plan.intent`                     | the classified intent; `discovery` is the safe default for ambiguous intent                                  |
| `route_plan.selected_agents`            | the agents chosen for the intent (a set)                                                                     |
| `route_plan.pipeline`                   | the ordered DAG of stages — acyclic, hop-bounded; deterministic turn first, Audit last                       |
| `route_plan.risk_level`                 | high/`regulated` ⇒ Critic before Compliance; drives gating                                                   |
| `route_plan.compliance_required`        | true for any LLM-authored output (Compliance is mandatory pre-Composer)                                      |
| `route_plan.retrieval_plan`             | which context stores get assembled (Memory / GraphRAG / Doc Intel)                                           |
| `route_plan.missing_data_path`          | where a `needs_data` outcome is routed to be asked                                                           |
| `governed_response.assistant_message`   | the ONLY user-facing string — from the Response Composer (post-Compliance) **or** the deterministic fallback |
| `governed_response.llm_status`          | `enhanced` → `success`; `fallback:<reason>` maps to `blocked`/`compliance_rejected`; `disabled` when LLM off |
| `governed_response.structured_outcomes` | deterministic outcomes (goals, panels) passed through unchanged                                              |
| `telemetry_ref`                         | pointer to the emitted Audit record for this `turn_id`                                                       |
| `status` (envelope)                     | reflects the turn outcome: `success`, or a fallback mapped to `blocked` / `compliance_rejected`              |

## Status → next

| status                | meaning / next                                                                    |
| --------------------- | --------------------------------------------------------------------------------- |
| `success`             | `llm_status=enhanced`; governed response composed and returned                    |
| `blocked`             | LLM/agent failure → deterministic fallback text served; turn logged               |
| `compliance_rejected` | downstream output failed the gate → fallback surfaced; logged as a quality signal |

## Invariants

1. **No circular routing** — the pipeline is an acyclic, hop-bounded DAG; cyclic/over-long routes are rejected → fallback.
2. **Deterministic-turn-first** — the safe deterministic floor runs before any agent/LLM work, every turn.
3. **Compliance before Composer** — every LLM-authored output is gated; unvalidated LLM text is never exposed.
4. **Audit bookend** — exactly one telemetry record is emitted per turn (`telemetry_ref`).
5. **Never a user-facing string except from the Composer or the deterministic fallback** — the Orchestrator authors no language itself.
6. `user_id` comes only from the verified JWT; a body `user_id` is ignored.
7. No DB writes, no domain calculations, no direct agent-to-agent calls — it mediates every escalation.
8. Any unhandled error → deterministic fallback (`blocked`); never an exception to the user. Prime directive: **always return a safe response.**
