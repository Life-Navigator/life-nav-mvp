# LIOS Parallelization Model

> **Design/spec only — no code/runtime/Gemini/Vertex/beta.** Derived from
> `ORCHESTRATION_ENGINE.md` (§4 the DAG, §5 parallel-execution opportunities),
> `EXECUTION_STATE_MACHINE.md` (§6 concurrency + the state machine),
> `EXECUTION_ARCHITECTURE.md` (stage [5] agent execution contract),
> `AGENT_SELECTION_ENGINE.md`, `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_ESCALATION_MODEL.md`.
> Defines what may safely run in parallel vs. what must be serial, the join rule, and wall-clock reasoning.

---

## 1. Principle: parallelize independence, serialize dependence

The DAG is the source of truth. Two boxes may run **at the same time iff neither consumes the other's
output** (and neither is the always-serial gate). The order is fixed by dependency, not preference
(`ORCHESTRATION_ENGINE.md` §4). Parallelism is an optimization on top of the same DAG — it never reorders
dependent stages and never lets an agent see a sibling's partial output.

```
det_turn → intent → selection → [graph_plan ∥ tool_plan] → agent_execution(∥ where safe)
        → conflict → recommendation → critic? → compliance (→ repair) → response_assembly → audit
```

---

## 2. What is parallel-safe vs. must-be-serial (deterministic)

(Source: `ORCHESTRATION_ENGINE.md` §5.)

| Parallel-safe (no data dependency between them)                           | Must be serial (consumes an upstream output)                          |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Independent domain agents: Finance ∥ Career ∥ Family ∥ Education ∥ Health | Conflict Resolution (needs **all** domain outputs)                    |
| Plan computation: `graph_plan` ∥ `tool_plan` (both feed agent execution)  | Recommendation (needs evidenced findings)                             |
| Independent tool calls with **no** data dependency                        | Critic (needs the claim it refutes)                                   |
| Audit (non-blocking, fans out from every stage)                           | Compliance (needs the candidate output)                               |
|                                                                           | Response Assembly (needs the validated output)                        |
|                                                                           | Tool chains **with** data deps (affordability → mortgage → cash-flow) |

Rationale:

- **Finance ∥ Career ∥ Family** can run simultaneously because each owns a disjoint domain (each reads its
  own bounded Memory and requests its own tools; `FINANCE_AGENT.md` §9). None reads another domain agent's
  output — cross-domain reconciliation is the Decision Scientist's / Conflict Resolution's job downstream.
- **graph_plan ∥ tool_plan** are two independent planning computations that both feed stage [5]; neither
  needs the other.
- **Recommendation/Conflict/Critic/Compliance/Response Assembly cannot start until upstream finishes** —
  a recommendation cannot precede the evidence it cites; Compliance cannot precede the content it gates
  (`ORCHESTRATION_ENGINE.md` §5; `EXECUTION_ARCHITECTURE.md` §3).
- **Serial tool chains:** when tool B needs tool A's result (mortgage needs the affordability frame; cash
  flow needs the mortgage payment), they run in sequence — see `TOOL_EXECUTION_MODEL.md`.

No parallel branch may call another branch directly; if a domain agent needs another agent it returns
`escalated` and the Orchestrator routes it post-join (`AGENT_INTERACTION_CONTRACTS.md` §1).

---

## 3. The join rule

A **parallel group** is a set of agents the Orchestrator launches together (e.g. `[finance, career,
family]`). Each member carries its own execution state (`EXECUTION_STATE_MACHINE.md` §6).

```
JOIN(group) fires  ⇔  every member is in { completed, blocked }.
```

Per-member effect on the join (from `EXECUTION_STATE_MACHINE.md` §6):

| Member end state           | Effect on the join                                               | Effect on the turn                                                         |
| -------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `completed`                | counts as done; its output feeds downstream                      | contributes its envelope                                                   |
| `blocked`                  | **does not fail the join**; that branch degrades                 | downstream proceeds without it; floor still answers                        |
| `waiting_for_data`         | **pauses only its own branch**, not siblings                     | turn waits for input on that branch (Missing Data / user); siblings finish |
| `waiting_for_confirmation` | pauses only its own branch                                       | turn surfaces the candidate; resume on confirm                             |
| `escalated`                | the Orchestrator routes the handoff (still acyclic, hop-bounded) | the escalation target runs, result flows back                              |

Key distinctions:

- A **`blocked`** member _degrades_ its branch — the join still fires and the turn continues with one fewer
  domain view (honest partial answer), never an exception to the user.
- A **`waiting_*`** member _pauses only its own branch_; siblings are unaffected and continue to completion.
  The join is not declared until every branch is `completed`/`blocked` or its bounded wait budget expires
  (then it transitions to `blocked` — `EXECUTION_STATE_MACHINE.md` §2/§8).
- Downstream serial stages (Conflict/Recommendation/Critic/Compliance/Assembly) start **only after the
  join fires** — they need the full (possibly degraded) set of upstream outputs.

---

## 4. Wall-clock reasoning

For a parallel group, **group latency = the slowest member** (the max), not the sum:

```
latency(group) = max( latency(member_i) )          # members run concurrently
latency(serial chain) = Σ latency(stage_j)          # stages run one after another
turn latency ≈ Σ over serial stages, with each parallel group counted once at its max member
```

A `blocked` member that fails fast can _shorten_ the join (it leaves the group early); a `waiting_*` member
extends its branch up to the bounded wait budget. The deterministic floor (stage [0]) already exists, so
even a long-running branch never withholds a safe response — the governed response simply arrives when the
join + downstream gate complete.

---

## 5. Dependency diagrams (ASCII DAGs) for the three examples

Mirrors the routing in `AGENT_SELECTION_ENGINE.md` §4. `[A ∥ B]` = parallel group; `→` = serial dependency.

### 5.1 SIMPLE — "What is my current net worth?"

```
selection ─▶ [ graph_plan(skip) ∥ tool_plan ] ─▶ Finance ─▶ Tool Execution ─▶ Compliance ─▶ Composer
                                                  (single domain — no join needed)
```

No domain parallel group (only Finance). graph_plan ∥ tool_plan is the only concurrency; graph_plan is
skipped, so tool_plan runs alone. Wall-clock ≈ Finance + net-worth tool + gate.

### 5.2 MODERATE — "Can I afford this house?"

```
selection ─▶ [ graph_plan ∥ tool_plan ]
                     │
                     ▼
        ┌──── PARALLEL GROUP ────┐
        │   Finance   ∥   Family │      latency = max(Finance, Family)
        └───────────┬────────────┘
              JOIN (both completed/blocked)
                     │
                     ▼
            Decision Scientist ─▶ Tool Execution(serial: Affordability→Mortgage→Cash Flow)
                     │
                     ▼
            (Recommendation?) ─▶ Compliance ─▶ Response Composer
```

Parallel group `[finance, family]`. If Family is `blocked` (e.g. no family data), the join still fires;
the affordability answer degrades to a finance-only framing rather than failing.

### 5.3 COMPLEX — "Should I move to Texas, change jobs, and buy a house?"

```
selection ─▶ [ graph_plan ∥ tool_plan ]
                     │
                     ▼
        ┌──────── PARALLEL GROUP ────────┐
        │  Finance  ∥  Career  ∥  Family │   latency = max(Finance, Career, Family)
        └───────────────┬────────────────┘
                  JOIN (all completed/blocked)
                          │  (serial decision pipeline — each consumes its predecessor)
                          ▼
              Decision Scientist ─▶ Scenario ─▶ Tradeoff ─▶ Recommendation ─▶ Critic ─▶ Compliance ─▶ Composer
                                    (Scenario's models come from serial Tool Execution chains)
```

Parallel group `[finance, career, family]` (wall-clock = the slowest of the three). Everything after the
join is strictly serial: Scenario needs the frame, Tradeoff needs the scenarios, Recommendation needs the
tradeoffs + evidence, Critic needs the claim, Compliance needs the candidate.

---

## 6. Concurrency invariants

1. Parallelism follows the DAG: only independence parallelizes; dependence serializes — never reordered.
2. Domain agents (Finance/Career/Family/Education/Health) and `graph_plan ∥ tool_plan` are the parallel
   surfaces; Conflict/Recommendation/Critic/Compliance/Response Assembly are always serial and downstream.
3. A parallel branch never reads a sibling's output and never calls another agent directly (escalate via
   the Orchestrator).
4. The join fires when every member is `completed`/`blocked`; a `blocked` member degrades its branch, a
   `waiting_*` member pauses only its own branch (bounded wait → `blocked`).
5. Group latency = slowest member; the deterministic floor guarantees a safe response regardless of timing.
6. Every member's state transition is logged (`agent_exec`); the full concurrency trace is reconstructable.

```

```
