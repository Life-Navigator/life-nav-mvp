# MCP_ADVISOR_INTEGRATION.md — Sprint A

How an approved ProposedAction becomes a real life-model write (Advisor OS step 5), through the existing MCP `IngestionService` — the only sanctioned writer. **No new write path, no new infra.**

## The invariant chain

1. The advisor LLM **never writes the DB** (existing hybrid-advisor invariant).
2. The advisor only ever emits **ProposedAction[]** (ADVISOR_ACTION_FRAMEWORK).
3. A write happens **only** after explicit approval (APPROVAL_AND_CHANGE_SYSTEM).
4. The approved action is executed by the **deterministic MCP layer** (`IngestionService`), which enforces schema, tenant scoping, and provenance — exactly as document/MCP ingestion does today.

So "LLM proposes, user approves, MCP writes" — three separated responsibilities, none bypassable.

## Action → tool mapping

Each ProposedAction.tool is one of the seven existing `IngestionService` methods:

| ProposedAction.tool | IngestionService method | Writes to              |
| ------------------- | ----------------------- | ---------------------- |
| submit_life_fact    | `submit_life_fact`      | `life.facts`           |
| submit_life_goal    | `submit_life_goal`      | `life.candidate_goals` |
| submit_constraint   | `submit_constraint`     | `life.constraints`     |
| submit_risk         | `submit_risk`           | `life.risks`           |
| submit_opportunity  | `submit_opportunity`    | `life.opportunities`   |
| submit_narrative    | `submit_narrative`      | life narrative store   |
| submit_relationship | `submit_relationship`   | `life.relationships`   |

The action framework can only propose what maps to one of these — there is no escape hatch to write an arbitrary table.

## Provenance written on every approved change

The executor passes provenance so the change is later citable/reversible and visible in Sprint-B surfaces:

```
{ source: 'user_message',
  confirmation_status: 'confirmed',          // user explicitly approved it
  submitted_by: 'advisor',
  provenance: { conversation_id, turn_id, proposed_action_id },
  confidence: <from the proposal>,
  idempotency_key: '<conversation_id>:<entity>'   // re-approval is idempotent, no dupes
}
```

Because approved advisor changes land in `life.facts`/`life.relationships` with provenance, they immediately flow back through the **Sprint B reader** into the advisor's own future fact packet, the dashboard "recently learned" strip, etc. The loop closes: what you tell Arcana becomes citable life-model state.

## Execution semantics

- **Atomic per approval:** selected items execute together; if one fails, report it and roll back that item (idempotency_key makes retry safe).
- **Idempotent:** re-approving the same proposal (e.g. double-click) writes once.
- **Downstream recompute is read-time:** readiness/recommendations are pure functions of the rows, so they refresh on next fetch; the change-visibility summary captures the pre/post delta from `life.readiness_snapshots`.
- **No silent side effects:** the executor writes ONLY the approved ProposedAction payloads — it never infers extra writes.

## Security alignment

- MCP service writes as service_role but **scopes `user_id` from the resolved token, never from action input** (existing MCP rule) — an approved action cannot write to another user.
- The migration gating note on `life.facts`/`relationships` (rotate exposed keys before relying on MCP writes) still applies operationally; this design assumes the rotated-key posture.

## Build note (not in this design slice)

This is the integration design. Implementation is a follow-on: an `AdvisorActionExecutor` that takes approved ProposedActions and calls the matching `IngestionService` methods, plus the impact-analysis traversal in the action framework. Both reuse existing services; neither needs new infrastructure. Sprint B already proved the read side of this loop (advisor reads `life.facts`); this is the write side, gated by approval.
</content>
