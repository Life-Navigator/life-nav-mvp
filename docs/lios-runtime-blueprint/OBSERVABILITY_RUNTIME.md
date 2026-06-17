# LIOS Observability — Runtime Plan

> **Implementation planning only — no code, no runtime change, no deploy, no Gemini wiring, no beta change.**
> The concrete, build-facing plan for _extending the LIVE advisor telemetry_ to the full LIOS execution
> lifecycle. Anchored to the live sink (`analytics.advisor_turns` + `analytics.advisor_turn_metrics` +
> `GET /v1/admin/advisor-metrics`, `CURRENT_STATE_AUDIT.md` §5) and the design spec in
> `lios-execution-architecture/OBSERVABILITY_MODEL.md`. This doc is the _runtime/where-it-plugs-in_ view;
> the model doc is the _what-and-why_.
>
> **Core directive: REUSE the existing sink.** Extend the `advisor_turn` record + add child events under the
> same writer (`advisor_orchestrator.py:_finish/_persist`, `cost_meter.py`). **Do NOT build a new
> observability system.** Every signal stays non-blocking, metadata-only in logs, content only in the
> service-role-RLS row.

---

## 1. The three unbreakable rules (carried from LIVE)

1. **Non-blocking.** A failed telemetry write is swallowed; the turn already returned. No new signal may
   add a code path that can fail the request (`OBSERVABILITY_MODEL.md` §1).
2. **Metadata-only logs.** Application logs/metrics carry **ids, hashes, counts, statuses, timings,
   tokens** — never message text, raw LLM output, or retrieval payloads.
3. **Content only in `analytics.advisor_turns`** (service-role RLS). Ids/hashes reference content that
   lives only inside that row; no cross-tenant read, ever.

These are the existing live invariants. Every PLANNED signal below inherits them unchanged.

---

## 2. Where it plugs in (LIVE writer, extended)

| Live artifact                              | Today                                                                                                                            | LIOS extension (PLANNED)                                                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `advisor_orchestrator.py:_finish/_persist` | assembles + best-effort writes the turn record                                                                                   | assembles the **extended** record + flushes child events; same non-blocking discipline                                                     |
| `analytics.advisor_turns` (row)            | one content+metadata row/turn                                                                                                    | **add** the PLANNED fields (§3); never replace a live field                                                                                |
| child events (NEW table or JSONB column)   | —                                                                                                                                | append-only `det_turn/intent/route_plan/graph_plan/tool_plan/agent_exec/conflict/recommendation/critic/compose` events, keyed by `turn_id` |
| `analytics.advisor_turn_metrics` (view)    | rollup: fallback rate, validation failure rate, avg+p95 latency, `stages_ms`, tokens, graph counts, validator_result, confidence | **add** rollups over the new events (route distribution, tool utilization, retrieval-set coverage, critic verdict rate, $/turn)            |
| `GET /v1/admin/advisor-metrics`            | serves the rollups                                                                                                               | serves the extended rollups; same shape, more dimensions                                                                                   |
| `cost_meter.py`                            | tokens → cap enforcement                                                                                                         | tokens **→ $/turn** logging (PLANNED)                                                                                                      |

**Storage decision (planning):** child events should be a sibling append-only table
(`analytics.advisor_turn_events`, FK `turn_id`, columns `stage, event, ts, latency_ms, body jsonb`) OR a
JSONB column on the existing row. Either reuses the same RLS + the same writer. Recommendation: a sibling
table so per-event rollups (tool utilization, critic verdict rate) are queryable without unpacking JSONB.
**Decision deferred to the build phase — not made here.**

---

## 3. Signal-by-signal plan (LIVE vs PLANNED)

For each: **what it logs · where it attaches · LIVE/PLANNED · privacy note.** Event names are canonical
from `OBSERVABILITY_MODEL.md` §4 (`EXECUTION_ARCHITECTURE.md` §3 order).

### 3.1 Orchestrator decisions — `intent`, `route_plan`

- **Logs:** `intent`, `risk_level`, `domains[]`, `intent_confidence`, `source: classifier|fallback`;
  `route_plan.{agents[], dag_order, parallel_groups[], rule_id, excluded_reasons}`.
- **Attaches:** new fields on the turn record + `intent`/`route_plan` child events.
- **Status:** **PLANNED** (no orchestrator routing today).
- **Privacy:** all metadata (enums, ids, the rule that fired) — log-safe. No message text.

### 3.2 Agent execution — `agent_exec` (one per agent + per state transition)

- **Logs:** `agent`, `from_state → to_state`, `outcome` (completed/blocked/waiting\_\*/escalated),
  `hop_index`, `confidence` components (`EXECUTION_STATE_MACHINE.md` §7).
- **Attaches:** `agent_exec` child events (fires **once per transition** so the full concurrency trace is
  reconstructable per `PARALLELIZATION_MODEL.md` §6).
- **Status:** transitions **PLANNED**; per-agent `confidence` is **LIVE-adjacent** (confidence object
  already on the live record).
- **Privacy:** state names + ids + numeric confidence — log-safe.

### 3.3 Graph retrieval — `graph_plan`

- **Logs today:** `graph_edges_available`, `relationships_referenced` (**counts — LIVE**).
- **Logs planned:** `fetched_node_ids[]`, `fetched_edge_ids[]`, `fetched_doc_ids[]`, `skipped`.
- **Status:** counts **LIVE**; **the node/edge/doc-id retrieval set is the NAMED PLANNED GAP**
  (`OBSERVABILITY_MODEL.md` §7, `EXECUTION_EVALUATION_FRAMEWORK.md` §6 gap #4) — it gates graph-utilization
  precision.
- **Privacy:** **ids in the log, resolved content only in the RLS row.** Ids are opaque references, not
  content.

### 3.4 Tool execution — `tool_plan`

- **Logs:** ordered `tool` list; per tool `inputs_hash` (NOT raw inputs), `calculation_trace_ref`,
  `latency_ms`, outcome (ran / blocked-branch).
- **Attaches:** `tool_plan` child events.
- **Status:** **PLANNED** (deterministic tools run today; their execution isn't logged as events). Enables
  the tool-utilization metric (`EXECUTION_EVALUATION_FRAMEWORK.md` §2.6).
- **Privacy:** **hash the inputs**; the trace ref points into the content row.

### 3.5 Compliance — `compliance`

- **Logs:** `validator_result` (accept/repair/reject), `reasons`, `repairs[]`, `fallback_reason`.
- **Status:** **LIVE** (this is the live trust-gate telemetry: `validator_result`, `validator_reason`,
  `validator_repairs`, `fallback_used/reason` are already on `advisor_turns`). The Compliance-Agent
  LLM-assist (Phase 9) would add an assist verdict, also PLANNED.
- **Privacy:** reasons/repairs are rule labels, not user content — log-safe.

### 3.6 Critic — `critic`

- **Logs:** `claim_ref`, `verdict` (real/refuted), `reasons[]`, `refutation_confidence`.
- **Status:** **PLANNED — blocked on a missing producer.** The Critic does not exist
  (`CURRENT_STATE_AUDIT.md` §2). The event has no source until Phase 8; until then its rollup
  (refutation verdict rate) is a declared gap, not faked.
- **Privacy:** claim referenced by id; verdict/reasons are labels.

### 3.7 Latency — `stages_ms`

- **Logs:** per-stage timing
  `{deterministic_turn, context_build, plan, llm_generate, validate, compose}` **today**; **PLANNED** new
  stage keys `{intent, route, graph_plan, tool_plan, agent_exec, conflict, critic, compose_assembly}`.
- **Status:** **LIVE** for the current stages; new-stage breakout **PLANNED** (each new stage must appear in
  `stages_ms` per `EXECUTION_EVALUATION_FRAMEWORK.md` §2.1). Feeds `LATENCY_MODEL.md`.
- **Privacy:** durations only — log-safe.

### 3.8 Cost — tokens → `$`

- **Logs today:** `prompt_tokens`, `completion_tokens`, `total_tokens` (**LIVE**, per turn).
- **Logs planned:** **`cost_usd` per turn** (tokens × model rate) and per-tier rollups, via `cost_meter.py`.
- **Status:** tokens **LIVE**; **$ derivation PLANNED**. Feeds `COST_MODEL.md` and the daily-cap watch.
- **Privacy:** counts + a dollar figure — log-safe.

---

## 4. The extended per-turn record (PLANNED fields in **bold**)

Reuses the live spine; adds fields, replaces nothing (`OBSERVABILITY_MODEL.md` §3).

```jsonc
{
  "turn_id": "",
  "user_id": "",
  "conversation_id": "",
  "timestamp": "", // LIVE
  "llm_status": "",
  "validator_result": "",
  "validator_reason": "", // LIVE
  "validator_repairs": [],
  "fallback_used": false,
  "fallback_reason": "", // LIVE
  "latency_ms": 0,
  "stages_ms": {}, // LIVE (+ new stage keys PLANNED)
  "prompt_tokens": 0,
  "completion_tokens": 0,
  "total_tokens": 0, // LIVE
  "graph_edges_available": 0,
  "relationships_referenced": 0, // LIVE (counts)
  "confidence": {}, // LIVE
  // content (RLS row only):
  "user_message": "",
  "advisor_response": "",
  "llm_response_raw": "", // LIVE (content)

  "intent": { "intent": "", "risk_level": "", "domains": [], "confidence": 0, "source": "" }, // PLANNED
  "route_plan": {
    "agents": [],
    "dag_order": [],
    "parallel_groups": [],
    "rule_id": "",
    "excluded_reasons": {},
  }, // PLANNED
  "graph_plan": {
    "fetched_node_ids": [],
    "fetched_edge_ids": [],
    "fetched_doc_ids": [],
    "skipped": false,
  }, // PLANNED (named gap)
  "tool_plan": [
    { "tool": "", "inputs_hash": "", "calculation_trace_ref": "", "latency_ms": 0, "outcome": "" },
  ], // PLANNED
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
  "conflict": { "pairs": [], "ranking_result": "", "down_weight": 0, "resolution": "" }, // PLANNED
  "recommendations": [{ "rec_id": "", "evidence_refs": [], "confidence": 0 }], // PLANNED
  "critic": { "claim_ref": "", "verdict": "", "reasons": [], "confidence": 0 }, // PLANNED (Critic unbuilt)
  "compose": { "final_confidence": 0, "content_ref": "", "composed_from": [] }, // partial (confidence LIVE; source map PLANNED)
  "cost_usd": 0, // PLANNED ($ from tokens)
}
```

---

## 5. Phasing — telemetry lands BEFORE the behavior it observes

Per `ORCHESTRATOR_IMPLEMENTATION_PLAN.md` cross-cutting rule #4 ("telemetry first") — each phase ships its
event _before_ it acts on anything:

| Phase                | New observability signal                                         | Status it reaches     |
| -------------------- | ---------------------------------------------------------------- | --------------------- |
| 1 Wrap               | wrapper timing + route-plan **stub**                             | PLANNED → lands first |
| 2 Intent             | `intent` event                                                   | PLANNED               |
| 3 Selection          | `route_plan` event (+ excluded reasons)                          | PLANNED               |
| 4 First domain agent | `agent_exec` (one agent) + `tool_plan`                           | PLANNED               |
| 5 Parallel domains   | `agent_exec` per-transition (concurrency trace)                  | PLANNED               |
| 6 Conflict           | `conflict` event                                                 | PLANNED               |
| 7 Decision pipeline  | `tool_plan` chains + `recommendation` event                      | PLANNED               |
| 8 Critic             | `critic` event (now has a producer)                              | PLANNED → unblocks    |
| 9 Compliance-assist  | assist verdict alongside LIVE `compliance`                       | PLANNED               |
| — all phases         | `graph_plan` retrieval-set ids; `cost_usd`; new `stages_ms` keys | PLANNED               |

---

## 6. Rollups + the metrics view (PLANNED extensions)

The live view already rolls fallback rate, validation failure rate, avg/p95 latency, `stages_ms`, tokens,
graph counts, validator_result/repairs, confidence. **Add** (same view, more dimensions):

- **Route distribution** (share of turns per tier/rule_id) — from `route_plan`.
- **Tool utilization** (% number/decision turns that ran a tool; tool latency; blocked-branch rate) — from
  `tool_plan` (`EXECUTION_EVALUATION_FRAMEWORK.md` §2.6).
- **Retrieval-set coverage/precision** (fetched ids actually used) — from `graph_plan` (the named gap).
- **Critic verdict rate** (refuted/real) — from `critic` (blocked on the Critic).
- **$/turn and $/day vs the $4 cap** — from `cost_usd` (feeds `COST_MODEL.md`).

`GET /v1/admin/advisor-metrics` serves all of these — **same endpoint, same shape, more dimensions.**

---

## 7. LIVE vs PLANNED summary

- **LIVE:** `compliance` (validator_result/reasons/repairs/fallback_reason), `stages_ms`, tokens, graph
  **counts**, per-agent `confidence`, the content/metadata split, the metrics view + admin endpoint, the
  non-blocking writer.
- **PLANNED:** `intent`, `route_plan`, `tool_plan`, `conflict`, `recommendation`, `compose` source-map;
  `agent_exec` **per-transition**; the **graph retrieval-set ids** (the headline named gap); `cost_usd`;
  new-stage `stages_ms` keys.
- **PLANNED — blocked on a missing agent:** `critic` (no producer until Phase 8).

## 8. Invariants (carried, never relaxed)

1. Telemetry never blocks/slows/breaks the request path; a failed write is swallowed.
2. Content lives only in the service-role-RLS `advisor_turns` row; all other logs are metadata-only.
3. No cross-tenant read of `analytics.advisor_turns`.
4. Every lifecycle stage + every agent state transition emits its named event; the turn's reasoning is
   fully reconstructable from the record.
5. The record is **analytics, never a truth source** for any downstream agent.
6. Missing fields are null — **never fabricated**.
7. **Reuse the existing sink + writer** — extend the row, add child events; do not build a parallel system.
