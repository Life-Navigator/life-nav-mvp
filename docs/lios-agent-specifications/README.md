# LIOS Agent Specification Layer

> The formal contracts that define how every LifeNavigator agent thinks, communicates, escalates, and
> validates. **Specification only** — no code, no prompts, no runtime behavior. This layer is the foundation
> for Phase 2 (Prompt OS), Phase 3 (Gemini Orchestration), Phase 4 (Multi-agent execution), and Phase 5
> (Vertex / Claude). It builds on the architecture set in the repo root (`LIOS_ARCHITECTURE.md` and the
> lifecycle docs).

## Cross-cutting contracts (read these first)

- `AGENT_INTERACTION_CONTRACTS.md` — who may talk to whom; the DAG; the five structural laws.
- `AGENT_OUTPUT_SCHEMAS.md` — the common envelope every agent returns + shared sub-objects.
- `AGENT_CONFIDENCE_MODEL.md` — the one confidence formula (never vibes); components + weights + bands.
- `AGENT_FAILURE_BEHAVIOR.md` — the six standard outcome states.
- `AGENT_ESCALATION_MODEL.md` — when to escalate / block / request data / request confirmation.
- `SPEC_VALIDATION_REVIEW.md` — the consistency review + documented gaps.

## Agent specifications (25), each on the same 15-section template

**Governance:** `ORCHESTRATOR_AGENT` · `COMPLIANCE_AGENT` · `CRITIC_AGENT` · `AUDIT_AGENT`
**Conversation:** `ADVISOR_AGENT` · `ONBOARDING_AGENT` · `RESPONSE_COMPOSER_AGENT`
**Reasoning / Life-Model:** `LIFE_MODEL_AGENT` · `GOAL_DISCOVERY_AGENT` · `GOAL_CONFLICT_AGENT` · `MISSING_DATA_AGENT`
**Knowledge:** `MEMORY_AGENT` · `GRAPHRAG_AGENT` · `DOCUMENT_INTELLIGENCE_AGENT`
**Execution:** `TOOL_EXECUTION_AGENT`
**Domains:** `FINANCE_AGENT` · `FAMILY_AGENT` · `CAREER_AGENT` · `EDUCATION_AGENT` · `HEALTH_AGENT`
**Decision Intelligence:** `DECISION_SCIENTIST_AGENT` · `SCENARIO_AGENT` · `TRADEOFF_AGENT` · `RECOMMENDATION_AGENT` · `DECISION_EXPLANATION_AGENT`

`FINANCE_AGENT.md` is the canonical exemplar of the 15-section template.

## The 15-section template

1 Identity · 2 Ownership · 3 Boundaries · 4 Inputs · 5 Outputs (schema) · 6 Cognitive Framework ·
7 Tool Rules · 8 GraphRAG Rules · 9 Memory Rules · 10 Confidence Model · 11 Escalation Rules ·
12 Failure Behavior · 13 Compliance Requirements · 14 Example Scenarios (5+5+5) · 15 Unit Test Matrix.

## The invariants every agent obeys

Rules guide; the LLM leads; the LLM never writes. No fabrication (numbers must be the user's; relationships
need a real cited edge; recommendations need evidence). Only Tool Execution persists. Compliance gates every
user-facing output. Honest empty states. Provenance on every fact. No agent calls another directly — all
routing is via the Orchestrator (an acyclic, hop-bounded graph). Only the Response Composer faces the user,
and only after Compliance.
