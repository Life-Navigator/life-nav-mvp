# Audit Agent — Specification

> Agent specification. Specification only — no code, no prompts, no runtime. Inherits the shared contracts
> (`AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`,
> `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`). **DETERMINISTIC, LIVE** (turn logging +
> metrics). Maps to `advisor_orchestrator._finish` / `_persist`, the `analytics` schema, and
> `cost_meter.py`.

---

## 1. Identity

- **Agent Name:** Audit
- **Mission:** Make every turn observable — one durable, queryable record per turn/agent-decision — without
  ever slowing or breaking the turn.
- **Purpose:** Write the per-turn telemetry record and maintain the rollups, so "why did this turn behave
  this way?" is always answerable. It records what happened; it is **not** a source of truth.
- **Primary Responsibilities:**
  1. Write one durable record per turn/agent-decision to `analytics.advisor_turns` (service-role RLS only).
  2. Maintain the `analytics.advisor_turn_metrics` view and the rollups.
  3. Expose metrics via `GET /v1/admin/advisor-metrics`.
  4. Operate best-effort and non-blocking — a failed write never breaks a turn.
  5. Keep content out of application logs — only the controlled table holds content; logs are metadata-only.

---

## 2. Ownership

**Owns:**

- the per-turn telemetry record (`analytics.advisor_turns`)
- the metrics view (`analytics.advisor_turn_metrics`) and rollups
- the admin metrics endpoint surface (`GET /v1/admin/advisor-metrics`)
- the "telemetry, not truth" discipline

**Does NOT own:**

- any domain truth (facts, goals, recommendations, the Life Model)
- the request path / response (→ Orchestrator)
- compliance verdicts (→ Compliance) or content authoring (→ Advisor/Composer)
- persistence of user truth (that is approved writers via Tool Execution, never Audit)

---

## 3. Boundaries (prohibited)

- Cannot block the request path — it is best-effort and non-blocking.
- Cannot put full message / response / raw LLM output into application logs (only the controlled table holds
  content; logs are metadata-only).
- Cannot write truth — telemetry is **not** truth; it never writes to user-truth tables.
- Cannot face the user (no user-facing output).
- Cannot let a failed audit write surface as an error or break a turn.
- Cannot be read by another tenant — `analytics.advisor_turns` is service-role RLS only.

---

## 4. Inputs (allowed sources)

- The Orchestrator's end-of-turn telemetry envelope (per `_finish`).
- Each agent's outcome (status, confidence, escalation) for the turn.
- The Compliance verdict (result/reasons/repairs) and any fallback reason.
- Stage timings, token counts, cost (`cost_meter.py`), graph-edge availability, relationships referenced.

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Audit `payload`:

```json
{
  "turn_record": {
    "turn_id": "",
    "user_id": "",
    "llm_status": "enhanced | fallback:<reason> | disabled",
    "validator_result": "accept | repair | reject | n/a",
    "repairs": [],
    "fallback_reason": "",
    "stages_ms": {},
    "tokens": { "prompt": 0, "completion": 0 },
    "graph_edges_available": 0,
    "relationships_referenced": 0,
    "confidence": {}
  }
}
```

The record holds the controlled content/metadata for the turn; logs elsewhere carry metadata only. The record
is analytics, never a truth source for downstream agents.

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Receive the end-of-turn envelope from the Orchestrator (_finish).
Step 2  Assemble the turn_record — status, validator result, repairs, fallback reason, stages_ms, tokens,
        graph edges available, relationships referenced, confidence.
Step 3  Write to analytics.advisor_turns (service-role RLS) — best-effort, non-blocking.
Step 4  On write failure — swallow; the turn already returned; never raise.
Step 5  Refresh/feed the metrics view + rollups (advisor_turn_metrics).
Step 6  Serve GET /v1/admin/advisor-metrics from the rollups.
```

It is purely deterministic bookkeeping at the end of the turn — it asserts nothing and decides nothing.

---

## 7. Tool Rules

- **Allowed:** the service-role write to `analytics.advisor_turns`; the cost meter read.
- **Required:** a single record per turn; metadata-only application logs.
- **Forbidden:** writing user-truth tables; blocking the request; logging raw content outside the controlled
  table; any LLM call.

---

## 8. GraphRAG Rules

- **May:** record _counts_ (graph_edges_available, relationships_referenced) as metrics.
- **May not:** read, create, or cite edges; nothing it records is a graph claim. It logs that edges existed,
  not what they assert.

---

## 9. Memory Rules

- **Can access:** the turn envelope handed to it. It writes only to the analytics schema, never to Memory or
  user-truth.
- **Cannot access:** another tenant's data; it never reads domain memory for reasoning.

---

## 10. Confidence Model

- Audit **records** confidence; it does not **assert** any. Confidence model is **N/A** for its own payload
  (`na_components` = all) — it stores each agent's confidence object in the turn record but produces none of
  its own. (See `AGENT_CONFIDENCE_MODEL.md`.)

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                                                     | → To / Action                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| Repeated Compliance rejections / fallbacks (rollup pattern) | quality signal surfaced via metrics (not a runtime escalation) |
| Audit write failure                                         | swallow; never escalate; never break the turn                  |
| Anomalous latency / cost rollup                             | metrics surface for operators (no per-turn escalation)         |

Audit is terminal bookkeeping — it does not escalate work to other agents; it surfaces patterns through
metrics, not through the runtime call graph.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`), applied to non-blocking telemetry:

- `success` — the turn record was written and rollups updated.
- `needs_data` — n/a (it records what it's given).
- `needs_confirmation` — n/a.
- `blocked` — n/a as a turn-breaker: an audit write failure is swallowed; the turn already returned.
- `escalated` — n/a (terminal bookkeeping).
- `compliance_rejected` — n/a for itself; it _records_ the turn's compliance result.
  Its prime directive: **a failed audit write never breaks a turn.**

---

## 13. Compliance Requirements

- Metadata-only application logs; full content lives only in the controlled `analytics.advisor_turns` table.
- Service-role RLS only on the analytics table (tenant isolation).
- Never writes user truth; telemetry is explicitly not a truth source.
- Non-blocking: the audit path must never alter the user-facing response or its timing materially.

---

## 14. Example Scenarios

**Positive (5):**

1. Normal enhanced turn → one record (`llm_status:enhanced`, `validator_result:accept`) + rollups updated.
2. Repaired turn → record captures `repairs[]` and the surviving validator result.
3. Fallback turn → record captures `fallback_reason` + `llm_status:fallback:<reason>`.
4. High-stakes turn with Critic → record captures the refutation outcome + relationships_referenced.
5. Operator hits `GET /v1/admin/advisor-metrics` → rollups served from the metrics view.

**Negative (5) — must NOT happen:**

1. Blocking or delaying the user response on an audit write (→ forbidden; non-blocking).
2. Logging the raw user message / LLM output to application logs (→ forbidden; metadata-only).
3. Writing to a user-truth table (→ forbidden; analytics only).
4. Exposing `analytics.advisor_turns` to a non-service-role reader (→ forbidden; RLS).
5. A downstream agent treating a turn_record as a source of truth (→ forbidden; telemetry ≠ truth).

**Edge cases (5):**

1. Audit DB unavailable → write swallowed; the turn still returned successfully.
2. Partial telemetry envelope → record what's present; never fabricate missing fields.
3. Token/cost meter unavailable → record nulls, not guesses.
4. Duplicate turn_id → idempotent write; one record per turn.
5. Very large content → stored in the controlled table; logs still metadata-only.

---

## 15. Unit Test Matrix

| Class          | Test                           | Expected                                                   |
| -------------- | ------------------------------ | ---------------------------------------------------------- |
| Happy path     | enhanced turn                  | one record; correct status/validator; rollups updated      |
| Missing data   | partial envelope               | record present fields; missing fields null, not fabricated |
| Conflict       | duplicate turn_id              | idempotent; exactly one record                             |
| Compliance     | metadata-only logs             | no raw content in application logs; content only in table  |
| Compliance     | RLS                            | analytics.advisor_turns readable only by service role      |
| Hallucination  | n/a (records, doesn't assert)  | never invents metrics; nulls on missing                    |
| Non-blocking   | audit write fails              | swallowed; turn already returned; no error to user         |
| Truth boundary | downstream reads a turn_record | not a truth source; never used as fact input               |
| Metrics        | GET /v1/admin/advisor-metrics  | rollups served from advisor_turn_metrics view              |
| Confidence     | any turn                       | none asserted; records others'; na_components = all        |
