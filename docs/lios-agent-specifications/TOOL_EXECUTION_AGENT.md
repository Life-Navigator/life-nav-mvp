# Tool Execution Agent — Specification

> Agent specification. Specification only — no code, no prompts, no runtime. Inherits the shared contracts
> (`AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`,
> `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`). **DETERMINISTIC, LIVE** as the engines. Maps
> to the finance engines (affordability/retirement/debt/cash-flow/net-worth), `recommendations_os.RecommendationOS.write`,
> the domain writers, and `cost_meter.py`.

---

## 1. Identity

- **Agent Name:** Tool Execution
- **Mission:** Run the deterministic calculations and the approved writes on behalf of agents — exactly,
  traceably, and only through sanctioned paths — so the LLM can lead without ever touching the math or the DB.
- **Purpose:** Be the only execution tier (alongside RelationshipManager/RecommendationOS) permitted to
  mutate data, and the sole producer of numbers-with-a-trace. It computes typed results with a
  `calculation_trace`, or it performs an approved write and returns a `write_receipt` — nothing else.
- **Primary Responsibilities:**
  1. Run deterministic calculators/resolvers requested by agents and return typed results.
  2. Attach a `calculation_trace` (tool, inputs, output, steps, assumptions) to every computed number.
  3. Perform approved writes only — via sanctioned save paths — setting `user_id` from the JWT.
  4. Record provenance on every write and return a `write_receipt`.
  5. Report input quality + assumptions used (the math is exact; the inputs may not be).

---

## 2. Ownership

**Owns:**

- deterministic calculation results + their `calculation_trace`
- the execution of APPROVED writes (the sanctioned save paths)
- the `write_receipt` (what was written, where, with what provenance, under which user_id)
- the cost meter accounting around executed work

**Does NOT own:**

- deciding _whether_ a number matters (→ domain agents)
- recommendations content (it executes `RecommendationOS.write`; the Recommendation Agent authors)
- user-facing language (→ Response Composer)
- compliance verdicts (→ Compliance)
- facts/edges retrieval (→ Memory / GraphRAG)
- cross-domain decisions (→ Decision Scientist)

---

## 3. Boundaries (prohibited)

- Cannot run an LLM — Tool Execution is purely deterministic.
- Cannot perform a write the LLM "requested" without a deterministic precondition or an explicit
  confirmation gate being satisfied (the LLM never persists; it can only request, and the request must clear
  a deterministic check).
- Cannot run untyped or unbounded operations — every op has a typed signature and bounded inputs.
- Cannot write outside the approved save paths (no ad-hoc SQL, no arbitrary table mutation).
- Cannot omit `user_id` (always from the JWT) or provenance on a write.
- Cannot answer the user directly or call another agent directly.
- Cannot cross tenants (RLS on every write/read).

---

## 4. Inputs (allowed sources)

- A typed tool/calculation request from an agent (tool name + bounded, typed inputs).
- A typed approved-write request (target save path + payload), with its deterministic precondition.
- The authenticated `UserContext` (JWT-derived `user_id`) for scoping every read/write.
- Bounded facts from Memory as calculation inputs (read) — never raw rows it fetches itself.

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Tool Execution `payload` is one of:

```json
{
  "result": {},
  "calculation_trace": {
    "tool": "",
    "inputs": {},
    "output": {},
    "steps": [],
    "assumptions": [{ "label": "", "value": "" }]
  }
}
```

or, for an approved write:

```json
{
  "write_receipt": {
    "save_path": "",
    "target": "",
    "user_id": "",
    "records_written": 0,
    "provenance": { "provenance_type": "calculated|on_record|user_confirmed", "source": "" },
    "precondition_satisfied": true
  }
}
```

Every computed number is reproducible from its `calculation_trace`. Every write reports `user_id` +
provenance + that its precondition was satisfied.

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Validate request        — is the tool/write typed, bounded, and approved? no → blocked.
Step 2  Bind tenant             — set user_id from the JWT; scope reads/writes (RLS).
Step 3  Check inputs            — required inputs present? missing → needs_data (named, ranked).
Step 4  (Write only) precond    — is the deterministic precondition / confirmation satisfied? no → blocked.
Step 5  Execute deterministically — run the calculator/resolver or the approved save path.
Step 6  Build the trace/receipt — emit calculation_trace (compute) or write_receipt (write).
Step 7  Record assumptions      — list every assumption the deterministic run relied on.
Step 8  Report confidence       — exact math; confidence reflects INPUT quality + assumptions, not the math.
Step 9  Return                   — result+trace or receipt; never advise, never author language.
```

The agent **executes**; it never reasons about meaning, never authors text, and never decides domain truth.

---

## 7. Tool Rules

- **Allowed:** the registered deterministic calculators/resolvers (affordability, retirement projection,
  debt, cash-flow, net-worth composition) and the registered approved save paths
  (`RecommendationOS.write`, the domain writers), plus cost-meter accounting.
- **Required:** a typed signature + bounded inputs per op; a `calculation_trace` per computed number; a
  `write_receipt` + provenance + JWT `user_id` per write; a satisfied precondition before any write.
- **Forbidden:** any LLM call; any unapproved/ad-hoc write; untyped/unbounded ops; a write on the LLM's word
  alone without a deterministic precondition.

---

## 8. GraphRAG Rules

- **May:** read bounded facts as calculation inputs (via Memory). Edge _projection/sync_ from committed truth
  is a separate sanctioned sync, not this agent inventing edges.
- **May not:** create, infer, or persist edges as part of a calculation; cite a relationship; assert any
  graph claim. Tool Execution computes and writes data; it does not make relationship claims.

---

## 9. Memory Rules

- **Can access:** the bounded inputs an agent passes it (read), tenant-scoped, as calculation inputs.
- **Cannot access:** raw DB rows it fetches on its own beyond a sanctioned read, another tenant's data, or
  any secret beyond what an approved save path legitimately needs. It writes only via approved paths.

---

## 10. Confidence Model

Uses the global formula (`AGENT_CONFIDENCE_MODEL.md`) with Tool Execution weights. The math is exact — so
"confidence" here reports **input quality and assumptions used**, never the arithmetic:

| Weight                   | Value | Rationale                                                   |
| ------------------------ | ----- | ----------------------------------------------------------- |
| wTA (tool availability)  | 0.35  | the tool/save path must be available and must have returned |
| wDC (data completeness)  | 0.30  | a calculation is only as good as its inputs                 |
| wPQ (provenance quality) | 0.25  | on_record/calculated inputs > user_stated > assumed         |
| wEC (evidence coverage)  | 0.10  | the trace IS the evidence; coverage is high by construction |
| wGC (graph)              | N/A   | Tool Execution makes no graph claim                         |

`confidence = renormalize(0.35·TA + 0.30·DC + 0.25·PQ + 0.10·EC)` with GC dropped (N/A). For a pure
deterministic computation with full inputs, `PQ = 1`. No `success` below 0.75 — heavily assumption-laden
inputs lower DC/PQ and tip the result into `needs_data` (name the missing input) rather than a confident
result resting on guesses.

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                                                | → To                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| A required calculation input is missing                | `needs_data` (named) — back to the requesting agent / Missing Data |
| A write's deterministic precondition is unmet          | `blocked` (not escalation)                                         |
| The result implies a recommendation should be authored | Recommendation Agent (the requester escalates)                     |
| A required engine/save path is down                    | `blocked`                                                          |

Tool Execution rarely escalates ownership — it executes or it blocks/needs_data. It never self-escalates and
never resolves domain meaning.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`):

- `success` — typed result + `calculation_trace`, or an approved `write_receipt`.
- `needs_data` — a required calculation input is missing (named, ranked); no guessed input substituted.
- `needs_confirmation` — a write requires user confirmation that hasn't been given (the LLM cannot confirm).
- `blocked` — engine/save path down, an untyped/unapproved request, or an unmet write precondition.
- `escalated` — rare; only when the requester must route the outcome elsewhere.
- `compliance_rejected` — set after the gate (e.g. a trace exposing a non-allowed number).
  No guessing — a missing input yields `needs_data`, never a fabricated input or an unsupported number.

---

## 13. Compliance Requirements

- Every surfaced number traces to a `calculation_trace` (this is what satisfies the allowed-numbers rule for
  derived values — the trace IS the number's license).
- No LLM-driven write without a satisfied deterministic precondition / confirmation (the LLM never persists).
- Approved save paths only; `user_id` from the JWT + provenance on every write.
- No persistence outside the sanctioned paths; tenant isolation (RLS).
- Assumptions are always listed (an unstated assumption is a hidden fabrication risk).

---

## 14. Example Scenarios

**Positive (5):**

1. Finance Agent requests an affordability calc → returns the figure + a full `calculation_trace` with
   inputs/steps/assumptions → `success`.
2. Retirement projection with complete inputs → exact result, `PQ=1`, high TA → `success`.
3. Recommendation Agent's accepted rec is written via `RecommendationOS.write` → `write_receipt` with
   provenance + JWT `user_id`.
4. Domain writer persists a user-confirmed fact via an approved path → receipt, `precondition_satisfied:true`.
5. Cash-flow calc with one assumed input → returns the result but lists the assumption and lowers DC/PQ.

**Negative (5) — must NOT happen:**

1. Writing a row because the LLM "said to" with no deterministic precondition (→ forbidden; needs precond).
2. Returning a number with no `calculation_trace` (→ unsupported number; reject).
3. Running an ad-hoc SQL update outside an approved save path (→ forbidden).
4. Writing without `user_id` from the JWT or without provenance (→ forbidden).
5. Calling an LLM to "interpret" inputs (→ Tool Execution is deterministic only).

**Edge cases (5):**

1. Calculator is down → `blocked`; the requester falls back to deterministic text.
2. Inputs partially present → `needs_data` naming the missing input; no guessed value.
3. Write precondition (e.g. user confirmation) absent → `needs_confirmation`, nothing persisted.
4. Result is exact but rests on an assumed inflation rate → assumption listed; confidence reflects it.
5. Duplicate write request → idempotent receipt; no double-write.

---

## 15. Unit Test Matrix

| Class         | Test                           | Expected                                                                       |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| Happy path    | complete-input calc            | `success`; result + full `calculation_trace`; high TA                          |
| Happy path    | approved write                 | `write_receipt` with JWT `user_id` + provenance + precond satisfied            |
| Missing data  | input absent                   | `needs_data` (named, ranked); no guessed input                                 |
| Confirmation  | write needs user confirm       | `needs_confirmation`; nothing persisted                                        |
| Block         | engine down                    | `blocked`; safe fallback; no partial write                                     |
| Security      | write without JWT `user_id`    | rejected; never persisted                                                      |
| Security      | ad-hoc / unapproved write path | rejected; only sanctioned save paths execute                                   |
| Hallucination | number without a trace         | rejected (unsupported number)                                                  |
| Assumptions   | assumed input used             | assumption listed in trace; DC/PQ lowered                                      |
| Confidence    | exact math, thin inputs        | confidence reflects inputs/assumptions, not the arithmetic; no `success` <0.75 |
