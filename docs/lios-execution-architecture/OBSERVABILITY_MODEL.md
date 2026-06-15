# LIOS Observability Model

> **Design/spec only — no code, no Gemini wiring, no runtime, no Vertex, no beta change.** Derived from
> `EXECUTION_ARCHITECTURE.md` (stage contracts + observability events), `EXECUTION_STATE_MACHINE.md`
> (transition events), `docs/lios-agent-specifications/AUDIT_AGENT.md` (the live Audit agent + schema), and
> `LIOS_EVALUATION_FRAMEWORK.md` (the observability gate). This extends the **live** telemetry
> (`analytics.advisor_turns` + `analytics.advisor_turn_metrics` + `GET /v1/admin/advisor-metrics`) to the
> full execution lifecycle; it does not invent a parallel system.

---

## 1. The one rule everything obeys

**Observability never blocks the request path.** Telemetry is best-effort and non-blocking (per
`AUDIT_AGENT.md` §3/§12): a failed write is swallowed, the turn already returned, nothing escalates. Two
sinks, two privacy regimes:

- **Content sink** — `analytics.advisor_turns`, service-role RLS only. The _only_ place content (message,
  raw LLM output, composed response, retrieval payloads) may live.
- **Metadata sink** — application logs / metrics. **Metadata-only, forever.** No message, no LLM output, no
  retrieval payload. Counts, ids, hashes, statuses, timings, token counts — never content.

Trust is a **0-tolerance gate** (`LIOS_EVALUATION_FRAMEWORK.md` §2): observability exists to _prove_ the
gate held after the fact, never to relax it.

---

## 2. What MUST be logged across the lifecycle

One row per turn in the **content sink**; one event per stage feeding it. Each stage of
`EXECUTION_ARCHITECTURE.md` §3 emits its named event. Mark on each signal whether it is **LIVE** today or a
**PLANNED** extension.

| Stage                 | Event                                         | MUST capture                                                                                                                 | Status                                                 |
| --------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 0 Deterministic turn  | `det_turn`                                    | floor served? safe-text id, persisted outcome ids (refs, not content)                                                        | PLANNED (live `llm_status:fallback:*` is the proxy)    |
| 1 Intent Detection    | `intent`                                      | intent, risk_level, domains[], intent_confidence, classifier-vs-fallback                                                     | PLANNED                                                |
| 2 Agent Selection     | `route_plan`                                  | selected agent set, DAG order, parallel groups, the rule that fired                                                          | PLANNED                                                |
| 3 Graph Retrieval     | `graph_plan`                                  | **today: counts** (`graph_edges_available`, `relationships_referenced`); **planned: the node/edge/doc ids actually fetched** | counts LIVE; **retrieval-set ids = NAMED PLANNED GAP** |
| 4 Tool Plan           | `tool_plan`                                   | ordered tool list, each tool's inputs-hash, `calculation_trace` ref                                                          | PLANNED                                                |
| 5 Agent Execution     | `agent_exec` (one per agent + per transition) | agent, `from_state`→`to_state`, outcome, hop_index, confidence components                                                    | transitions PLANNED; per-agent outcome LIVE-adjacent   |
| 6 Conflict Resolution | `conflict`                                    | conflicting agents, ranking math result, down-weight applied, resolved-vs-open                                               | PLANNED                                                |
| 7 Recommendation      | `recommendation`                              | rec ids, evidence refs, rec confidence, evidence-or-nothing verdict                                                          | PLANNED                                                |
| 8 Critic Review       | `critic`                                      | claim ref, verdict (real/refuted), reasons, refutation confidence                                                            | **PLANNED — Critic not built**                         |
| 9 Compliance          | `compliance`                                  | `validator_result` (accept/repair/reject), reasons, `repairs[]`, `fallback_reason`                                           | **LIVE**                                               |
| 10 Response Assembly  | `compose`                                     | final-response confidence, content-ref, composed-from sources                                                                | partial (confidence LIVE; source map PLANNED)          |
| — Audit               | (the sink)                                    | assembles all events into the turn record + rollups                                                                          | **LIVE**                                               |

---

## 3. The per-turn execution record (extends the live record)

The live `analytics.advisor_turns` payload (`AUDIT_AGENT.md` §5) is the spine. The execution layer **adds**
fields; it does not replace any. **Bold = PLANNED addition**; the rest is LIVE.

```jsonc
{
  "turn_record": {
    "turn_id": "",
    "user_id": "",
    "llm_status": "enhanced | fallback:<reason> | disabled", // LIVE
    "validator_result": "accept | repair | reject | n/a", // LIVE
    "repairs": [], // LIVE
    "fallback_reason": "", // LIVE
    "stages_ms": {}, // per-stage timing                  // LIVE
    "tokens": { "prompt": 0, "completion": 0 }, // LIVE
    "graph_edges_available": 0, // LIVE (count)
    "relationships_referenced": 0, // LIVE (count)
    "confidence": {}, // per-agent confidence objects      // LIVE

    "intent": {
      "intent": "",
      "risk_level": "",
      "domains": [],
      "confidence": 0,
      "source": "classifier|fallback",
    }, // PLANNED
    "route_plan": { "agents": [], "dag_order": [], "parallel_groups": [], "rule_id": "" }, // PLANNED
    "graph_plan": {
      "fetched_node_ids": [],
      "fetched_edge_ids": [],
      "fetched_doc_ids": [],
      "skipped": false,
    }, // PLANNED (the retrieval-set gap)
    "tool_plan": [{ "tool": "", "inputs_hash": "", "calculation_trace_ref": "", "latency_ms": 0 }], // PLANNED
    "agent_exec": [
      {
        "agent": "",
        "from_state": "",
        "to_state": "",
        "outcome": "",
        "hop_index": 0,
        "confidence": {},
      },
    ], // PLANNED (transitions)
    "conflict": {
      "pairs": [],
      "ranking_result": "",
      "down_weight": 0,
      "resolution": "resolved|open",
    }, // PLANNED
    "recommendations": [{ "rec_id": "", "evidence_refs": [], "confidence": 0 }], // PLANNED
    "critic": { "claim_ref": "", "verdict": "real|refuted", "reasons": [], "confidence": 0 }, // PLANNED (Critic unbuilt)
    "compose": { "final_confidence": 0, "content_ref": "", "composed_from": [] }, // partial
  },
}
```

Content (message / raw LLM output / composed response / retrieval payloads) lives **only** in this
service-role-RLS row. Everything outside it references by id/hash — never by content. The record is
**analytics, not truth** (`AUDIT_AGENT.md` §2): no downstream agent may read it as a source of fact.

---

## 4. Event taxonomy

The canonical event names, in lifecycle order, are exactly those in `EXECUTION_ARCHITECTURE.md` §3:

`det_turn` · `intent` · `route_plan` · `graph_plan` · `tool_plan` · `agent_exec` · `conflict` ·
`recommendation` · `critic` · `compliance` · `compose`.

Each event carries: `turn_id`, `stage`, `event`, `ts`, `latency_ms`, and a stage-specific metadata body
(see §2). `agent_exec` additionally fires **once per state transition** (`from_state`, `to_state`,
`outcome`, `hop_index`) so a turn's full execution trace is reconstructable from
`EXECUTION_STATE_MACHINE.md` §7. Events are append-only inputs to the Audit sink; they never branch the
request path.

---

## 5. Privacy rules (non-negotiable)

1. **Metadata-only logs.** Application logs/metrics carry ids, hashes, counts, statuses, timings, tokens —
   never message/LLM-output/retrieval content (`AUDIT_AGENT.md` §3, §13).
2. **Content only in the RLS table.** `analytics.advisor_turns` is service-role RLS; one tenant can never
   read another's turns.
3. **Ids/hashes outside, content inside.** `graph_plan` logs `fetched_edge_ids` and `tool_plan` logs
   `inputs_hash` (not raw inputs) in the metadata sink; the resolved values live only in the content row.
4. **No cross-tenant aggregation that re-identifies.** Rollups are tenant-scoped or fully aggregated.
5. **Best-effort, idempotent, non-blocking.** Duplicate `turn_id` → one record; partial envelope → record
   present fields, **never fabricate** missing ones (`AUDIT_AGENT.md` §14 edge cases).

---

## 6. Mapping onto the LIVE system

| Live artifact                                       | Role today                                                                                                                                           | Execution-layer extension                                                                                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `analytics.advisor_turns`                           | per-turn content + metadata row (service-role RLS)                                                                                                   | gains the §3 PLANNED fields (intent, route_plan, graph_plan retrieval-set, tool_plan, agent_exec transitions, conflict, recs, critic, compose) |
| `analytics.advisor_turn_metrics`                    | rollup view: fallback rate, validation failure rate, avg+p95 latency, stages_ms, tokens, graph_edges_available, validator_result/repairs, confidence | adds rollups over the new events (route distribution, tool utilization, retrieval-set coverage, critic verdict rate)                           |
| `GET /v1/admin/advisor-metrics`                     | serves the rollups                                                                                                                                   | serves the extended rollups; same shape, more dimensions                                                                                       |
| Audit agent (`_finish`/`_persist`, `cost_meter.py`) | assembles + writes the record, non-blocking                                                                                                          | assembles the extended record; same non-blocking discipline                                                                                    |

---

## 7. LIVE vs PLANNED summary

- **LIVE today:** `compliance` (validator_result/reasons/repairs), `fallback_reason`, `stages_ms`, `tokens`,
  graph **counts**, per-agent `confidence`, the content/metadata split, and the metrics view + admin
  endpoint.
- **PLANNED:** `intent`/`route_plan`/`tool_plan`/`conflict`/`recommendation`/`compose`-source events;
  `agent_exec` **per-transition** logging; and — the headline named gap — the **GraphRAG retrieval set**:
  today only counts (`graph_edges_available`, `relationships_referenced`), planned the **actual node/edge/doc
  ids fetched** (`LIOS_EVALUATION_FRAMEWORK.md` §11 gap #5).
- **PLANNED (blocked on a missing agent):** `critic` — the Critic is not built, so its event has no producer
  yet.

---

## 8. Invariants

1. Telemetry never blocks, slows materially, or breaks the request path; a failed write is swallowed.
2. Content lives only in the service-role-RLS table; all other logs are metadata-only.
3. No cross-tenant read of `analytics.advisor_turns`, ever.
4. Every lifecycle stage and every agent state transition emits its named event; a turn's reasoning is fully
   reconstructable from the record.
5. The turn record is analytics, never a truth source for any downstream agent.
6. Missing fields are recorded as null — never fabricated.
