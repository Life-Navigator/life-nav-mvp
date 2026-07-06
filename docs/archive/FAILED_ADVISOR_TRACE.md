# FAILED_ADVISOR_TRACE.md — Phase 1

Replay of "Build me a workout and nutrition plan" through the live advisor path. Every claim cited file:line. No guessing.

## The live path (proven)

Frontend `apps/web/src/lib/chat/send-server.ts:32` → `apps/web/src/app/api/life/advisor/chat/route.ts:14` → **`POST /v1/life/advisor/chat`** (`app/routers/life.py:145-164`, `mode="advisor"`) → `AdvisorOrchestrator.converse()` (`advisor_orchestrator.py:354`) → `AdvisorContextBuilder.build()` (`advisor_context.py:353`) → `GeminiAdvisorLLM.generate()` (`advisor_llm.py:223`) → `validate()` (`advisor_validator.py:147`) → `_compose()` prose (`advisor_orchestrator.py:145`) → UI.

> Note: a _second_ path exists — `POST /v1/chat` → `LifeOrchestratorAgent` → `Retriever` (Qdrant+Neo4j). **The advisor UI does not call it.** See GRAPHRAG_TRUTH_AUDIT.md.

## Step-by-step trace

| Stage             | What happens                                                                                                                                                                                                    | Evidence                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Entry             | `advisor_chat()` calls `svc.converse(mode="advisor")`                                                                                                                                                           | `life.py:145-164`                                                      |
| Routing           | **No LLM classifier, no keyword domain router.** Routes by `mode` only. Without an explicit `agent`, the default is the orchestrator **Relationship Manager** → all domains kept.                               | `advisor_orchestrator.py:354-394`; `advisor_agents.py:131-135,189-195` |
| Health safety net | `detect_health_urgent(message)` runs **before** the LLM; short-circuits emergencies (deterministic).                                                                                                            | `advisor_orchestrator.py:187-203`                                      |
| Context builder   | 4 concurrent Supabase reads: deterministic panel (vision/objective/**top_risks/opps/constraints**/discovery%), rejected goals, discovery scores, personal-graph edges, fact packet, history, `allowed_numbers`. | `advisor_context.py:353-420,368-370`                                   |
| Retrieval         | **No Qdrant. No Neo4j. No embeddings.** Pure Supabase SQL.                                                                                                                                                      | see GraphRAG audit                                                     |
| Fact packet       | `build_fact_packet` reads career/education/finance/family/documents — **NO health rows**                                                                                                                        | `advisor_facts.py:78-192` (grep: zero `health` reads)                  |
| Model             | **Gemini `gemini-2.5-flash`** (default). Claude wired but OFF.                                                                                                                                                  | `dependencies.py:311-312`, `config.py:26`                              |
| Validator         | Rejects numbers not in `allowed_numbers`; rejects medical/legal/tax/product advice; requires `next_question`.                                                                                                   | `advisor_validator.py:84,179-187`                                      |
| Compose           | Renders decision_frame + recommendation + one question; tradeoffs hidden in a drawer.                                                                                                                           | `advisor_orchestrator.py:145-170`                                      |
| Risk chips        | `panel.top_risks` (whole-life snapshot, NOT topic-scoped), sliced to 6.                                                                                                                                         | `relationship_manager.py:393` → `send-server.ts:61-66`                 |

## For this specific message — why no real plan came back

- **Context available but withheld:** the user's health/fitness state and military history exist in the DB (`health.*`, `MilitaryService` in `military.py:73-126`) but are **never assembled** into the prompt. The model received career/education/finance facts + global (finance-flavored) risk chips, and **nothing about the user's fitness**.
- **Model:** `gemini-2.5-flash`.
- **Three blockers prevented a concrete plan (all proven):**
  1. **Number gate** — `_FIN_NUM` matches any integer ≥100, `$`, or `%` (`advisor_validator.py:84`); any such number not in `allowed_numbers` rejects the **entire reply** (`:179-184`). "3×10 at 135 lbs", "2000 kcal", "150g protein" → rejected → deterministic fallback. **This is the single most important finding.**
  2. **Forced 6-section decision structure** every turn (`advisor_llm.py:45-66,163-185`) — a coaching ask is coerced into DECISION FRAME / TRADEOFFS / RECOMMENDATION / NEXT QUESTION. There is no "plan/program" output field; a multi-day program has nowhere to go.
  3. **Mandatory closing question** — `next_question` required or the turn is rejected (`advisor_validator.py:187`); `max_questions:1`. Forces a clarifying question even on a fully-specified request.
- **Irrelevant data leaked:** global `top_risks` (finance/career) rendered as chips on a health turn.

## Suspected failure points (ranked, evidence-backed)

1. Number gate nukes legitimate non-financial numbers → vague answers. `advisor_validator.py:84,182-184`
2. Health/military context never enters the prompt → ungrounded health turns. `advisor_facts.py` (no health), `military.py` (never called)
3. Forced decision-analysis schema + mandatory question → "asks instead of answers", no plans. `advisor_llm.py:45-66,184`; `advisor_validator.py:187`
4. Risk-chip cross-domain leak. `relationship_manager.py:393` → `send-server.ts:61-66`
5. Model = Gemini Flash, not the benchmarked-better Claude. `dependencies.py:311`
