# DOMAIN BACKEND PIPELINE MATRIX

**Date:** 2026-06-07 · **Status:** DESIGN ONLY. The end-to-end connection per domain: Frontend → Core API → Supabase → Worker → Qdrant/Neo4j → Gemini → Agents → back to Frontend.

Legend: ✅ exists · 🟡 partial · ➕ to build.

---

## Full-stack readiness matrix

| Domain                  | Frontend (Vercel)                       | Core API endpoints                         | Supabase tables                     | Sync triggers    | Worker enum                | Qdrant         | Neo4j labels                                 | Agent           | Recs            | Chat                        |
| ----------------------- | --------------------------------------- | ------------------------------------------ | ----------------------------------- | ---------------- | -------------------------- | -------------- | -------------------------------------------- | --------------- | --------------- | --------------------------- |
| **Finance**             | 🟡 pages exist (`/dashboard/finance/*`) | ➕ `/v1/finance/*` (13)                    | 🟡 12 exist, ➕ 9                   | 🟡 4 wired, ➕ 9 | 🟡 7 of 14                 | ✅ 1234 pts    | ✅ :FinancialAccount/:TransactionSummary +➕ | Finance         | ➕ store+engine | ✅ net worth/spend; ➕ rest |
| **Health & Wellness**   | 🟡 `/health-monitoring` routes          | ➕ `/v1/health/*` (12)                     | ➕ ~12 (only metrics/records exist) | 🟡 2 wired       | 🟡 7 of ~13                | ✅ shared coll | 🟡 :HealthProfile +➕                        | Health          | ➕              | ➕                          |
| **Career**              | ✅ `/dashboard/career/*`                | ➕ `/v1/career/*` (10)                     | 🟡 4 exist, ➕ 7                    | ✅ 3 wired       | 🟡 4 of 9                  | ✅             | 🟡 :CareerProfile/:Skill +➕                 | Career          | ➕              | ➕                          |
| **Family**              | 🟡 `/dashboard/family`                  | ➕ `/v1/family/*` (8)                      | 🟡 2 exist, ➕ 7                    | 🟡 member wired  | 🟡 1 of 8                  | ✅             | 🟡 :FamilyMember +➕                         | Family          | ➕              | ➕                          |
| **Education**           | ✅ `/dashboard/education/*`             | ➕ `/v1/education/*` (9)                   | 🟡 3 exist, ➕ 8                    | ✅ 2 wired       | 🟡 4 of 9                  | ✅             | 🟡 :EducationRecord/:Course +➕              | Education       | ➕              | ➕                          |
| **Goals**               | ✅ `/dashboard/goals`                   | 🟡 `/v1/goals` (port `/api/goals/*`)       | ✅ 6                                | ✅               | ✅ Goal\*                  | ✅             | ✅ :Goal/:GoalMilestone                      | Goal            | 🟡              | ✅                          |
| **Risk**                | 🟡 (in finance/goals)                   | ➕ `/v1/risk/*`                            | ✅ 3                                | ✅               | ✅ RiskAssessment          | ✅             | ✅ :RiskAssessment                           | Risk            | 🟡              | 🟡                          |
| **Calendar/Events**     | 🟡 `/dashboard/calendar`                | ➕ `/v1/calendar/*`                        | ✅ 2                                | ✅ (AUDIT)       | 🔍 CalendarEvent           | ✅             | 🔍 :CalendarEvent?                           | (Scenario/Orch) | ➕              | ➕                          |
| **Roadmap**             | 🟡 `/dashboard/roadmap`                 | ➕ `/v1/roadmap` (derived)                 | n/a (derived)                       | n/a              | n/a                        | n/a            | n/a (projection)                             | Orchestrator    | derived         | derived                     |
| **Decisions/Scenarios** | ✅ `/dashboard/scenario-lab`            | ➕ `/v1/decision/analyze`, `/v1/scenarios` | ✅ 11+                              | 🔍 (AUDIT)       | 🔍 LifeScenario*/Decision* | ✅             | 🔍 :LifeScenario?                            | Scenario        | 🟡              | 🟡                          |

---

## The seven-layer flow (every domain, identical shape)

```
1 Frontend (Vercel)        render view-model; no logic, no model key
        │ Bearer(user JWT)
2 Core API (Fly)           authenticate → DomainService.summary()/write()
        ├─ 3 Supabase      system of record (RLS read / service-role write)
        ├─ 4 Worker        (async) trigger→sync_queue→embed→upsert  [decoupled]
        ├─ 5 Qdrant+Neo4j  grounding retrieval (user-filtered)
        ├─ 6 Gemini        reasoning, behind Trust/Safety gate
        └─ 7 Agents        domain agent → Recommendation → Trust/Safety
        │ typed JSON contract
1 Frontend                 premium render (cards, recs, chat, missing-data prompts)
```

Writes flow 1→2→3, then the DB trigger asynchronously drives 4→5 (eventual graph freshness). Reads flow 2→3+5→6/7→1. The frontend only ever talks to layer 2.

---

## Cross-domain connection requirements (every domain wires to these)

| Shared surface    | How each domain connects                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Dashboard summary | each `DomainService.summary()` contributes a card to `GET /v1/life-profile`               |
| Recommendations   | each domain emits H-contract recs; Recommendation Agent ranks cross-domain                |
| Chat context      | each `DomainService.chat_context()` returns the G contract; orchestrator fuses            |
| User goals        | `(:Goal)` cross-linked: `SUPPORTS_GOAL`/`BLOCKS_GOAL`/`FUNDED_BY` edges from domain nodes |
| Risk profile      | `(:RiskAssessment)` referenced by Finance/Career/Family risk surfaces                     |
| Personal GraphRAG | every domain node carries `tenant_id=user_id`; retrieval user-scoped                      |
| Central GraphRAG  | methodology/governance corpus (`ln_central`, Phase 8) grounds recs + disclaimers          |
| Governance        | every AI output → Trust/Safety gate → `governance.decision_governance_audit`              |

---

## Immediate audit flags (highest `:Unknown` risk — do before relying on graph)

- **Calendar:** `calendar_event` trigger is live; verify enum variant exists (else `:Unknown`).
- **Scenarios/Decisions:** broad `scenario_*`/`decision_*` trigger surface; audit emitted `entity_type` vs enum.
- Run the in-container audit (`GRAPHRAG_ENTITY_PIPELINE_SPEC.md §2`) for both before Phase 9.
