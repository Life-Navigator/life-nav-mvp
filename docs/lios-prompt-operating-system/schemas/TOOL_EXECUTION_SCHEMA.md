# Tool Execution Schema (Layer 8)

> **Layer:** 8 (output contract) for the Tool Execution Agent — the only execution tier that computes
> numbers-with-a-trace or performs approved writes. DETERMINISTIC; no LLM. Wraps the common envelope
> (`AGENT_OUTPUT_SCHEMA.md`); only the `payload` is defined here.
> **Source of truth:** `docs/lios-agent-specifications/TOOL_EXECUTION_AGENT.md`, `AGENT_OUTPUT_SCHEMAS.md`,
> `AGENT_CONFIDENCE_MODEL.md`.
> **Version:** tool-execution-schema-1.0.

The math is exact, so `confidence` reports **input quality + assumptions used**, never the arithmetic:
weights wTA 0.35, wDC 0.30, wPQ 0.25, wEC 0.10 (GC dropped/renormalized; PQ=1 for pure deterministic
computation with full inputs).

---

## Schema

The common envelope (`AGENT_OUTPUT_SCHEMA.md`) with `payload` being ONE of:

**A — a computation (result + calculation_trace):**

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

**B — an approved write (write_receipt):**

```json
{
  "write_receipt": {
    "table": "",
    "op": "insert | update | upsert",
    "precondition_satisfied": true,
    "provenance": { "provenance_type": "calculated | on_record | user_confirmed", "source": "" },
    "user_id_source": "jwt",
    "records_written": 0
  }
}
```

Every computed number is reproducible from its `calculation_trace`; every write reports a satisfied
precondition + provenance + a JWT-sourced `user_id`.

## Field rules

| Field                                  | Rule                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `result`                               | the typed deterministic output of a registered calculator/resolver                               |
| `calculation_trace.tool`               | the named deterministic engine that ran (affordability, retirement, debt, cash-flow, net-worth…) |
| `calculation_trace.inputs` / `output`  | bounded, typed inputs and the exact output                                                       |
| `calculation_trace.steps`              | the deterministic step sequence (auditable, reproducible)                                        |
| `calculation_trace.assumptions`        | every assumption the run relied on — surfaced, never hidden                                      |
| `write_receipt.table` / `op`           | the approved save-path target + operation (no ad-hoc SQL, no arbitrary table)                    |
| `write_receipt.precondition_satisfied` | MUST be `true` — a deterministic precondition or confirmation gate cleared before any write      |
| `write_receipt.provenance`             | required on every write (type + source per the PQ ladder)                                        |
| `write_receipt.user_id_source`         | always `"jwt"` — never a body-supplied `user_id`                                                 |
| `confidence` (envelope)                | reflects input quality + assumptions, not the math; TA/DC/PQ/EC (+ GC n/a) + explanation         |

## Status → next

| status                | meaning / next                                                                        |
| --------------------- | ------------------------------------------------------------------------------------- |
| `success`             | typed result + `calculation_trace`, or an approved `write_receipt`                    |
| `needs_data`          | a required calculation input is missing (named, ranked); no guessed input substituted |
| `needs_confirmation`  | a write needs user confirmation not yet given (the LLM cannot confirm)                |
| `blocked`             | engine/save-path down, untyped/unapproved request, or unmet write precondition        |
| `escalated`           | rare — only when the requester must route the outcome elsewhere                       |
| `compliance_rejected` | set after the gate (e.g. a trace exposing a non-allowed number)                       |

## Invariants

1. **Exact, deterministic results** — no LLM ever runs here; the same inputs always reproduce the same output.
2. **Every computed number carries a `calculation_trace`** — the trace IS the number's license (satisfies the allowed-numbers rule for derived values); no trace ⇒ unsupported number ⇒ reject.
3. **Every write has a satisfied precondition + provenance + JWT `user_id`** — the LLM never persists; it can only request, and the request must clear a deterministic check.
4. **Assumptions are always surfaced** — an unstated assumption is a hidden fabrication risk; assumption-laden inputs lower DC/PQ and tip toward `needs_data` rather than a confident result on guesses.
5. Approved save paths only — no ad-hoc/unbounded ops; tenant isolation (RLS) on every read/write.
6. No `success` below 0.75; a missing input yields `needs_data`, never a fabricated value.
7. Makes no graph claim and authors no user-facing language.
