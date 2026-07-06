# IMPLEMENTATION SEQUENCE TO FULL PLATFORM

**Date:** 2026-06-07 · **Status:** DESIGN ONLY — execution plan, not executed. Build order: **Finance → Health → Career → Family → Education** (Education last). Extends `IMPLEMENTATION_SEQUENCE_TO_10_10.md` with the elite per-domain depth.

---

## Foundation (must precede all domain work)

**F0 — finish finance/persona path (near done):** RiskAssessment enum ✅ (done); sidebar decision = leave disabled "Coming Soon" + unlock per domain; smoke 10/12 live. Verdict `READY_WITH_P0_FIXES`.

**F1 — Core API skeleton** (`lifenavigator-core-api`, FastAPI/Fly): `/healthz`+`/readyz`, JWT auth middleware, Supabase anon+service clients, Qdrant/Neo4j/Gemini clients, `UserContext`, `DomainService` ABC, router scaffold, Trust/Safety port, cost meter. (= `CORE_API_ARCHITECTURE.md`.)

**F2 — Core API grounding + chat**: port `graphrag-query` retrieval into `grounding/`; `POST /v1/chat/context` + `/v1/chat`; Memory + Recommendation + Trust/Safety agents online.

Every domain below replays the SAME 8-step recipe.

---

## The per-domain recipe (replayed for each of the 5 domains)

```
1. Schema:   migrations (116-pattern) for missing tables + indexes + updated_at
2. RLS:      owner-read + service-write + zz_auth_owner_insert/update; security_invoker views
3. Worker:   add EntityType variants + normalizer summary/relationship cases + tests → fly deploy
4. Triggers: enable enqueue_sync triggers (ONLY after step 3)
5. Audit:    insert test rows → verify :Label nodes + :Unknown=0 (in-container)
6. Core API: domains/<x>.py (summary/detail/write/chat_context/recommendations) + contracts + router
7. Frontend: wire pages to /v1/<x>/* view-models (render-only); premium missing-data prompts
8. Verify:   acceptance criteria (below) → unlock sidebar domain
```

**Gate:** never enable a trigger (step 4) before its enum variant exists (step 3). This is the single most important sequencing rule (RiskAssessment precedent).

---

## Phase plan

### Phase 1 — FINANCE to elite (`FINANCE_DOMAIN_COMPLETION_REPORT.md`)

- +9 tables (snapshots, budget/income/expense, recommendations, events), +7 enum variants, snapshot cron.
- 13 `/v1/finance/*` endpoints; 12 UI surfaces; hero screen fully populated; rec library; 8 chat questions live.
- **Reference implementation** — proves the recipe end-to-end before scaling.

### Phase 2 — HEALTH & WELLNESS (`HEALTH_WELLNESS_DOMAIN_SPEC.md` + `_BACKEND_SPEC.md`)

- +~12 health_meta tables; +~6 enum variants; medical-safety gate wired + tested (no diagnosis/treatment, escalation).
- `/v1/health/*` (12); Wellness Overview + 9 surfaces; gated recs; wellness chat. Unlock "Healthcare".

### Phase 3 — CAREER (`CAREER_DOMAIN_SPEC.md`)

- +7 tables; +5 enum variants; `/v1/career/*` (10); Career Overview + 6 surfaces; skill-gap/comp recs; career chat. Unlock "Career".

### Phase 4 — FAMILY (`FAMILY_DOMAIN_SPEC.md`)

- +7 tables; +7 enum variants; legal/tax escalation; `/v1/family/*` (8); Family Overview + 7 surfaces; protection-gap recs; family chat. Unlock "Family".

### Phase 5 — EDUCATION (`EDUCATION_DOMAIN_SPEC.md`) — LAST

- +8 tables; +8 enum variants; ROI models (cross-link Career comp + Finance funding); `/v1/education/*` (9); Education Overview + 6 surfaces; ROI recs; education chat. Unlock "Education".

### Phase 6 — Calendar + Roadmap + Scenarios finalize

- Calendar connector sync + enum audit; Roadmap derived projection (`GET /v1/roadmap`); Scenario/Decision enum audit + `/v1/decision/analyze`.

### Phase 7 — Central GraphRAG seed (`ln_central`)

- Methodology + compliance + disclaimer corpus; re-enable CENTRAL_CONTEXT; governance ontology edges.

### Phase 8 — Hierarchical agent orchestration (`MULTI_AGENT_ORCHESTRATION_PLAN.md`)

- Life Orchestrator true multi-domain fan-out/merge; all 12 agents; cross-domain questions answered by traversal.

---

## Dependency notes

- Finance (Phase 1) unblocks the funding/ROI cross-edges that Family + Education depend on → Education last.
- Career compensation feeds Education ROI → Career before Education.
- Risk + Goals are already live and cross-cut all domains (no own phase; consumed everywhere).
- Phases 2–5 are serial (review surface + enum discipline), but Core API + schema work within a phase can parallelize.

---

## ACCEPTANCE CRITERIA (per domain — all 15 must pass to unlock)

1. Backend `/v1/<domain>/*` endpoints return view-models. 2. Supabase tables exist + indexed. 3. RLS owner-only test passes (non-owner=0, owner sees own). 4. Sync triggers fire. 5. Worker processes domain entities. 6. Qdrant receives vectors (entity_type preserved). 7. Neo4j correct labels (`:Unknown`=0). 8. Dashboard renders REAL data (no empty/fake tiles). 9. Recommendations render (H contract, gated). 10. Chat answers domain questions, grounded. 11. Missing data handled gracefully (premium prompts). 12. No hallucinations (authoritative facts + missing-facts asked). 13. No broken pages. 14. No empty fake dashboards. 15. UI is premium. Plus: no new 5xx, no RLS regression, Gemini server-side only.

---

## FINAL VERDICT

```
FULL_PLATFORM_BUILD_PLAN_READY
```

**Rationale:** the architecture supports the full elite platform with no re-platforming. Foundations are real and verified live — Supabase system-of-record across all 10 domains, a healthy GraphRAG pipeline (worker → Qdrant 1234 / Neo4j with `:Unknown`=0), a working governance/Trust-Safety gate, and chat that already grounds on real data. The plan is a disciplined, phased completion: introduce `lifenavigator-core-api` as the orchestration tier, then replay one proven 8-step recipe per domain in the order Finance → Health → Career → Family → Education, gated by enum-before-trigger and the migration-116 RLS pattern.

**Known architecture gaps to resolve in-flight (not blockers, tracked):**

1. Core API does not yet exist (Phase F1) — the central new build.
2. Elite Finance needs +9 tables / +7 enum variants (snapshots, budgeting, recs store).
3. Health/Career/Family/Education elite tables are largely missing (+~34 tables total) — expected greenfield within the recipe.
4. **Calendar + Scenario/Decision triggers need an immediate `:Unknown` audit** (live triggers, unverified enum alignment — the next RiskAssessment-style trap).
5. Migration drift 105–110 (apply-or-retire) before adding dependent migrations.
6. CENTRAL_CONTEXT empty until Phase 7 seed.

None of these is architectural; all are scoped, sequenced work in this plan. **Proceed.**

---

## Deliverable index (this sprint)

`FINANCE_DOMAIN_COMPLETION_REPORT.md` · `HEALTH_WELLNESS_DOMAIN_SPEC.md` · `CAREER_DOMAIN_SPEC.md` · `FAMILY_DOMAIN_SPEC.md` · `EDUCATION_DOMAIN_SPEC.md` · `DOMAIN_BACKEND_PIPELINE_MATRIX.md` · `MULTI_AGENT_ORCHESTRATION_PLAN.md` · `SEMANTIC_ONTOLOGY_IMPLEMENTATION_PLAN.md` · `IMPLEMENTATION_SEQUENCE_TO_FULL_PLATFORM.md` — plus the 7 prior design docs (`DOMAIN_BACKEND_INTEGRATION_BLUEPRINT.md`, `CORE_API_ARCHITECTURE.md`, `DOMAIN_DATA_CONTRACTS.md`, `SUPABASE_SCHEMA_GAP_MAP.md`, `GRAPHRAG_ENTITY_PIPELINE_SPEC.md`, `HEALTH_WELLNESS_BACKEND_SPEC.md`, `IMPLEMENTATION_SEQUENCE_TO_10_10.md`).
