# Advisor Observability Audit

What we can currently SEE about the advisor + orchestration layer, the blind spots, and what to add
before beta. (Phase 1 — discovery only; nothing implemented yet.)

## 1. Logging that exists today

| Area                       | Mechanism                                                                                                                   | File                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| App logs (structured JSON) | `logging.basicConfig` with a JSON format `{"level","time","name","msg"}`                                                    | `app/main.py:_configure_logging`       |
| Per-client loggers         | `logging.getLogger("core.<x>")` for neo4j, qdrant, gemini, supabase, retriever, cost, life_profile, orchestrator            | ~8 loggers, 28 call sites              |
| Gemini transient retries   | `log.warning("gemini %s transient %s; retry…")`                                                                             | `app/clients/gemini.py`                |
| LLM token usage            | `CostMeter.record()` → log line `{"event":"usage","user","domain","model","in","out"}` (intended for `ops.llm_usage_meter`) | `app/services/cost_meter.py`           |
| Funnel analytics           | `AnalyticsService.emit()` → `analytics.events` (non-PII: event_type/domain/props); `dashboard()` aggregates                 | `app/services/analytics.py`            |
| Frontend events            | analytics events incl. `first_chat_message`, onboarding/decision funnel                                                     | `apps/web/src/lib/analytics/events.ts` |

## 2–8. Advisor / GraphRAG / recommendation / decision / trace / telemetry / journey

| Question                   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Advisor logs**           | ❌ **None persisted.** The advisor returns rich per-turn signals — `llm_status` (`enhanced` / `fallback:*`), `prompt_version`, `relationships_referenced`, `missing_data`, `candidate_goals`, `reveal` — but they are **returned to the client and discarded**. No `advisor_sessions` / `advisor_turns` / `chat_log` table exists (grep: zero matches). We cannot answer "what did the advisor say to user X last Tuesday, and did it fall back?" |
| **GraphRAG logs**          | ⚠️ Partial. `core.retriever` logger exists; the workspace/advisor build edges with `provenance` + citations, but **retrievals are not logged per turn** (which nodes/edges/docs were pulled for a given response is not recorded).                                                                                                                                                                                                                |
| **Recommendation logs**    | ⚠️ The `recommendations.recommendations` rows ARE the durable record (source*module, evidence, assumptions, confidence, rank_score, created/updated). But there's no log of \_why a rec was surfaced in a given turn* or which recs the advisor referenced.                                                                                                                                                                                       |
| **Decision-engine logs**   | ⚠️ The decision brain / scenario compare produce traceable outputs (`calculation_trace`, `tool_calculations`) but these are response payloads, not a persisted audit trail.                                                                                                                                                                                                                                                                       |
| **API traces**             | ❌ No request tracing/correlation IDs (no OpenTelemetry, no per-request trace id). Logs are not correlated across the proxy→Core→Gemini/Supabase hop.                                                                                                                                                                                                                                                                                             |
| **Telemetry**              | ⚠️ CostMeter exists but is **NOT wired into the advisor/Gemini discovery path** (grep: cost_meter not called from advisor_llm/gemini/relationship_manager) — advisor token spend is effectively unmetered. No latency instrumentation on the advisor turn.                                                                                                                                                                                        |
| **User-journey analytics** | ✅ Funnel events (`analytics.events`) cover onboarding/decision/report/share/retention at the macro level. ❌ No per-conversation journey (turn count, completion, drop-off within discovery).                                                                                                                                                                                                                                                    |

## Current visibility (what we CAN see)

- App-level errors + client warnings (Gemini retries, Supabase/Neo4j/Qdrant failures).
- Macro funnel counts (users, reports, shares) via `analytics.events` + `dashboard()`.
- The durable recommendation ledger (with evidence/assumptions/confidence).
- Per-turn trust signals **at request time** (the client receives `llm_status`/`prompt_version`) — but only the client sees them.

## Blind spots (what we CANNOT see)

1. **No advisor conversation history / turn log.** The single biggest gap. We can't audit hallucinations, fallbacks, validator rejections, or memory failures after the fact.
2. **No per-turn GraphRAG retrieval record** (nodes/edges/docs/recs used).
3. **No advisor latency or token metering** (CostMeter not wired in; no timing).
4. **No validator-outcome metrics** (how often does the output validator reject? for what reasons?).
5. **No fallback-rate metric** (how often `llm_status` = `fallback:*` vs `enhanced`).
6. **No request correlation/tracing** across proxy→Core→model.
7. **No provenance-usage metric** (which provenance_types are surfaced per turn).

## Missing metrics (the Phase-2 target schema — RECOMMENDED, not yet built)

A per-turn `advisor.turns` record (or `ops.advisor_turns`) capturing:
`session_id, user_id, turn_index, ts, message, advisor_response, prompt_version, llm_status,
agents_selected, tools_called, graphrag {nodes, edges, documents, recommendations}, provenance_types,
recommendations_referenced, confidence, fallback (bool+reason), validator {ok, reasons},
latency_ms, tokens_in, tokens_out, error`.

## Recommended additions (priority order)

1. **`advisor.turns` persistence** — write one row per advisor turn from `AdvisorOrchestrator.converse` (the orchestrator already computes `llm_status`, `prompt_version`, validator reasons, `relationships_referenced`). Highest leverage; unlocks all post-hoc evaluation.
2. **Wire CostMeter + latency into the advisor turn** (`perf_counter` around `llm.generate`; record tokens from the Gemini `usageMetadata`).
3. **Persist GraphRAG retrieval set per turn** (node/edge/doc/rec ids the context builder used).
4. **Validator-outcome + fallback-rate counters** (emit to `analytics.events` or a metrics table).
5. **Request correlation id** (generate at the proxy, thread through Core → logs).
6. A **read-only `/v1/ops/advisor` view** so QA/compliance can inspect any session's turns + provenance.

> Until #1 ships, evaluation must be done by **driving the advisor live and capturing the in-flight
> response signals** (what this sprint's harness does) — we cannot reconstruct history from storage.

---

## SPRINT UPDATE (P0 — Observability shipped, 2026-06-14)

Recommendation #1 and #2 above are now **BUILT** (code-complete; live persistence gated on the migration
apply + deploy below). What changed:

| Capability                                                                                                                                                                                                                                          | Where                                                                                | Status                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| **Per-turn telemetry** (turn_id, user, llm_status, validator_result/reason, repairs, fallback±reason, latency_ms, **stages_ms**, prompt/completion/total tokens, graph_edges_available, relationships_referenced, confidence, message/response/raw) | `AdvisorOrchestrator.converse` → `_finish`                                           | ✅ code-complete                                |
| **Structured per-turn log line** (`{"event":"advisor_turn",…}` — metadata only, no PII to logs)                                                                                                                                                     | `_finish` → `log.info`                                                               | ✅ live the moment it's deployed (no DB needed) |
| **Durable turn store** (`analytics.advisor_turns`, service-role only RLS, full content for diagnostics)                                                                                                                                             | migration `160_advisor_turns.sql` + `_persist` (best-effort, non-blocking)           | ✅ code-complete · ⏳ needs migration apply     |
| **Token capture** from Gemini `usageMetadata`                                                                                                                                                                                                       | `gemini.generate_with_usage` → `GeminiAdvisorLLM.last_usage`                         | ✅ code-complete                                |
| **Stage-level latency** (deterministic_turn / context_build / plan / llm_generate / validate / compose)                                                                                                                                             | `perf_counter` laps in `converse`                                                    | ✅ code-complete                                |
| **Dashboard metrics** (total sessions/turns, fallback rate, avg+p95 latency, avg confidence, avg edges, avg tokens, validation failure rate)                                                                                                        | `analytics.advisor_turn_metrics` view + `GET /v1/admin/advisor-metrics` (admin-only) | ✅ code-complete · ⏳ needs migration apply     |
| **Trace mode** (dev-only `_trace` blob; gated by `ADVISOR_TRACE_ENABLED` env + `trace:true` body)                                                                                                                                                   | `discovery_chat` → `converse(trace=…)`                                               | ✅ code-complete                                |

**Privacy:** the log line is metadata-only (no message/response/raw). Full content lives only in
`analytics.advisor_turns`, which is **service-role only** (no authenticated/anon grant or policy) — QA
access goes through an ops view, never the client. Honors "store only what is necessary for diagnostics."

**Definition-of-done coverage:** _Why did the advisor say this?_ → `llm_response_raw` + `advisor_response`.
_Why did the validator reject/repair?_ → `validator_result` + `validator_reason` + `validator_repairs`.
_Why did fallback occur?_ → `fallback_used` + `fallback_reason`. _Which graph context?_ →
`graph_edges_available` + `relationships_referenced`. _Where is latency?_ → `stages_ms`. All now answerable
per turn.

**Remaining (gated):** apply `160_advisor_turns.sql` to prod (needs Supabase auth) → deploy core-api to
Fly → re-run the eval harness to confirm fallback < 5% live. See `BETA_READINESS_REPORT.md`.
