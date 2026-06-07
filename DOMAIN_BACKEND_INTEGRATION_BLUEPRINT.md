# DOMAIN BACKEND INTEGRATION BLUEPRINT

**Date:** 2026-06-07
**Status:** DESIGN ONLY — no implementation in this document.
**Companion specs:** `CORE_API_ARCHITECTURE.md`, `DOMAIN_DATA_CONTRACTS.md`, `SUPABASE_SCHEMA_GAP_MAP.md`, `GRAPHRAG_ENTITY_PIPELINE_SPEC.md`, `HEALTH_WELLNESS_BACKEND_SPEC.md`, `IMPLEMENTATION_SEQUENCE_TO_10_10.md`.

---

## 0. Executive answer (read this first)

**Can the current architecture support this vision? — Yes, with one structural addition.**

The data foundation is already largely in place: every domain has Supabase tables, most have GraphRAG `sync_queue` triggers, the worker already knows ~120 `EntityType` variants, Qdrant + Neo4j are healthy, and chat retrieval works. **What is missing is the orchestration tier.** Today business logic lives in **~90 Next.js API routes on Vercel** (`/api/financial`, `/api/career/*`, `/api/education/*`, `/api/goals/*`, `/api/health-monitoring/*`, …). That violates the target principle ("frontend should not contain business logic") because Vercel route handlers ARE doing orchestration: reading Supabase, shaping payloads, calling the Edge function.

The fix is to introduce **`lifenavigator-core-api`** — a modular FastAPI service on Fly.io — as the single orchestration tier, and progressively move domain logic into it. Vercel becomes a thin rendering + auth-UI layer that calls the Core API.

### What moves to the Core API

- All domain **read orchestration** (assemble the view-model a page needs from Supabase + GraphRAG).
- All domain **write orchestration** (validate → write Supabase with service role → enqueue/trigger GraphRAG → return canonical result).
- **Chat context assembly** (the `graphrag-query` Edge function's job migrates here over time).
- **Recommendation assembly** and **decision/scenario analysis**.
- **Agent orchestration** (domain agents + Trust/Safety gate).

### What stays where it is

- **Vercel (frontend):** React rendering, auth UI, session cookie handling, thin BFF proxy routes that forward to Core API (no business logic), public app-URL env. **Never holds a Gemini key.**
- **Supabase:** system of record (all domain tables), RLS, auth, `chat.*` history, the `graphrag.sync_queue`. Edge `graphrag-query` stays **transitionally** until the Core API absorbs context assembly.
- **Fly worker (`lifenavigator-ingestion-worker`):** unchanged role — drains `sync_queue` → embeddings → Qdrant + Neo4j. Gains new `EntityType` variants as domains light up.
- **Qdrant / Neo4j:** grounding stores. No direct frontend access ever.
- **Gemini:** server-side only (worker for embeddings, Core API + Edge for reasoning).

### The non-negotiable sequencing rule (learned the hard way)

**A domain's `sync_queue` trigger must NOT be enabled until the worker `EntityType` enum has the matching variant.** The 2026-06-07 RiskAssessment incident proved that a trigger emitting an unknown `entity_type` silently produces `:Unknown` Neo4j nodes. `SUPABASE_SCHEMA_GAP_MAP.md` + `GRAPHRAG_ENTITY_PIPELINE_SPEC.md` enforce this ordering per domain.

---

## 1. Architecture rule (binding)

```
Frontend displays.        (Vercel / Next.js — render view-models, auth UI)
Core API orchestrates.    (FastAPI / Fly — lifenavigator-core-api)
Supabase stores.          (system of record + RLS + auth + sync_queue)
Worker syncs.             (Postgres → embeddings → Qdrant + Neo4j)
GraphRAG grounds.         (Qdrant vectors + Neo4j graph → retrieval)
Gemini reasons.           (server-side only; never in the browser)
```

Extends `ARCHITECTURE_BOUNDARIES.md`. The Core API is the new "Fly backend thinks" tier made concrete.

### Request lifecycle (canonical)

```
Browser ──HTTPS+cookie──▶ Vercel thin route ──Bearer(user JWT)──▶ Core API
                                                                     │
   ┌─────────────────────────────────────────────────────────────┘
   ▼
Core API domain service:
   1. authenticate (verify Supabase JWT) + load user context
   2. read system-of-record (Supabase, RLS-scoped or service-role as appropriate)
   3. ground (query Qdrant + Neo4j for the user's graph)
   4. reason (Gemini, behind Trust/Safety) — only for AI surfaces
   5. assemble a COMPLETE domain view-model (no client-side joining)
   6. return typed JSON contract
Writes additionally: validate → service-role write Supabase → (trigger auto-enqueues sync_queue) → return canonical row
```

---

## 2. Current-state inventory (discovered live, 2026-06-07)

| Layer                          | What exists today                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase schemas**           | `public` (76 tbl), `finance` (12), `health_meta` (7), `chat`, `graphrag`, `ingestion`, `governance`, `economic`, `outcome`, `analytics`, `ops`, `feedback`, `security`, `connectors`, `models`, `platform`, `projections`, `enterprise`, `core`                                                                                                                                                                                                                                          |
| **Domain tables**              | finance._ ; public.goals(+milestones/deps/benefits/reminders/updates) ; public.risk*assessments(+category_scores/recommendations) ; public.career_profiles/career_connections/job_applications/resumes ; public.education_records/courses/degree_analyses ; public.family_members/family_appointments ; public.calendar_events/calendar_connections ; public.scenario*_(labs/inputs/versions/runs/reports) ; public.decision_outcomes ; public.habits/habit_completions ; health_meta.\* |
| **GraphRAG triggers (wired)**  | finance.\* , goals, risk_assessments, career_profiles, career_connections, job_applications, education_records, courses, family_members, calendar_events, health_meta.health_metrics, health_meta.health_records, user_persona_profile, resumes, documents                                                                                                                                                                                                                               |
| **Worker EntityType variants** | ~120 incl. Goal, RiskAssessment, Career*, Education*, FamilyMember, Health*, LifeScenario*, Decision\* (full list drives `GRAPHRAG_ENTITY_PIPELINE_SPEC.md`)                                                                                                                                                                                                                                                                                                                             |
| **Vercel API routes**          | ~90, incl. /api/financial, /api/goals/_, /api/career/_, /api/education/_, /api/health-monitoring/_, /api/dashboard/summary, /api/discovery/_, /api/agent/chat, /api/governance/_, /api/arcana/\*                                                                                                                                                                                                                                                                                         |
| **Agents (builtin registry)**  | advisor.core, optimizer.dynamic_goal, arcana.health, arcana.longevity, arcana.compliance, arcana.provider_coordination, arcana.orchestrator, provider.portal                                                                                                                                                                                                                                                                                                                             |
| **Edge functions**             | graphrag-query (chat context + Gemini generate), graphrag-sync (legacy, text-embedding-004 — retire)                                                                                                                                                                                                                                                                                                                                                                                     |

**Implication:** this is a _consolidation + completion_ effort, not greenfield. Most "missing" pieces are (a) the orchestration tier, (b) a handful of domain tables (esp. wellness), (c) `EntityType` variants for a few domains, and (d) trigger/enum alignment audits.

---

## 3. Per-domain ownership matrix (A + B summary)

Detailed contracts live in the companion docs; this is the index.

| #   | Domain                    | Frontend surfaces (A)                                                                  | Core API endpoints (B)                                                        | Data maturity                                                                                                                          |
| --- | ------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Finance**               | dashboard card, /finance detail, onboarding (Plaid link), chat context, recs, settings | `GET /v1/finance/summary`, `/v1/finance/accounts`, `/v1/finance/transactions` | ✅ tables+triggers+entity types+route (`/api/financial`) — **reference implementation**                                                |
| 2   | **Health & Wellness**     | card, /health detail, onboarding (wellness intake), chat, recs, settings               | `GET /v1/health/summary`, `POST /v1/health/profile`, `POST /v1/health/habit`  | 🟡 health_meta.\* + habits exist; **wellness profile/sleep/exercise/nutrition tables missing** — see `HEALTH_WELLNESS_BACKEND_SPEC.md` |
| 3   | **Career**                | card, /career detail, onboarding, chat, recs, settings                                 | `GET /v1/career/summary`, `POST /v1/career/profile`                           | 🟡 tables+triggers+routes exist; needs Core API consolidation + enum/trigger audit                                                     |
| 4   | **Education**             | card, /education detail, onboarding, chat, recs, settings                              | `GET /v1/education/summary`, `POST /v1/education/profile`                     | 🟡 tables+triggers+routes exist; consolidate                                                                                           |
| 5   | **Family**                | card, /family detail, onboarding, chat, recs, settings                                 | `GET /v1/family/summary`, `POST /v1/family/profile`                           | 🟡 family_members/appointments exist; thin; needs view-model + recs                                                                    |
| 6   | **Goals**                 | card, /goals detail, onboarding, chat, recs, settings                                  | `GET/POST /v1/goals`, `GET /v1/goals/{id}`                                    | ✅ rich (milestones, probability, progress) — second reference                                                                         |
| 7   | **Risk**                  | card (in finance/goals), /risk detail, onboarding (assessment), chat, recs             | `GET /v1/risk/summary`, `POST /v1/risk/assessment`                            | ✅ tables+trigger+enum (fixed today)                                                                                                   |
| 8   | **Calendar / Events**     | card, /calendar detail, onboarding (connect), chat, recs                               | `GET /v1/calendar/events`, `POST /v1/calendar/event`                          | 🟡 tables+trigger exist; connectors integration                                                                                        |
| 9   | **Roadmap**               | card, /roadmap detail (cross-domain timeline), chat                                    | `GET /v1/roadmap` (derived, no own table)                                     | 🔴 derived view across goals+scenarios+events; **no own store**                                                                        |
| 10  | **Decisions / Scenarios** | card, /scenario-lab detail, chat, recs                                                 | `POST /v1/decision/analyze`, `GET /v1/scenarios`, `POST /v1/scenarios`        | 🟡 scenario\_\* tables exist; decision entity/trigger audit needed                                                                     |

Cross-cutting: `POST /v1/chat/context` (domain-aware context assembly), `GET /v1/life-profile` (unified cross-domain view), `POST /v1/recommendations` (assembly).

---

## 4. Agent ownership (E)

Today there is effectively **one advisor agent** (`advisor.core`) plus Arcana health agents and an optimizer. The target is a **hierarchical roster** orchestrated by the Core API, each agent owning a domain's reasoning and emitting through the Trust/Safety gate (the existing constitutional/character/governance stack).

| Agent                    | Owns                                                                     | Backed by today                  |
| ------------------------ | ------------------------------------------------------------------------ | -------------------------------- |
| **Finance Agent**        | finance reasoning, net-worth/cashflow narratives                         | advisor.core (split out)         |
| **Health Agent**         | wellness reasoning under medical-disclaimer boundaries                   | arcana.health / arcana.longevity |
| **Career Agent**         | career trajectory, skills gap, job match                                 | (new)                            |
| **Education Agent**      | learning path, credential ROI                                            | (new)                            |
| **Family Agent**         | family logistics, dependents planning                                    | (new)                            |
| **Goal Agent**           | goal feasibility, milestones, probability                                | optimizer.dynamic_goal           |
| **Risk Agent**           | risk tolerance, exposure, mitigation                                     | (new; reads risk_assessments)    |
| **Scenario Agent**       | what-if simulation, decision analysis                                    | (new; reads scenario\_\*)        |
| **Recommendation Agent** | cross-domain recommendation synthesis                                    | recommendations.ts (promote)     |
| **Trust/Safety Agent**   | governance + constitutional + character + injection gate on every output | governance/\* (exists, reused)   |

Orchestration pattern: **Recommendation Agent** and **chat** fan out to domain agents (read-only, grounded), then the **Trust/Safety Agent** gates the merged output before release. Mirrors `arcana.orchestrator`. Detailed in `IMPLEMENTATION_SEQUENCE_TO_10_10.md` Phase 9.

---

## 5. How this avoids "a mess" (design invariants)

1. **One orchestration tier.** No business logic in Vercel routes after migration; they become typed proxies. No domain logic in the worker (sync only). No cross-domain joins in the browser.
2. **One write path per table.** Service-role writes go through a Core API domain service; the authenticated client never writes domain tables directly (RLS owner-read only, per the migration-116 pattern).
3. **Contracts are the API.** Each page receives ONE complete view-model (`DOMAIN_DATA_CONTRACTS.md`). Frontend never assembles from multiple sources.
4. **Enum-before-trigger.** No trigger ships before its worker `EntityType` variant (`GRAPHRAG_ENTITY_PIPELINE_SPEC.md`).
5. **Grounding is read-only and user-scoped.** All Neo4j queries filter `tenant_id = user_id`; all Qdrant queries filter by user. The Core API never returns another user's graph.
6. **Trust/Safety is mandatory on AI output.** Every Gemini-generated payload passes the governance gate before leaving the Core API.
7. **Strict layering for keys.** Gemini keys only on Fly (worker, core-api) + Edge transitionally. Never Vercel.

---

## 6. Final answer (the four questions)

**Q: Can the current architecture support this?**
Yes. Supabase + worker + Qdrant + Neo4j + the governance stack are sound and already multi-domain. The missing piece is the orchestration tier; introducing `lifenavigator-core-api` and migrating route logic into it completes the model without re-platforming.

**Q: What needs to move to the Core API?**
Domain read/write orchestration, chat-context assembly, recommendation synthesis, decision/scenario analysis, and agent orchestration — i.e. everything currently embedded in the ~90 Vercel API routes and the `graphrag-query` Edge function.

**Q: What stays in Vercel / Supabase / Worker?**
Vercel = rendering + auth UI + thin proxy (no logic, no model keys). Supabase = system of record + RLS + auth + chat history + sync_queue. Worker = sync only (Postgres → Qdrant + Neo4j), gaining enum variants per domain.

**Q: The exact sequence to connect every domain without a mess?**
The 10-phase plan in `IMPLEMENTATION_SEQUENCE_TO_10_10.md`: finish finance/persona (Phase 0) → stand up the Core API skeleton (Phase 1) → migrate finance read/write + chat-context through it as the reference (Phase 2) → unified `/v1/life-profile` (Phase 3) → then domains in order Health → Career → Education → Family (Phases 4–7), each gated by the enum-before-trigger rule and a per-domain contract → central GraphRAG seed (Phase 8) → hierarchical agent orchestration (Phase 9). Each phase is independently shippable and reversible.
