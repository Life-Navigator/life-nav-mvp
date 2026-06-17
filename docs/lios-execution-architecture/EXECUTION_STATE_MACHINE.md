# LIOS Execution State Machine

> The formal per-agent execution states + transitions, and how they relate to the six agent **outcome**
> states. Design only; no code. Derived from `AGENT_FAILURE_BEHAVIOR.md`, `AGENT_ESCALATION_MODEL.md`,
> `ORCHESTRATION_ENGINE.md`.

---

## 1. Two distinct vocabularies (do not confuse them)

- **Outcome states** (what an agent _returns_, from `AGENT_FAILURE_BEHAVIOR.md`): `success`, `needs_data`,
  `needs_confirmation`, `blocked`, `escalated`, `compliance_rejected`.
- **Execution states** (where an agent _is_ in its run, tracked by the Orchestrator): `queued`, `running`,
  `waiting_for_data`, `waiting_for_confirmation`, `blocked`, `escalated`, `completed`, `failed`.

An agent's returned **outcome** drives its **execution** transition.

## 2. Per-agent execution states

| State                      | Meaning                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- |
| `queued`                   | scheduled in the route plan, not yet started                                 |
| `running`                  | actively executing                                                           |
| `waiting_for_data`         | returned `needs_data`; paused pending Missing Data / user input              |
| `waiting_for_confirmation` | returned `needs_confirmation`; paused pending user confirmation              |
| `blocked`                  | returned `blocked` (precondition/tool failure); safe stop                    |
| `escalated`                | returned `escalated`; the Orchestrator is routing the handoff                |
| `completed`                | finished with `success` (or an accepted/repaired result)                     |
| `failed`                   | unrecoverable error (mapped to the deterministic fallback at the turn level) |

## 3. Transition diagram

```
            schedule            start
  (route) ─────────▶ queued ───────────▶ running
                                          │
        ┌───────────────┬────────────────┼───────────────┬───────────────┐
   outcome=success   needs_data    needs_confirmation  escalated        blocked / error
        │               │                │                │                │
        ▼               ▼                ▼                ▼                ▼
    completed     waiting_for_data  waiting_for_      escalated         blocked
        │               │           confirmation         │             (or failed
        │        (data arrives)     (user confirms)  (target runs       on error)
        │               │                │            via Orchestrator)  │
        │               └──────▶ running ◀┘                │             │
        │                       (resume)                   ▼             ▼
        ▼                                              completed/    deterministic
   (feeds next stage)                                  blocked       fallback (turn-level)
```

Rules:

- `waiting_for_data` / `waiting_for_confirmation` are **resumable**: when the input arrives, the agent
  re-enters `running`. There is a bounded wait + retry budget; exceeding it → `blocked`.
- `escalated` is not terminal for the _turn_ — the target agent runs (via the Orchestrator) and its result
  flows back; the original chain continues or completes.
- `blocked` and `failed` are safe stops at the agent level; at the **turn** level the deterministic floor
  guarantees a response (never an exception to the user).
- `compliance_rejected` (an outcome) maps to: the agent's execution is `completed` but its content is
  discarded; the turn degrades to a repair loop or the deterministic fallback (see `COMPLIANCE_PIPELINE.md`).

## 4. Turn-level state (the whole request)

```
queued → running → { completed_governed | fallback_safe }
```

A turn is `completed_governed` when a validated response is composed, or `fallback_safe` when the
deterministic floor answers (LLM unavailable / blocked / compliance-blocked / error). A turn **never** ends
in an uncaught `failed` from the user's perspective.

## 5. Outcome → execution mapping (reference)

| Agent outcome         | Agent execution               | Turn effect                                  |
| --------------------- | ----------------------------- | -------------------------------------------- |
| `success`             | `completed`                   | feeds the next stage                         |
| `needs_data`          | `waiting_for_data`            | Missing Data / Advisor asks; resume on input |
| `needs_confirmation`  | `waiting_for_confirmation`    | surface candidate; resume on confirm         |
| `escalated`           | `escalated` → target runs     | chain continues                              |
| `blocked`             | `blocked`                     | branch degrades; floor still answers         |
| `compliance_rejected` | `completed` (content dropped) | repair loop or fallback                      |
| (unhandled error)     | `failed`                      | deterministic fallback                       |

## 6. Concurrency + the state machine

Parallel agents each carry their own execution state; the Orchestrator joins a parallel group only when all
members are `completed`/`blocked` (a `blocked` member degrades that branch but doesn't fail the join). A
`waiting_*` member pauses only its own branch, not siblings.

## 7. Observability

Every state transition emits an event (`agent_exec` with `from_state`, `to_state`, `outcome`, `hop_index`)
to Audit, so a turn's full execution trace is reconstructable. (See `OBSERVABILITY_MODEL.md`.)

## 8. Invariants

1. Outcome states and execution states are distinct and explicitly mapped.
2. `waiting_*` is resumable within a bounded budget; exceeding it → `blocked`.
3. No turn ends in user-visible `failed`; the deterministic floor guarantees `fallback_safe`.
4. Every transition is logged.
