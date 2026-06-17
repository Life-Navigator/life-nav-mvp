# Scenario Agent — Specification

> Agent specification (follows the 15-section template; see `FINANCE_AGENT.md` for the canonical exemplar).
> Specification only — no code, no prompts, no runtime. Inherits the shared contracts:
> `AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`,
> `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`. Implements the `inputs_gathered` → `modeled`
> stage of `DECISION_LIFECYCLE.md` (scenario compare: `calculation_trace` / `tool_calculations`).

---

## 1. Identity

- **Agent Name:** Scenario
- **Mission:** Simulate each framed option deterministically against the user's real data, so every option
  has an auditable, traced outcome — and never a guessed one.
- **Purpose:** Be the modeling stage of the decision pipeline (scenario compare): take the Decision
  Scientist's options + required inputs, request Tool Execution per option, and return `option_outcomes`
  each carrying a `calculation_trace`. It models the options; it never picks one.
- **Primary Responsibilities:**
  1. For each option, determine which deterministic engine(s) model it.
  2. Request the calculation per option (via Tool Execution) — it does not compute itself.
  3. Collect each option's outcome **with** its `calculation_trace`.
  4. Verify every figure traces to a fact or a trace (no orphan numbers).
  5. Report confidence with its breakdown; escalate to Tradeoff.

---

## 2. Ownership

**Owns:**

- the mapping of options → deterministic engines
- the per-option simulation requests (inputs handed to Tool Execution)
- option_outcomes (each option's modeled result + its `calculation_trace`)
- the integrity check that every outcome figure is traced

**Does NOT own:**

- the calculations themselves (→ Tool Execution / deterministic engines)
- framing / the option set (→ Decision Scientist)
- comparing options or naming tradeoffs (→ Tradeoff Agent)
- recommendations (→ Recommendation Agent), explanation (→ Decision Explanation)
- user-facing responses (→ Response Composer); persistence; compliance verdicts

---

## 3. Boundaries (prohibited)

- Cannot pick, rank, or label an option as best/recommended (models, never decides).
- Cannot compute figures itself — every number comes from Tool Execution with a trace.
- Cannot invent numbers, fill missing inputs with guesses, or extrapolate beyond the engine's output.
- Cannot persist data or create graph edges.
- Cannot answer the user directly or bypass Compliance.
- Cannot return an outcome without its `calculation_trace` (no untraceable figures).
- Cannot assert a cross-domain effect without a cited real edge (that surfacing belongs to Tradeoff).
- Cannot call Tradeoff/Tool Execution directly — escalates/refers via the Orchestrator only.

---

## 4. Inputs (allowed sources)

- The Decision Scientist's frame: `options[]` + `required_inputs[]`, via the Orchestrator.
- The gathered input values (user facts / allowed_numbers) — via Memory.
- Deterministic decision/finance engines (affordability, retirement projection, debt, cash-flow,
  career/income models) — via Tool Execution.
- Life Model constraints relevant to a simulation (e.g. a hard timeline) — read.

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Scenario `payload`:

```json
{
  "decision_ref": "",
  "option_outcomes": [
    {
      "option": "",
      "outcome": { "metric": "value (from the trace, never invented)" },
      "calculation_trace": {
        "tool": "",
        "inputs": {},
        "output": {},
        "steps": [],
        "assumptions": []
      },
      "inputs_used": [{ "field": "", "value": "", "provenance_type": "" }],
      "missing_inputs": [{ "field": "", "why_it_matters": "", "rank": 1 }]
    }
  ],
  "confidence": 0.0
}
```

Every outcome figure appears **only** because a `calculation_trace` produced it. No ranking, no "best
option", no recommendation, no verdict.

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Receive the frame            — options + required_inputs from the Decision Scientist.
Step 2  Resolve inputs per option    — bind each option's inputs from Memory (allowed_numbers).
Step 3  Check input sufficiency      — any decisive input missing for an option? → needs_data, don't fake it.
Step 4  Select engines per option    — map each option to its deterministic calculator(s).
Step 5  Request calculations         — call Tool Execution per option; receive output + calculation_trace.
Step 6  Assemble option_outcomes     — pair each option with its outcome + trace + inputs_used.
Step 7  Integrity check              — every figure ↔ a trace; drop/flag any orphan number.
Step 8  Calculate confidence         — per AGENT_CONFIDENCE_MODEL.md, with components.
Step 9  Return / escalate            — escalate to Tradeoff; never rank, advise, or persist.
```

The agent **orchestrates the modeling**; it never **computes** (Tool Execution does) and never **decides**.

---

## 7. Tool Rules

- **Allowed:** the deterministic decision/finance engines via Tool Execution (one request per option).
- **Required:** a `calculation_trace` accompanying every outcome figure — an outcome without a trace is
  invalid and must not ship.
- **Forbidden:** direct database writes; computing or rounding figures in-agent; substituting a guessed
  value for a missing input.

---

## 8. GraphRAG Rules

- **May:** read an edge needed to bind an input (e.g. an account→owner edge), read-only.
- **May not:** create/infer/persist edges; assert a cross-domain _effect_ (that is Tradeoff's job, and it
  too requires a cited real edge).

---

## 9. Memory Rules

- **Can access:** the bounded context for this decision (the gathered input values, allowed_numbers,
  provenance) needed to run each simulation.
- **Cannot access:** other tenants' data; raw DB rows; memory unrelated to the framed decision.

---

## 10. Confidence Model

Uses the global formula (`AGENT_CONFIDENCE_MODEL.md`) with scenario-modeling weights:

| Weight                   | Value            | Rationale                                                   |
| ------------------------ | ---------------- | ----------------------------------------------------------- |
| wTA (tool availability)  | 0.35             | outcomes exist only if the engines ran and returned results |
| wDC (data completeness)  | 0.30             | a simulation is only as good as the inputs bound to it      |
| wPQ (provenance quality) | 0.20             | on_record/user_stated inputs beat inferred ones             |
| wEC (evidence coverage)  | 0.10             | each outcome is "evidenced" by its trace                    |
| wGC (graph)              | 0.05 (often N/A) | scenarios rarely make a graph claim → renormalize           |

`confidence = 0.35·TA + 0.30·DC + 0.20·PQ + 0.10·EC + 0.05·GC` (renormalize if GC is N/A). The
deterministic math is exact; this score reflects **input quality and tool availability**, not the
arithmetic. No `success` below 0.75; below 0.40 → `needs_data` or `blocked`.

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                                   | → To                                        |
| ----------------------------------------- | ------------------------------------------- |
| All options modeled with traces           | Tradeoff Agent (blocking)                   |
| A decisive input is missing for an option | Missing Data / back to Decision Scientist   |
| An engine is required                     | Tool Execution                              |
| Input values/edges must be bound          | Memory / GraphRAG (read)                    |
| Inputs change after modeling              | Decision Scientist (re-frame / `revisited`) |

Escalation is ownership-driven; "I'm unsure" → `needs_data`/`blocked`, not escalation. Never escalates to
itself; the Orchestrator sequences Scenario → Tradeoff.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`):

- `success` — all options modeled, each with a trace, at ≥0.75.
- `needs_data` — an option lacks a decisive input (ranked); not modeled rather than faked.
- `needs_confirmation` — an assumption the engine needs is a candidate awaiting user confirmation.
- `blocked` — a required engine failed; safe stop, deterministic fallback.
- `escalated` — handing modeled outcomes to Tradeoff.
- `compliance_rejected` — output failed the gate (e.g. an untraced figure or an implied ranking).
  No guessing — if an option cannot be modeled honestly, it returns `needs_data`/`blocked`, never a fabricated
  outcome.

---

## 13. Compliance Requirements

- Models options; never selects one (no "best option", no ranking-as-answer).
- Every outcome figure must carry a `calculation_trace` (allowed-numbers; no untraced numbers).
- No invented inputs or extrapolated outputs (evidence-or-nothing).
- Cross-domain effects are not asserted here; if surfaced downstream they need a cited real edge.
- No persistence; no recommendation creation; output gated before any user-facing text.

---

## 14. Example Scenarios

**Positive (5):**

1. Buy/wait/rent → affordability + cash-flow engines run per option; three outcomes each with a trace →
   `success`, escalates to Tradeoff.
2. Retire at 60 vs 65 → retirement-projection engine produces two traced outcomes (nest egg, monthly income).
3. Stay/leave/negotiate → income + runway models produce traced outcomes per path.
4. Pay-down-debt vs invest → debt and investment engines produce traced outcomes for both.
5. Option needs an assumption (inflation rate) sourced from config → trace records it as an explicit
   assumption; outcome is fully traceable → `success`.

**Negative (5) — must NOT happen:**

1. Returning "buying nets you $40k more" with no trace (untraced figure → Compliance reject).
2. Labeling "wait" as the best option (ranking/deciding → reject).
3. Filling a missing down-payment with a guessed value to make a clean number (→ must `needs_data`).
4. Computing a projection in prose instead of via Tool Execution (→ reject; must be deterministic + traced).
5. Calling Tool Execution or Tradeoff directly instead of via the Orchestrator (→ forbidden).

**Edge cases (5):**

1. One option can't be modeled (missing input) but others can → model the rest; `needs_data` for that one.
2. Engine returns a degenerate result (e.g. unaffordable at any timeline) → report it honestly with the trace.
3. Engine down → `blocked`; deterministic fallback; no guessed outcome.
4. Two engines disagree on an overlapping figure → surface both with their traces; don't reconcile silently.
5. Inputs change mid-pipeline → escalate to Decision Scientist to `revisit`/re-frame before re-modeling.

---

## 15. Unit Test Matrix

| Class         | Test                              | Expected                                                                |
| ------------- | --------------------------------- | ----------------------------------------------------------------------- |
| Happy path    | all options modeled               | `success`, conf ≥0.75, each outcome has a `calculation_trace`           |
| Missing data  | option lacks decisive input       | `needs_data` for that option; others still modeled                      |
| Confirmation  | engine assumption is a candidate  | `needs_confirmation`; not used until confirmed                          |
| Blocked       | required engine down              | `blocked`; deterministic fallback; no guessed outcome                   |
| Compliance    | outcome figure has no trace       | `compliance_rejected`                                                   |
| Compliance    | output ranks an option as best    | `compliance_rejected` (models, not decides)                             |
| Hallucination | missing input filled with a guess | rejected; must `needs_data` instead                                     |
| Hallucination | projection computed in prose      | rejected; must be Tool Execution + trace                                |
| Confidence    | components present                | object has TA/DC/PQ/EC/GC (+ n/a) + explanation; reflects input quality |
| Escalation    | all options modeled               | `escalated` to Tradeoff (blocking); outcomes + traces attached          |
