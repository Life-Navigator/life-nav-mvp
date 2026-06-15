# LIOS Runtime Blueprint — Current State Audit

> Phase 4 — **implementation planning only.** No runtime change, no beta change, no deploy, no Gemini
> orchestration, no multi-agent build. This audit maps the **live** advisor path to actual files/classes/
> functions so every later blueprint doc can answer: _where does it live today · what owns it · what must
> change · what must NOT change._ Paths are relative to `apps/lifenavigator-core-api/` unless noted.

---

## 1. The live advisor path (end to end, real code)

```
User (web)
  ↓  POST /api/life/discovery-chat[ -stream ]            apps/web/src/app/api/life/discovery-chat*/route.ts  (Next proxy)
  ↓  POST /v1/life/discovery/chat[ /stream ]             app/routers/life.py:84 (chat) / :100 (stream)
  ↓  Depends(get_advisor_orchestrator)                   app/dependencies.py:268
  ↓  AdvisorOrchestrator.converse / converse_stream      app/services/advisor_orchestrator.py:167 / :188
       1. RelationshipManager.converse (deterministic)   app/services/relationship_manager.py:287   ← trust floor + persistence
       2. AdvisorContextBuilder.build → AdvisorContext   app/services/advisor_context.py:288 / prompt_dict :193
       3. build_constraints (plan)                       app/services/advisor_orchestrator.py (module fn)
       4. GeminiAdvisorLLM.generate → Gemini             app/services/advisor_llm.py:163 → app/clients/gemini.py
       5. advisor_validator.validate (Compliance gate)   app/services/advisor_validator.py:validate
       6. _compose (Response assembly)                   app/services/advisor_orchestrator.py:_compose
       7. _finish + _persist (Audit)                     app/services/advisor_orchestrator.py:_finish / :248
  ↓  governed response → Next proxy → user
```

Streaming (`converse_stream`) emits a deterministic `ack` first, then the validated `final`.

## 2. Component-by-component map

| LIOS component                           | Lives today in                                                                                                                                            | Owns                                                                    | Must change for LIOS                                               | Must NOT change                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **Orchestrator**                         | `advisor_orchestrator.py:AdvisorOrchestrator` (`converse`/`converse_stream`/`_enhance`/`_finish`/`_persist`/`_compose`)                                   | sequencing one advisor turn; telemetry envelope; safe fallback          | becomes the multi-agent router (wrap first, don't replace)         | the deterministic-first ordering; the always-safe-response guarantee |
| **Wiring/DI**                            | `dependencies.py:268 get_advisor_orchestrator`                                                                                                            | constructs RM + builder + `GeminiAdvisorLLM` + supabase                 | add registry + flags here                                          | the existing construction (keep as the default path)                 |
| **Advisor (LLM)**                        | `advisor_llm.py:GeminiAdvisorLLM:148` (Protocol `AdvisorLLM:113`, `NullAdvisorLLM:117`), `ADVISOR_SYSTEM`, `ADVISOR_PROMPT_VERSION`                       | the LLM proposal                                                        | prompt sourced from the Prompt OS composer; add per-agent variants | the Protocol contract; `generate()` signature                        |
| **Relationship Manager (deterministic)** | `relationship_manager.py:70` (`converse:287`, `_persist_candidate_goals:106`)                                                                             | persistence of goals/vision/rejected; safe fallback text; context panel | none for Phase 1; stays the floor + approved writer                | its persistence authority; never let the LLM write                   |
| **Memory/Context**                       | `advisor_context.py:AdvisorContextBuilder.build:288`, `AdvisorContext.prompt_dict:193`                                                                    | bounded context (allowed_numbers, real edges, classified facts, scores) | becomes the Memory Agent; add per-domain context                   | `prompt_dict` as the only LLM-visible context                        |
| **Compliance**                           | `advisor_validator.py:validate` (accept/repair/reject)                                                                                                    | deterministic trust gate                                                | stays authoritative; optional LLM-assist added later               | every existing safety rule + the carve-outs                          |
| **Tool Execution**                       | `decision_brain.py`, `decision_engine.py`, `scenario_compare.py`, `tools.py`, `compensation.py`, `FinancialInputResolver`                                 | deterministic calc + `calculation_trace`                                | wrapped behind a typed Tool Execution runtime                      | the deterministic results + traces                                   |
| **GraphRAG**                             | `clients/neo4j_client*`, `clients/qdrant*`, graph build inside `advisor_context.py`                                                                       | 3-store retrieval + citation context                                    | extracted into a GraphRAG runtime + retrieval plans                | the citation contract; read-only; tenant scope                       |
| **Recommendation**                       | `recommendations_os.py:RecommendationOS.write:56`                                                                                                         | evidence-or-nothing minting                                             | becomes the Recommendation Agent's writer (via Tool Execution)     | the "no rec without evidence" guard                                  |
| **Life Model**                           | `my_life.py:MyLifeService`                                                                                                                                | grounded aggregation + provenance                                       | becomes the Life Model Agent                                       | honest-empty + provenance + generic-label gates                      |
| **Audit/Observability**                  | `advisor_orchestrator.py:_finish/_persist`, `analytics.advisor_turns`, `analytics.advisor_turn_metrics`, `GET /v1/admin/advisor-metrics`, `cost_meter.py` | per-turn telemetry + rollup                                             | extend events (intent/route/agent/tool/critic)                     | non-blocking; metadata-only logs; RLS table                          |
| **Decision pipeline**                    | `decision_brain.py`, `scenario_compare.py`, `decision_workspace.py`, `decision_graph.py`, `scenario_tree.py`                                              | decision math + traces                                                  | orchestrated as agents (math exists; sequencing doesn't)           | the calculation traces                                               |
| **Critic**                               | — (does not exist)                                                                                                                                        | —                                                                       | build new (high-stakes only)                                       | n/a                                                                  |
| **Config/flags**                         | `config.py:Settings`, env `ADVISOR_LLM_ENABLED`, `ADVISOR_TRACE_ENABLED`                                                                                  | model names; enable flags                                               | add the LIOS flag set                                              | the existing flags' defaults                                         |

## 3. APIs (live)

| Endpoint                              | File                                                                        | Notes                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `POST /v1/life/discovery/chat`        | `routers/life.py:84`                                                        | the advisor turn (accepts `message`, `pending_key`, `conversation_id`, `trace`) |
| `POST /v1/life/discovery/chat/stream` | `routers/life.py:100`                                                       | SSE ack/final                                                                   |
| `GET /v1/admin/advisor-metrics`       | `routers/analytics.py:48`                                                   | admin-only metrics rollup                                                       |
| domain summaries                      | `routers/finance.py`, `family.py`, `career.py`, `education.py`, `health.py` | the domain-agent data sources today                                             |
| decision                              | `routers/decision.py`                                                       | decision brain / scenario compare                                               |

## 4. Persistence (live)

| Store                                              | What                                                                                                                    | Writer                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Supabase (RLS)                                     | goals/vision/rejected (`life.*`), recommendations (`recommendations.*`), documents, profiles, `analytics.advisor_turns` | RelationshipManager, RecommendationOS, domain writers, Audit |
| Neo4j (Aura Query API v2)                          | personal graph edges                                                                                                    | the ingestion worker (projection)                            |
| Qdrant                                             | vectors                                                                                                                 | the ingestion worker                                         |
| `analytics.advisor_turns` + `advisor_turn_metrics` | per-turn telemetry + 30-day rollup                                                                                      | `_persist` (best-effort, service-role)                       |

## 5. Telemetry fields (live `advisor_turns` record)

`turn_id, conversation_id, user_id, timestamp, llm_status, validator_result, validator_reason,
validator_repairs, fallback_used, fallback_reason, latency_ms, stages_ms{deterministic_turn, context_build,
plan, llm_generate, validate, compose}, prompt_tokens, completion_tokens, total_tokens,
graph_edges_available, relationships_referenced, confidence, user_message, advisor_response,
llm_response_raw`. Metadata-only to app logs; content only in the RLS table.

## 6. Model + measured baselines (live)

- Model: `gemini-2.5-flash` (generation), `gemini-embedding-001` 3072-dim (embeddings) — `config.py:25-26`,
  AI Studio, **Fly backend only** (key never on Vercel).
- Latency: avg ~9–10s, p95 ~13–16s per turn; `llm_generate` ≈ 76% of the turn.
- Tokens: ~3,110/turn (max ~3,800).
- Cost ceiling: a real ~$4/day Gemini cap + prepay-credit posture.

## 7. What must NOT change (hard guardrails for the build)

1. The live `/v1/life/discovery/chat[/stream]` behavior until LIOS is proven behind a flag.
2. The deterministic trust spine: RelationshipManager persistence, `advisor_validator` rules, RecommendationOS
   evidence-or-nothing, the citation contract.
3. The "LLM never writes / never the source of truth" boundary.
4. Telemetry being non-blocking + metadata-only logs.
5. The Gemini key staying Fly-only.

> Bottom line: the live system is a clean, single-agent advisor with a deterministic trust spine and real
> telemetry. LIOS will **wrap** this, not rewrite it — the lowest-risk path is to make the existing
> orchestrator the first "agent" under a new, flag-gated LIOS orchestrator that is behavior-identical on day
> one. Every later doc builds on this map.
