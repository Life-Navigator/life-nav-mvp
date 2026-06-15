# Prompt Coverage Matrix

> Confirms every agent spec has a prompt, every prompt references its spec, and every prompt carries an
> output schema, confidence rule, failure behavior, and compliance expectation. Validation — no code.

Legend: ✅ present · ↳ inherited from base/generic · ⚠ gap (documented below).

## 1. Agent spec → prompt coverage (25 agents)

| Agent spec                                         | Prompt asset                                        | Schema                                | Confidence                    | Failure | Compliance            |
| -------------------------------------------------- | --------------------------------------------------- | ------------------------------------- | ----------------------------- | ------- | --------------------- |
| Orchestrator                                       | subsystems/ORCHESTRATOR_PROMPT                      | schemas/ORCHESTRATOR_OUTPUT_SCHEMA ✅ | ✅ (N/A router, records leaf) | ✅      | ✅                    |
| Advisor                                            | subsystems/ADVISOR_PROMPT                           | schemas/AGENT_OUTPUT_SCHEMA ✅        | ✅                            | ✅      | ✅                    |
| (Advisor tier, deterministic) Relationship Manager | subsystems/RELATIONSHIP_MANAGER_PROMPT              | ↳ deterministic contract              | ✅ (det N/A)                  | ✅      | ✅                    |
| Onboarding                                         | subsystems/ONBOARDING_PROMPT                        | ↳ AGENT_OUTPUT_SCHEMA                 | ✅                            | ✅      | ✅                    |
| Life Model                                         | subsystems/LIFE_MODEL_PROMPT                        | ↳ AGENT_OUTPUT_SCHEMA                 | ✅                            | ✅      | ✅                    |
| Goal Discovery                                     | ⚠ embedded in ADVISOR/ONBOARDING                    | ↳ AGENT_OUTPUT_SCHEMA                 | ↳                             | ↳       | ↳                     |
| Goal Conflict                                      | ⚠ embedded in DECISION_INTELLIGENCE + Advisor       | ↳                                     | ↳                             | ↳       | ↳                     |
| Missing Data                                       | subsystems/MISSING_DATA_PROMPT                      | schemas/MISSING_DATA_SCHEMA ✅        | ✅                            | ✅      | ✅                    |
| Memory                                             | subsystems/MEMORY_CONTEXT_PROMPT                    | ↳ (assembles context)                 | ✅ (det)                      | ✅      | ✅                    |
| Tool Execution                                     | subsystems/TOOL_EXECUTION_PROMPT                    | schemas/TOOL_EXECUTION_SCHEMA ✅      | ✅ (det)                      | ✅      | ✅                    |
| Audit                                              | subsystems/AUDIT_OBSERVABILITY_PROMPT               | ↳ turn record                         | ✅ (det N/A)                  | ✅      | ✅                    |
| Critic                                             | subsystems/CRITIC_PROMPT                            | ↳ verdict                             | ✅ (refutation)               | ✅      | ✅                    |
| Compliance                                         | subsystems/COMPLIANCE_PROMPT                        | schemas/COMPLIANCE_OUTPUT_SCHEMA ✅   | ✅                            | ✅      | ✅ (is the authority) |
| Response Composer                                  | subsystems/RESPONSE_COMPOSER_PROMPT                 | schemas/RESPONSE_COMPOSER_SCHEMA ✅   | ✅ (N/A renders)              | ✅      | ✅                    |
| Finance                                            | domains/FINANCE_PROMPT                              | ↳ AGENT_OUTPUT_SCHEMA                 | ✅ (weights)                  | ✅      | ✅                    |
| Family                                             | domains/FAMILY_PROMPT                               | ↳                                     | ✅                            | ✅      | ✅                    |
| Career                                             | domains/CAREER_PROMPT                               | ↳                                     | ✅                            | ✅      | ✅                    |
| Education                                          | domains/EDUCATION_PROMPT                            | ↳                                     | ✅                            | ✅      | ✅                    |
| Health                                             | domains/HEALTH_PROMPT                               | ↳                                     | ✅                            | ✅      | ✅ (strictest)        |
| Document Intelligence                              | domains/DOCUMENT_INTELLIGENCE_PROMPT                | ↳                                     | ✅                            | ✅      | ✅                    |
| GraphRAG                                           | domains/GRAPHRAG_PROMPT                             | ↳                                     | ✅                            | ✅      | ✅                    |
| Decision Scientist                                 | domains/DECISION_INTELLIGENCE_PROMPT (consolidated) | schemas/DECISION_OUTPUT_SCHEMA ✅     | ✅                            | ✅      | ✅                    |
| Scenario                                           | ↳ DECISION_INTELLIGENCE_PROMPT                      | DECISION_OUTPUT_SCHEMA ✅             | ✅                            | ✅      | ✅                    |
| Tradeoff                                           | ↳ DECISION_INTELLIGENCE_PROMPT                      | DECISION_OUTPUT_SCHEMA ✅             | ✅                            | ✅      | ✅                    |
| Recommendation                                     | ↳ DECISION_INTELLIGENCE_PROMPT                      | DECISION_OUTPUT_SCHEMA ✅             | ✅                            | ✅      | ✅                    |
| Decision Explanation                               | ↳ DECISION_INTELLIGENCE_PROMPT                      | DECISION_OUTPUT_SCHEMA ✅             | ✅                            | ✅      | ✅                    |

**Result: all 25 agents are behaviorally covered.** Every prompt references its source spec + the base
layer, and carries confidence + failure + compliance expectations. Output schema is either a dedicated file
or the generic `AGENT_OUTPUT_SCHEMA` (domains inherit it by design — they emit the common envelope).

## 2. Base / cross-cutting coverage

| Base asset                                     | Present | Inherited by              |
| ---------------------------------------------- | ------- | ------------------------- |
| LIFE_NAVIGATOR_CONSTITUTION                    | ✅      | every LLM agent (Layer 1) |
| PROVENANCE / SAFETY / GOVERNANCE               | ✅      | every agent (Layer 2)     |
| CONFIDENCE / TOOL / GRAPH_RAG / MEMORY / STYLE | ✅      | cross-cutting             |

## 3. Task & example coverage

- Tasks: 11/11 present (home purchase, retirement, career change, education ROI, family protection, estate,
  insurance, debt payoff, emergency fund, medical safety, tax/legal safety).
- Composed examples: 6/6 present (onboarding, home purchase, career change, education ROI, family
  protection, compliance review) — each demonstrates all 10 layers with placeholders only.

## 4. Documented coverage gaps (intentional consolidations + to-iterate)

| Gap                                                                                                                                                      | Status                | Note                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal Discovery** — no dedicated prompt                                                                                                                 | covered, embedded     | its behavior (propose candidate goals) lives in ADVISOR/ONBOARDING; a dedicated prompt may be added when goal-discovery runs as a standalone agent.                                                                              |
| **Goal Conflict** — no dedicated prompt                                                                                                                  | covered, embedded     | its behavior (cited goal-to-goal tradeoffs) lives in DECISION_INTELLIGENCE + the Advisor's tradeoff questions; both are gated by the citation contract.                                                                          |
| **Decision agents consolidated** — Decision Scientist / Scenario / Tradeoff / Recommendation / Decision Explanation share `DECISION_INTELLIGENCE_PROMPT` | covered, consolidated | matches the prescribed file list. **Watch item:** the **Recommendation Agent** is the sole rec-minter (evidence-or-nothing) and may warrant its own dedicated prompt in a later iteration so its boundary is maximally explicit. |
| Domain prompts cite the generic schema, not a per-domain schema                                                                                          | by design             | domains emit the common envelope (`AGENT_OUTPUT_SCHEMA`); no per-domain schema file is needed.                                                                                                                                   |

These gaps do not break coverage — every behavior is specified somewhere and inherits the full base stack.
They are recorded so the orchestration phase can decide whether to split any consolidated prompt.
