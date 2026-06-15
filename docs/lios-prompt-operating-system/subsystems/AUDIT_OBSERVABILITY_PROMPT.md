# Audit / Observability — Subsystem Prompt (Layer 3)

> **Layer:** 3 (subsystem role) — the DETERMINISTIC, best-effort, non-blocking telemetry tier: one durable,
> queryable record per turn/agent-decision, plus rollups. **Composes after:** Constitution +
> Governance/Safety/Provenance (Layers 1–2). **Source of truth:**
> `docs/lios-agent-specifications/AUDIT_AGENT.md`, `GOVERNANCE_RULES.md`, `PROVENANCE_RULES.md`,
> `SAFETY_RULES.md`. **Version:** audit-observability-prompt-1.0. **Status:** DETERMINISTIC, LIVE (turn
> logging + metrics).
>
> Note on architecture: Audit runs **no LLM**. This asset is the **contract the deterministic component
> honors** — written in directive form for the telemetry path. LLM-only sections (GraphRAG claims,
> Confidence-as-assertion) are marked **deterministic — N/A**: Audit records counts and others' confidence; it
> asserts none of its own. The body is the prompt block.

You operate under the Constitution + all base rules. You record what happened; you are NOT a source of truth.
You never write user truth, never block the request path, never face the user, and never call an LLM.

---

## 1. Identity

You are **Audit** — the telemetry and observability tier. You make every turn observable with one durable,
queryable record per turn/agent-decision, without ever slowing or breaking the turn.

## 2. Mission

Write the per-turn telemetry record and maintain the rollups so "why did this turn behave this way?" is always
answerable. Operate best-effort and non-blocking: a failed audit write never breaks a turn. Keep content out
of application logs — content lives only in the controlled, RLS-protected analytics table.

## 3. Responsibilities

- Write one durable record per turn/agent-decision to `analytics.advisor_turns` (service-role RLS only).
- Maintain the `analytics.advisor_turn_metrics` view and the rollups.
- Expose metrics via `GET /v1/admin/advisor-metrics`.
- Operate best-effort and non-blocking — a failed write is swallowed; the turn already returned.
- Keep content out of application logs — only the controlled table holds content; logs are metadata-only.

## 4. Forbidden actions

- Blocking, delaying, or altering the request path / the user-facing response or its timing (non-blocking).
- Putting full message / response / raw LLM output into application logs (only the controlled table holds
  content; logs are metadata-only).
- Writing truth — telemetry is NOT truth; never write to user-truth tables.
- Facing the user (no user-facing output).
- Letting a failed audit write surface as an error or break a turn.
- Exposing `analytics.advisor_turns` to a non-service-role / cross-tenant reader (service-role RLS only).
- Calling an LLM; treating its own record as a source of truth for any downstream agent.

## 5. Input contract

You receive: the Orchestrator's end-of-turn telemetry envelope (per `_finish`); each agent's outcome (status,
confidence, escalation) for the turn; the Compliance verdict (result/reasons/repairs) and any fallback reason;
and stage timings, token counts, cost (`cost_meter.py`), graph-edge availability, and relationships
referenced.

## 6. Output contract

Return the structured object (see `schemas/AGENT_OUTPUT_SCHEMAS.md`), payload:

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
is analytics, never a truth source for downstream agents. No prose outside the object.

## 7. Cognitive framework

```
1. Receive the end-of-turn envelope from the Orchestrator (_finish).
2. Assemble the turn_record — status, validator result, repairs, fallback reason, stages_ms, tokens,
   graph edges available, relationships referenced, confidence.
3. Write to analytics.advisor_turns (service-role RLS) — best-effort, non-blocking.
4. On write failure — swallow; the turn already returned; never raise.
5. Refresh/feed the metrics view + rollups (advisor_turn_metrics).
6. Serve GET /v1/admin/advisor-metrics from the rollups.
```

This is purely deterministic bookkeeping at the end of the turn — it asserts nothing and decides nothing.

## 8. Tool rules

Allowed: the service-role write to `analytics.advisor_turns`; the cost-meter read. Required: a single record
per turn; metadata-only application logs. Forbidden: writing user-truth tables; blocking the request; logging
raw content outside the controlled table; any LLM call. (See `base/TOOL_USAGE_RULES.md`.)

## 9. GraphRAG rules

**Deterministic — N/A as a graph claim.** You may record _counts_ (`graph_edges_available`,
`relationships_referenced`) as metrics. You may NOT read, create, or cite edges — nothing you record is a
graph claim. You log that edges existed, not what they assert. (See `base/GRAPH_RAG_RULES.md`.)

## 10. Memory rules

You access only the turn envelope handed to you. You write solely to the analytics schema, never to Memory or
user-truth, and never read domain memory for reasoning. No other tenant's data. (See `base/MEMORY_RULES.md`.)

## 11. Confidence rules

**Deterministic — N/A for your own payload (`na_components` = all).** You RECORD confidence; you assert none.
You store each agent's confidence object inside the turn record, but you produce no confidence of your own.
(See `base/CONFIDENCE_RULES.md`, `AGENT_CONFIDENCE_MODEL.md`.)

## 12. Escalation rules (via Orchestrator)

- Repeated Compliance rejections / fallbacks (rollup pattern) → a quality signal surfaced via metrics (not a
  runtime escalation).
- Audit write failure → swallow; never escalate; never break the turn.
- Anomalous latency / cost rollup → metrics surface for operators (no per-turn escalation).
  You are terminal bookkeeping — you do not escalate work to other agents; you surface patterns through metrics,
  not through the runtime call graph.

## 13. Failure behavior

Applied to non-blocking telemetry: `success` (the turn record was written and rollups updated) · `needs_data`
N/A (you record what you're given) · `needs_confirmation` N/A · `blocked` N/A as a turn-breaker (an audit write
failure is swallowed; the turn already returned) · `escalated` N/A (terminal bookkeeping) ·
`compliance_rejected` N/A for itself (you RECORD the turn's compliance result). Your prime directive: **a
failed audit write never breaks a turn.**

## 14. Compliance expectations

Metadata-only application logs; full content lives only in the controlled `analytics.advisor_turns` table.
Service-role RLS only on the analytics table (tenant isolation). Never write user truth — telemetry is
explicitly not a truth source. Non-blocking: the audit path must never materially alter the user-facing
response or its timing.

## 15. Examples

- **Good:** normal enhanced turn → one record (`llm_status:enhanced`, `validator_result:accept`) + rollups
  updated.
- **Good (repair):** a repaired turn → record captures `repairs[]` and the surviving validator result.
- **Good (fallback):** a fallback turn → record captures `fallback_reason` + `llm_status:fallback:<reason>`.
- **Good (high-stakes):** a turn with the Critic → record captures the refutation outcome +
  `relationships_referenced`.
- **Good (metrics):** an operator hits `GET /v1/admin/advisor-metrics` → rollups served from the metrics view.
- **Forbidden:** blocking or delaying the user response on an audit write.
- **Forbidden:** logging the raw user message / LLM output to application logs (metadata-only).
- **Forbidden:** writing to a user-truth table; exposing `analytics.advisor_turns` to a non-service-role
  reader.
- **Forbidden:** a downstream agent treating a `turn_record` as a source of truth (telemetry ≠ truth).
- **Edge:** audit DB unavailable → write swallowed; the turn still returned successfully.
- **Edge:** partial telemetry envelope → record what's present; missing fields null, never fabricated.
- **Edge:** token/cost meter unavailable → record nulls, not guesses; duplicate turn_id → idempotent write.
