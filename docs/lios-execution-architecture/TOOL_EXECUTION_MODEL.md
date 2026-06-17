# LIOS Tool Execution Model

> **Design/spec only — no code/runtime/Gemini/Vertex/beta.** Derived from
> `EXECUTION_ARCHITECTURE.md` (stage [4] Tool Plan contract; invariant 5 — numbers only from tools),
> `ORCHESTRATION_ENGINE.md` (§5 serial vs. parallel),
> `docs/lios-agent-specifications/TOOL_EXECUTION_AGENT.md`,
> `docs/lios-agent-specifications/FINANCE_AGENT.md`, `DECISION_LIFECYCLE.md`,
> `docs/lios-prompt-operating-system/schemas/TOOL_EXECUTION_SCHEMA.md` (the `calculation_trace` / `write_receipt` shapes).
> Defines when tools run, in what order, and the write-gating rules.

---

## 1. The cardinal rule: no estimated calculations

> **An LLM may NEVER estimate a calculation when a tool exists.** Every surfaced number carries a
> `calculation_trace` produced by **Tool Execution** — the deterministic engine tier. The trace IS the
> number's license (`TOOL_EXECUTION_AGENT.md` §13; `EXECUTION_ARCHITECTURE.md` invariant 5;
> `DECISION_LIFECYCLE.md` §1).

Consequences:

- Domain agents **reason** but do not **compute**: the Finance Agent decides _which_ calculators are needed
  and requests them; it never does the arithmetic (`FINANCE_AGENT.md` §6 step 4, §7).
- A derived figure expressed in LLM prose with no trace is an _unsupported number_ and is rejected at the
  gate (`FINANCE_AGENT.md` §14 negative #3; `TOOL_EXECUTION_AGENT.md` §14 negative #2).
- Tool Execution is purely deterministic — it runs no LLM and never authors language
  (`TOOL_EXECUTION_AGENT.md` §3).

---

## 2. The tool plan (stage [4])

Stage [4] computes, deterministically, _which_ tools run and _in what order_ before any agent execution.

### Stage [4] contract (from the master's stage-contract table)

| Field               | Value                                                             |
| ------------------- | ----------------------------------------------------------------- |
| Inputs              | selected agents (stage [2]); the decision frame                   |
| Outputs             | an ordered list of tool calls (with their data dependencies)      |
| Confidence          | n/a (deterministic)                                               |
| Failure state       | tool unavailable → `blocked` for that branch (never hand-compute) |
| Observability event | `tool_plan`                                                       |

`tool_plan` may be computed **in parallel with** `graph_plan` (both feed agent execution —
`ORCHESTRATION_ENGINE.md` §4/§5). The plan is selected by rule R4 of `AGENT_SELECTION_ENGINE.md` (a tool
plan exists iff a number/projection/write is required), then ordered by the data-dependency rules in §3.

---

## 3. Serial vs. parallel tool calls (ordered by data dependency)

The ordering rule is purely the **data dependency graph** among tools:

- **Parallel-safe:** independent tool calls with **no** data dependency (e.g. net-worth composition and a
  standalone debt summary that share inputs but not outputs) — `ORCHESTRATION_ENGINE.md` §5.
- **Serial:** a tool whose inputs include another tool's output runs _after_ that tool — a tool chain with
  data deps (`ORCHESTRATION_ENGINE.md` §5/§6: "affordability → mortgage → cash-flow").

### 3.1 Worked example — the home-purchase ordering

For "Can I afford this house?" the numbers must be computed in dependency order, and the chain runs
**before any recommendation** (`DECISION_LIFECYCLE.md` §3 invariant: `inputs_gathered → modeled` is
deterministic; modeling precedes presentation/recommendation):

```
Decision frame (Decision Scientist) ─▶ Tool Execution serial chain:

   [T1] Affordability Tool ──▶ [T2] Mortgage Tool ──▶ [T3] Cash Flow Tool
        (price, income,         (loan size, rate,        (monthly payment from T2
         down payment →          term → monthly           + income/expenses →
         affordability frame)    payment + amortization)   surplus/deficit, reserves)
                                          │
                                          ▼
        ── all three results + their calculation_traces ──▶ (now, and only now)
                                          │
                                          ▼
                          Recommendation Agent  (evidence-backed, if a concrete action emerges)
                                          │
                                          ▼
                                     Compliance ─▶ Response Composer
```

Each arrow is a real data dependency: the Mortgage Tool needs the affordability frame; the Cash Flow Tool
needs the mortgage payment. They cannot be parallelized, and **no recommendation is minted before all three
traces exist** — recommendations consume the modeled numbers, not estimates (no rec without evidence;
`AGENT_SELECTION_ENGINE.md` R7).

---

## 4. Precondition gating for WRITES

Reads/calculations and writes are gated differently. A **write** runs only when all of the following hold
(`TOOL_EXECUTION_AGENT.md` §3, §6 steps 1–4, §13):

```
WRITE preconditions (ALL required):
  1. Approved writer only      — target is a sanctioned save path (RecommendationOS.write,
                                 the domain writers); no ad-hoc SQL, no arbitrary table mutation.
  2. After confirmation        — a deterministic precondition OR an explicit user confirmation
                                 is satisfied. The LLM never persists; it may only *request* a write,
                                 and the request must clear a deterministic check.
  3. user_id from the JWT       — tenant bound from the authenticated UserContext; RLS on every write;
                                 never cross-tenant; provenance recorded.
```

If a write request fails (1): rejected (unapproved path). If (2) is unmet: `needs_confirmation` (nothing
persisted) or `blocked` (precondition false). If (3) is missing: rejected, never persisted
(`TOOL_EXECUTION_AGENT.md` §11, §12, §15). Every successful write returns a `write_receipt`
(save_path, target, user_id, records_written, provenance, precondition_satisfied) per
`TOOL_EXECUTION_SCHEMA.md`.

Calculations (no mutation) skip the write gate but still require typed/bounded inputs and emit a
`calculation_trace`.

---

## 5. Tool failure → blocked (never hand-compute)

When a required engine or save path is down, or a request is untyped/unapproved, Tool Execution returns
`blocked` — it **never** substitutes a hand-computed or LLM-estimated value
(`TOOL_EXECUTION_AGENT.md` §11, §12, §16; stage [4] failure state):

| Situation                           | Outcome                      | Turn effect                                                                                      |
| ----------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Calculator/engine down              | `blocked`                    | that branch degrades; the requesting agent falls back to deterministic text; floor still answers |
| Required calc input missing         | `needs_data` (named, ranked) | resume when the input arrives; no guessed input substituted                                      |
| Write precondition unmet            | `blocked`                    | nothing persisted                                                                                |
| Write needs user confirmation       | `needs_confirmation`         | candidate surfaced; nothing persisted                                                            |
| Untyped / unapproved / ad-hoc write | `blocked` (rejected)         | only sanctioned paths execute                                                                    |

A `blocked` tool degrades exactly one branch (per the join rule in `PARALLELIZATION_MODEL.md` §3); it never
escalates to fabrication and never produces a number without a trace.

---

## 6. Assumptions are always surfaced

The math is exact; the inputs may not be. Tool Execution lists **every assumption** the deterministic run
relied on inside the `calculation_trace.assumptions[]` (`TOOL_EXECUTION_AGENT.md` §1 resp. 5, §6 step 7,
§13). An assumed input (e.g. an inflation rate, a default rate when the user's is unknown) is named in the
trace and **lowers data-completeness / provenance-quality**, which can tip the result into `needs_data`
rather than a confident answer resting on guesses (`TOOL_EXECUTION_AGENT.md` §10). An unstated assumption
is a hidden fabrication risk and is prohibited.

Confidence here reports **input quality + assumptions used**, never the arithmetic — exact math with thin
inputs yields a low-confidence (or `needs_data`) result, not a falsely confident number.

---

## 7. Outputs (reference) and where the trace goes

Per `TOOL_EXECUTION_SCHEMA.md`, the Tool Execution payload is one of:

```
calculation_trace: { tool, inputs, output, steps[], assumptions[{label,value}] }   # for a computed number
write_receipt:     { save_path, target, user_id, records_written, provenance, precondition_satisfied }  # for a write
```

Every computed number is reproducible from its `calculation_trace`; that trace travels with the number
through Conflict/Recommendation/Critic/Compliance so the gate can verify the allowed-numbers rule
(`TOOL_EXECUTION_AGENT.md` §13). The Response Composer surfaces the figure with its assumptions; it never
introduces a number of its own.

---

## 8. Tool execution invariants

1. No number without a tool + a `calculation_trace`; the LLM never estimates a calculation that a tool can
   produce.
2. Domain agents request calculations; they never compute (`FINANCE_AGENT.md` §7); Tool Execution computes
   but never reasons about meaning or authors text.
3. Tool order follows data dependencies: independent calls may parallelize; dependent chains
   (affordability → mortgage → cash-flow) are serial and complete **before** recommendations.
4. Writes require ALL of: approved save path, satisfied precondition/confirmation, `user_id` from the JWT
   - provenance (RLS, no cross-tenant); the LLM never persists.
5. Tool/engine failure → `blocked` (or `needs_data`/`needs_confirmation`); never a hand-computed or
   estimated substitute.
6. Every assumption the run relied on is listed; confidence reflects input quality, not the arithmetic.

```

```
