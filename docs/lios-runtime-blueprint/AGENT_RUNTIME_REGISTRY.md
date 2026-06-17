# Agent Runtime Registry

> Implementation planning only — no code, no runtime change, no deploy, no Gemini wiring, no beta change.
> Designs the registry that maps an agent name → its runtime entry (prompt asset, output schema, escalation
> rules, allowed tools, runtime limits, `is_llm`, `status`). Builds on `CURRENT_STATE_AUDIT.md`,
> `TARGET_RUNTIME_ARCHITECTURE.md` §4, the Prompt OS asset tree, and `AGENT_OUTPUT_SCHEMAS.md`. The
> `services/lios/registry.py` module name is the **proposed** target (Target doc §4) — illustrative, not built.

---

## 1. What the registry is

A single, declarative table (proposed `services/lios/registry.py`) the LIOS Orchestrator reads to know, for
any agent name, **what prompt to compose, what schema it returns, what it may call, what limits bound it,
whether it is an LLM, and whether it exists today.** It is data, not behavior — selection
(`services/lios/selection.py`) chooses _which_ entries run; the registry says _how_ each one runs. It does
not own any agent's specification; each spec stays in `docs/lios-agent-specifications/<AGENT>_AGENT.md`.

## 2. The runtime entry shape

```
RegistryEntry:
  name              # canonical agent name (the key)
  prompt_asset      # Layer-3 subsystem (or Layer-5 domain) asset path → fed to the Prompt Composer
  output_schema     # Layer-8 schema asset path (payload) + always the base AGENT_OUTPUT_SCHEMA envelope
  spec              # the owning spec doc (referenced, never duplicated)
  escalation        # allowed escalation targets + moves (ref AGENT_ESCALATION_MODEL.md)
  allowed_tools     # which Tool Execution / store calls this agent may request (deny by default)
  limits            # { token_cap, timeout_ms, max_retries }
  is_llm            # bool — does invoking it call the model?
  status            # live | wraps-existing | planned
  callable          # how the Orchestrator invokes it (wraps-existing → a real method today)
```

`escalation` only lists _targets_; the **move** (escalate/block/needs_confirmation/needs_data) is decided at
runtime by the agent and routed by the Orchestrator (`AGENT_ESCALATION_MODEL.md` §2 — never agent→agent).
`callable` is what makes "wraps-existing" real: the entry points at code that already runs.

## 3. The registry table

Schemas: payload asset under `schemas/` (or the per-agent spec §5) **plus** the shared envelope in
`docs/lios-agent-specifications/AGENT_OUTPUT_SCHEMAS.md`. Limits are planning defaults to be tuned against
`COST_MODEL.md`/`LATENCY_MODEL.md` (advisor baseline today: ~3,110 tok, ~9–10s avg — CURRENT_STATE_AUDIT §6).

| name                      | prompt asset                                | output schema                                            | escalates to                           | allowed tools                                            | limits (tok / ms / retry) | is_llm        | status           |
| ------------------------- | ------------------------------------------- | -------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------- | ------------------------- | ------------- | ---------------- |
| **orchestrator**          | `subsystems/ORCHESTRATOR_PROMPT.md`         | `schemas/ORCHESTRATOR_OUTPUT_SCHEMA.md`                  | — (it routes)                          | none (routes only)                                       | 1500 / 30000 / 0          | no (det core) | wraps-existing¹  |
| **advisor**               | `subsystems/ADVISOR_PROMPT.md`              | Advisor §5 + envelope                                    | decision_scientist, missing_data       | none (proposes only)                                     | 4000 / 16000 / 1          | yes           | wraps-existing²  |
| **onboarding**            | `subsystems/ONBOARDING_PROMPT.md`           | `ONBOARDING_AGENT.md` §5                                 | advisor, missing_data                  | none                                                     | 3500 / 14000 / 1          | yes           | planned          |
| **relationship_manager**  | `subsystems/RELATIONSHIP_MANAGER_PROMPT.md` | RM panel (det)                                           | —                                      | supabase write (goals/vision/rejected)                   | 0 / 8000 / 0              | no            | live³            |
| **memory**                | `subsystems/MEMORY_CONTEXT_PROMPT.md`       | `MEMORY_AGENT.md` §5 (`bounded_context`)                 | —                                      | supabase read, graph read                                | 0 / 8000 / 0              | no⁴           | wraps-existing⁵  |
| **life_model**            | `subsystems/LIFE_MODEL_PROMPT.md`           | `LIFE_MODEL_AGENT.md` §5                                 | missing_data                           | supabase read, domain summaries                          | 0 / 10000 / 0             | no            | wraps-existing⁶  |
| **missing_data**          | `subsystems/MISSING_DATA_PROMPT.md`         | `schemas/MISSING_DATA_SCHEMA.md`                         | —                                      | coverage read                                            | 0 / 6000 / 0              | no            | planned⁷         |
| **finance**               | `domains/FINANCE_PROMPT.md`                 | domain envelope (Schemas §3)                             | recommendation, tool_execution         | finance summary, FinancialInputResolver (read)           | 3000 / 12000 / 1          | yes           | wraps-existing⁸  |
| **family**                | `domains/FAMILY_PROMPT.md`                  | domain envelope                                          | recommendation, document_intelligence  | family summary (read)                                    | 3000 / 12000 / 1          | yes           | wraps-existing⁹  |
| **career**                | `domains/CAREER_PROMPT.md`                  | domain envelope                                          | recommendation, decision_scientist     | career summary, compensation (read)                      | 3000 / 12000 / 1          | yes           | wraps-existing⁹  |
| **education**             | `domains/EDUCATION_PROMPT.md`               | domain envelope                                          | recommendation                         | education summary (read)                                 | 3000 / 12000 / 1          | yes           | wraps-existing⁹  |
| **health**                | `domains/HEALTH_PROMPT.md`                  | domain envelope                                          | recommendation, compliance             | health summary (read)                                    | 3000 / 12000 / 1          | yes           | wraps-existing⁹  |
| **document_intelligence** | `domains/DOCUMENT_INTELLIGENCE_PROMPT.md`   | `DOCUMENT_INTELLIGENCE_AGENT.md` §5                      | memory (candidate facts)               | document extractor (read)                                | 4000 / 20000 / 1          | yes           | wraps-existing¹⁰ |
| **graphrag**              | `domains/GRAPHRAG_PROMPT.md`                | GraphRAG §5 (`edges`,`connections`)                      | —                                      | neo4j read, qdrant read                                  | 1000 / 10000 / 1          | no¹¹          | wraps-existing¹² |
| **decision_scientist**    | `domains/DECISION_INTELLIGENCE_PROMPT.md`   | `DECISION_OUTPUT_SCHEMA.md` (frame)                      | scenario, missing_data, tool_execution | decision_brain (read)                                    | 4000 / 18000 / 1          | yes           | wraps-existing¹³ |
| **scenario**              | `domains/DECISION_INTELLIGENCE_PROMPT.md`   | `SCENARIO_AGENT.md` §5 (`option_outcomes`)               | tool_execution, tradeoff               | scenario_compare (read)                                  | 2000 / 16000 / 1          | yes           | wraps-existing¹³ |
| **tradeoff**              | `domains/DECISION_INTELLIGENCE_PROMPT.md`   | `TRADEOFF_AGENT.md` §5                                   | recommendation                         | scenario_tree (read)                                     | 3000 / 14000 / 1          | yes           | wraps-existing¹³ |
| **recommendation**        | (uses RecommendationOS rules)               | `RECOMMENDATION_AGENT.md` §5 (`recommendations`)         | —                                      | RecommendationOS write (evidence-or-nothing)             | 0 / 10000 / 0             | no¹⁴          | live¹⁵           |
| **decision_explanation**  | `domains/DECISION_INTELLIGENCE_PROMPT.md`   | `DECISION_EXPLANATION_AGENT.md` §5                       | —                                      | trace read (no compute)                                  | 3000 / 14000 / 1          | yes           | planned          |
| **tool_execution**        | `subsystems/TOOL_EXECUTION_PROMPT.md`       | `schemas/TOOL_EXECUTION_SCHEMA.md` (`calculation_trace`) | —                                      | decision_brain/engine, tools.py, resolvers, compensation | 0 / 20000 / 0             | no            | wraps-existing¹⁶ |
| **critic**                | `subsystems/CRITIC_PROMPT.md`               | `CRITIC_AGENT.md` §5 (`verdict`)                         | —                                      | none (read-only review)                                  | 3000 / 12000 / 1          | yes           | planned¹⁷        |
| **compliance**            | `subsystems/COMPLIANCE_PROMPT.md`           | `schemas/COMPLIANCE_OUTPUT_SCHEMA.md`                    | —                                      | none                                                     | 2000 / 8000 / 0           | no¹⁸          | live¹⁹           |
| **response_composer**     | `subsystems/RESPONSE_COMPOSER_PROMPT.md`    | `schemas/RESPONSE_COMPOSER_SCHEMA.md`                    | —                                      | none                                                     | 0 / 4000 / 0              | no²⁰          | wraps-existing²¹ |
| **audit**                 | `subsystems/AUDIT_OBSERVABILITY_PROMPT.md`  | `AUDIT_AGENT.md` §5 (`turn_record`)                      | —                                      | analytics write (service-role)                           | 0 / 5000 / 0              | no            | live²²           |

**Footnotes (real code anchors):**

1. `AdvisorOrchestrator` (advisor_orchestrator.py:97) is the only orchestrator today; the LIOS Orchestrator
   wraps it (Target §2). The `orchestrator` entry is the wrapper itself.
2. `callable` = `AdvisorOrchestrator.converse`/`converse_stream` (advisor_orchestrator.py:167/188). This is
   the linchpin: the existing orchestrator **registers as the `advisor` entry** (see §4). Its prompt comes
   from the composer (`PROMPT_COMPOSITION_ENGINE.md`).
3. `RelationshipManager.converse` (relationship_manager.py:287); `_persist_candidate_goals` (:106). The
   deterministic trust floor + the **only** approved writer of goals/vision/rejected. is_llm=no.
4. The Memory Agent is deterministic — it assembles bounded context, it does not reason. is_llm=no.
5. `AdvisorContextBuilder.build` (advisor_context.py:288) → `prompt_dict` (:193). Stays the only
   LLM-visible context (a hard NOT-CHANGE from the audit).
6. `MyLifeService` (my_life.py) — grounded aggregation + provenance + honest-empty/generic-label gates.
7. Missing-data exists today inside `prompt_dict` (`areas_missing_data`) + coverage; the standalone agent is
   new but deterministic.
8. Finance summary service (routers/finance.py) + `FinancialInputResolver`. Phase 4 is the first domain
   agent wrapped (Orchestrator Plan); behind `DOMAIN_AGENTS_ENABLED`.
9. Domain summary services exist (routers/family.py, career.py, education.py, health.py); the agent wrapper
   around each is new. Emit risks/opps + state, **never** recommendations or user text (Schemas §6).
10. Document extractor + `documents` schema (Document Intelligence Platform).
11. GraphRAG retrieval is deterministic read-only; no model call to fetch edges. is_llm=no.
12. `clients/neo4j_client*`, `clients/qdrant*`, graph build in advisor_context.py.
13. `decision_brain.py`, `decision_engine.py`, `scenario_compare.py`, `scenario_tree.py`,
    `decision_workspace.py`, `decision_graph.py` — math exists; the agent sequencing is new (Phase 7).
14. The Recommendation Agent's _writer_ is deterministic (RecommendationOS); LLM framing happens upstream in
    domain/decision agents. The mint itself never invents — evidence-or-nothing.
15. `RecommendationOS.write` (recommendations_os.py:56).
16. Tool Execution wraps the deterministic engines behind one typed runtime; results carry a
    `calculation_trace` (Schemas §2). Deterministic results/traces must NOT change.
17. Does not exist today (audit §2 "Critic — does not exist"); high-stakes only, refutes/never rewrites.
18. The authoritative gate is deterministic; an optional LLM-assist may be added later but only _tightens_
    (Orchestrator Plan Phase 9). is_llm=no for the authoritative path.
19. `advisor_validator.validate` (advisor_validator.py) — every existing safety rule + carve-out stays.
20. Composition is deterministic assembly of validated fields; the Response Composer is the only agent that
    faces the user, and only after Compliance.
21. `_compose` (advisor_orchestrator.py:75).
22. `_finish`/`_persist` (advisor_orchestrator.py:216/248) → `analytics.advisor_turns` /
    `advisor_turn_metrics`. Non-blocking, metadata-only logs, RLS table.

## 4. How the registry wires into `dependencies.py:268`

Today `get_advisor_orchestrator` (dependencies.py:268) constructs the RM + `AdvisorContextBuilder` +
`GeminiAdvisorLLM` + supabase and returns `AdvisorOrchestrator(...)`. The registry slots in **above** this,
behavior-preserving:

```
get_orchestrator (dependencies.py — extended, same DI graph):
  advisor_orch = AdvisorOrchestrator(rm, builder, GeminiAdvisorLLM(gemini), enabled, supabase)   # unchanged
  if not LIOS_ENABLED:
      return advisor_orch                       # today's path, byte-identical (audit guardrail #1)
  registry = build_registry(...)                # services/lios/registry.py
  registry["advisor"].callable = advisor_orch.converse        # ← wraps-existing, the same call/output
  registry["relationship_manager"].callable = rm.converse
  registry["compliance"].callable = advisor_validator.validate
  registry["response_composer"].callable = _compose
  registry["audit"].callable = advisor_orch._finish/_persist
  # finance/family/… registered lazily as their wrappers ship (Phases 4–7), gated by DOMAIN_AGENTS_ENABLED
  return LiosOrchestrator(registry=registry, ...)            # services/lios/orchestrator.py
```

The existing `AdvisorOrchestrator` is **constructed exactly as today** and then handed to the registry as
the `advisor` entry's `callable`. With `LIOS_ENABLED=false` the registry is never built (Target §7 — one
toggle returns to baseline). The Prompt Composer reads each entry's `prompt_asset`/`output_schema` to build
that agent's prompt; the orchestrator reads `limits`/`escalation`/`allowed_tools` to bound and route it.

## 5. The four mandatory questions

- **Where does it live today?** There is no registry today — agent identity is implicit in
  `dependencies.py:268`, `advisor_orchestrator.py`, and the spec docs. The wirable callables already exist:
  `converse` (:167), `_compose` (:75), `_finish`/`_persist` (:216/248), `RelationshipManager.converse`
  (relationship_manager.py:287), `advisor_validator.validate`, `RecommendationOS.write`
  (recommendations_os.py:56).
- **What code owns it?** Proposed `services/lios/registry.py` owns the table; `dependencies.py` owns
  constructing entries' callables; each agent's behavior stays owned by its existing module.
- **What must change?** `dependencies.py` gains a flag-gated path that builds the registry and the LIOS
  Orchestrator, registering `AdvisorOrchestrator.converse` as `advisor` (wraps-existing). Additive only.
- **What must NOT change?** **Each agent's spec ownership** — the registry _references_
  `docs/lios-agent-specifications/<AGENT>_AGENT.md` and the Prompt OS assets; it never re-defines an agent's
  contract. Also unchanged: the deterministic spine entries (relationship_manager, compliance,
  recommendation, audit) keep their authority and their is_llm=no status; the always-safe-response guarantee
  (inherited because `advisor` wraps the proven path); the Gemini-Fly-only boundary.

## 6. Status legend

- **live** — runs in production today; the registry only _names_ it (relationship_manager, recommendation,
  compliance, audit).
- **wraps-existing** — real code exists and is wired in as a callable without rewrite (advisor, the domain
  summaries, decision engines, tool execution, memory/context, life_model, graphrag, response_composer,
  document_intelligence, orchestrator).
- **planned** — net-new behavior not yet built (onboarding agent, standalone missing_data agent,
  decision_explanation, critic).
