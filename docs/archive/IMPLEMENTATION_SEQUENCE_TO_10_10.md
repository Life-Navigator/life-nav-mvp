# IMPLEMENTATION SEQUENCE TO 10/10 (J · K)

**Date:** 2026-06-07 · **Status:** DESIGN ONLY — execution plan, not executed here.

The exact order to connect every domain through the Core API without creating a mess. Each phase is independently shippable, reversible, and gated by acceptance criteria.

---

## J. Migration strategy (do this discipline every phase)

**Apply (forward-only, 116-pattern):** new domain tables, RLS (owner-read + service + owner-write `WITH CHECK`), `security_invoker` public views, and triggers — but **triggers last**, after the worker enum variant exists.

**Retire:**

- `graphrag-sync` Edge function (legacy `text-embedding-004`; superseded by the Rust worker).
- Plain (security_definer) views over user tables — none should remain after the 116 pattern is universal.

**Rewrite / reconcile:**

- **Migration drift 105–110** (unapplied to prod; `public.persona_event` absent). Decide per table: apply if a live feature needs it, else record in a `MIGRATION_LINEAGE.md` as intentionally retired. 111–116 depend on none of them, so this is not blocking — but resolve before adding migrations that _do_ depend on 105–110 objects.

**Schema-drift guardrails:**

- Never `supabase db push --include-all` against prod (would replay 105–110). Apply migrations explicitly (direct psql or targeted push), record in `supabase_migrations.schema_migrations`.
- One write path per table (Core API service-role). No new authenticated direct-write grants except the 116 owner-write policies.

**Worker enum variants required BEFORE enabling triggers (the gate):**
| Domain | Variants to confirm/add before its trigger |
| --- | --- |
| Calendar | 🔍 `calendar_event` (AUDIT NOW — trigger already live) |
| Scenarios/Decisions | 🔍 `life_scenario*`, `decision*` alignment (AUDIT NOW) |
| Family | ➕ `family_appointment` |
| Health | ➕ `sleep_log`; confirm `workout_log`/`nutrition_log`/`supplement_log`/`health_profile` |
| Career | ➕ `career_connection` (if connections need own nodes) |
Each: add variant → `cargo test --lib` → `fly deploy` worker → insert test row → verify `:Label` + `:Unknown`=0 in-container.

---

## K. Phased execution sequence

### Phase 0 — Finish finance/persona path (IN PROGRESS → near done)

- ✅ RiskAssessment enum (done 2026-06-07; `:RiskAssessment` verified, `:Unknown`=0).
- ☐ Sidebar 1/10: per user, the `comingSoon` domains stay visible-disabled and are unlocked in order (decision: leave; not a blocker).
- ☐ 12/12 smoke: currently 10 clean PASS; Steps 1/10 are the held sidebar decision.
- **Exit:** finance/persona/chat fully working; verdict `READY_WITH_P0_FIXES` (→ `WORKING_APP_READY` when sidebar handled).

### Phase 1 — Core API skeleton (`lifenavigator-core-api` on Fly)

- `/healthz` + `/readyz`; auth middleware (verify Supabase JWT); Supabase anon + service-role clients; Qdrant + Neo4j + Gemini clients (reuse api-gateway secrets); `UserContext` DI; `DomainService` ABC + empty domain router structure; CORS to lifenavigator.tech; structured logging + cost meter.
- **Exit:** authenticated `/v1/ping` returns `UserContext`; `/readyz` confirms Supabase/Qdrant/Neo4j reachable. No domain logic yet.

### Phase 2 — Finance through Core API (the reference migration)

- Implement `domains/finance.py` (`summary`, `detail`, `chat_context`) → `GET /v1/finance/summary` matching the `FinanceSummary` contract.
- Port grounding (`grounding/retriever.py`, `context.py`) from `graphrag-query`.
- Vercel `/api/financial` becomes a thin proxy to `/v1/finance/summary`; `/dashboard/finance` renders the view-model (no client compute).
- Recommendations exposed via `/v1/recommendations` (finance slice). Chat-context callable.
- **Exit:** finance dashboard + chat answer net worth/spending **through the Core API**, identical or better than today; `/api/financial` holds no business logic.

### Phase 3 — Unified life profile + retire api-gateway

- `GET /v1/life-profile` iterating registered `DomainService`s (finance, goals, risk live; others return `missing`).
- Migrate `/api/agent/chat` to call `POST /v1/chat/context` + `/v1/chat` (Core API owns context assembly + Gemini-behind-Trust/Safety). Edge `graphrag-query` becomes fallback.
- Retire `apps/api-gateway` once parity reached.
- **Exit:** one call renders a cross-domain command center; chat orchestration lives in Core API.

### Phase 4 — Health & Wellness (first net-new domain) — see `HEALTH_WELLNESS_BACKEND_SPEC.md`

- Schema (wellness_profile, sleep/exercise/nutrition/supplement logs) + RLS + views.
- Worker: add `sleep_log` (+confirm others) → deploy → enable triggers → audit `:Unknown`=0.
- `domains/health.py` + `GET /v1/health/summary` + recommendations with **medical-boundary gate**.
- `/dashboard/health` renders; unlock "Healthcare" in the sidebar.
- **Exit:** health smoke (real logged data answer + disclaimer + red-flag escalation) passes.

### Phase 5 — Career

- Consolidate `/api/career/*` into `domains/career.py`; add `career_skills` if needed; enum/trigger audit; `GET /v1/career/summary`; unlock Career.

### Phase 6 — Education

- Consolidate `/api/education/*` into `domains/education.py`; verify study_logs/certifications backing; `GET /v1/education/summary`; unlock Education.

### Phase 7 — Family

- `domains/family.py`; add `family_appointment` variant + dependents-planning; `GET /v1/family/summary`; unlock Family.

### Phase 8 — Central GraphRAG seed + governance knowledge

- Seed `ln_central` (financial-planning methodology, wellness guidelines, compliance language) so CENTRAL_CONTEXT carries weight; re-enable the (currently stripped) central block in context assembly. Governance/disclaimer corpus lives here.
- **Exit:** chat cites methodology, not just personal data; disclaimers sourced from central.

### Phase 9 — Hierarchical agent orchestration

- Split `advisor.core` into domain agents (Finance/Health/Career/Education/Family/Goal/Risk/Scenario) under an orchestrator (mirror `arcana.orchestrator`); Recommendation Agent fans out → merges → Trust/Safety gate.
- Calendar + Roadmap + Scenario surfaces finalized (Roadmap = derived projection; Scenario via `POST /v1/decision/analyze`).
- **Exit:** cross-domain questions answered by the right agent(s) with grounded, gated output; all 10 sidebar domains live.

---

## Phase dependency graph

```
Phase 0 (finance/persona) ──▶ Phase 1 (Core API skeleton)
                                   │
                                   ▼
                              Phase 2 (finance via Core API) ──▶ Phase 3 (life-profile + chat + retire gateway)
                                                                      │
        ┌──────────────────────────┬──────────────┬─────────────────┘
        ▼                          ▼              ▼
   Phase 4 Health           Phase 5 Career   Phase 6 Education ──▶ Phase 7 Family
        │                                                              │
        └───────────────────────────┬──────────────────────────────────┘
                                     ▼
                          Phase 8 (central seed) ──▶ Phase 9 (agent orchestration)
```

Phases 4–7 are parallelizable once Phase 3 lands (independent domains), but recommend **serial in the agreed order Health → Career → Education → Family** to keep the enum-before-trigger discipline and review surface tight.

---

## Per-phase acceptance gate (apply to every phase)

1. Migrations forward-only, 116-pattern, recorded; no `--include-all`.
2. Worker enum variant exists + deployed before any new trigger; `:Unknown`=0 audit passes.
3. Domain returns ONE complete contract; frontend render-only (no client joins/compute).
4. RLS: non-owner read = 0; owner read/write works (rollback-tested, in-container Neo4j checks).
5. AI output passes Trust/Safety gate; recommendations carry evidence+assumptions+confidence+(escalation if medical/legal/financial-advice).
6. No new 5xx; no RLS regression; cost metered.
7. Reversible: feature-flag the new domain; sidebar unlock is the last step.

---

## Definition of 10/10

All 10 domains: live tables + aligned triggers/enum (`:Unknown`=0 everywhere) + Core API contract + render-only frontend + grounded, gated chat/recommendations + owner-isolated RLS + no Gemini on Vercel + central corpus seeded + hierarchical agents. The finance/persona path (Phase 0) is the proof that this pattern works end-to-end; every subsequent domain replays it.
