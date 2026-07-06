# INTELLIGENCE ARCHITECTURE AUDIT — LifeNavigator

**Date:** 2026-06-06
**Scope:** Sections A (Supabase system-of-record), E (Recommendations), F (Decision Intelligence), G (Target architecture).
**Companion to:** `GRAPHRAG_PIPELINE_AUDIT.md` (B/C/D — graph pipeline + central + context) and `DATA_FLOW_VERIFICATION_REPORT.md` (live verification + final verdict).

This document does NOT repeat the live counts from those two. Read those for the live state. This document is the architectural map and ownership classification.

---

## A. Supabase system-of-record audit

### Per-domain inventory (live state)

**Legend:** _write path_ = which app code paths INSERT to the table · _read path_ = who reads it · _graph?_ = does a sync_queue trigger fire onto graphrag.sync_queue.

#### Finance

| Table                            | Exists                            | Write path                                                            | Read path                                                                                                                           | Owner        | Graph?                          | Status                       |
| -------------------------------- | --------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------- | ---------------------------- |
| `finance.financial_accounts`     | ✓                                 | `lib/integrations/plaid/persist.ts` (persona activation + Plaid sync) | `/api/financial`, `/api/integrations/plaid/accounts`, `lib/finance/recommendations.ts`, Edge Function AUTHORITATIVE_FINANCIAL_FACTS | service-role | YES — trigger                   | **LIVE**                     |
| `finance.transactions`           | ✓                                 | same                                                                  | same                                                                                                                                | service-role | YES — trigger                   | **LIVE**                     |
| `finance.assets`                 | ✓                                 | (manual entry; route not user-reachable)                              | `/api/financial` (some sub-pages)                                                                                                   | service-role | YES (per 074 — but 074 skipped) | **PARTIAL**                  |
| `finance.investment_holdings`    | ✓ (per 031)                       | none currently                                                        | none                                                                                                                                | service-role | (no trigger)                    | **UNUSED**                   |
| `finance.financial_goals`        | ✓                                 | none currently                                                        | none                                                                                                                                | service-role | (no trigger)                    | **UNUSED**                   |
| `finance.plaid_items`            | ✓                                 | `/api/integrations/plaid/exchange`                                    | `/api/integrations/plaid/*`                                                                                                         | service-role | yes                             | **LIVE**                     |
| `finance.tax_profiles`           | ✓ (per 031)                       | none                                                                  | none                                                                                                                                | service-role | none                            | **UNUSED**                   |
| `finance.employer_benefits`      | ✓                                 | none                                                                  | none                                                                                                                                | service-role | none                            | **UNUSED**                   |
| `finance.retirement_plans`       | ✓                                 | none                                                                  | none                                                                                                                                | service-role | none                            | **UNUSED**                   |
| `finance.user_financial_profile` | ✓ (per 074 — uncertain on remote) | none                                                                  | recommendations engine reads `public.user_persona_profile` instead                                                                  | n/a          | n/a                             | n/a                          |
| `finance.debts`                  | per 074                           | none                                                                  | none                                                                                                                                | n/a          | n/a                             | n/a                          |
| `finance.budgets`                | NOT ON REMOTE                     | n/a                                                                   | n/a                                                                                                                                 | n/a          | n/a                             | **BROKEN** (page expects it) |
| `finance.investments`            | NOT ON REMOTE                     | n/a                                                                   | n/a                                                                                                                                 | n/a          | n/a                             | **BROKEN**                   |

#### Career

| Table                                                | Exists                          | Status     | Notes                                         |
| ---------------------------------------------------- | ------------------------------- | ---------- | --------------------------------------------- |
| `career.career_profile`                              | NOT ON REMOTE                   | **BROKEN** | `/dashboard/career` calls `/api/career` → 404 |
| `career.jobs`                                        | NOT ON REMOTE                   | **BROKEN** |                                               |
| `career.skills`                                      | NOT ON REMOTE                   | **BROKEN** |                                               |
| `public.career_profile` (from migration 032 applied) | UNKNOWN                         | UNVERIFIED | Need direct probe                             |
| `public.career_resumes`                              | ✓ (`/api/career/resumes` works) | **LIVE**   | the one career-domain route that works        |

#### Education

| Table                             | Exists                   | Status  | Notes                                             |
| --------------------------------- | ------------------------ | ------- | ------------------------------------------------- |
| `public.education_courses`        | likely yes (032 applied) | PARTIAL | `/api/education/courses` exists; verify populated |
| `public.education_certifications` | likely yes               | PARTIAL | `/api/education/certifications` exists            |
| `public.education_records`        | likely yes               | PARTIAL | `/api/education/records` exists                   |
| `education.learning_paths`        | NO (schema missing)      | BROKEN  | `/api/education/learning-paths` partial           |

#### Health & Wellness

| Table                        | Exists                            | Status | Notes                        |
| ---------------------------- | --------------------------------- | ------ | ---------------------------- |
| `health.health_records`      | NO (schema missing)               | BROKEN | 4 sub-page endpoints all 404 |
| `health.appointments`        | NO                                | BROKEN |                              |
| `health.documents`           | NO                                | BROKEN |                              |
| `health_meta.workout_logs`   | NO (table absent; schema present) | BROKEN | migration 069 skipped        |
| `health_meta.health_profile` | NO                                | BROKEN | same                         |

#### Family

| Table                                | Exists | Status       | Notes                                          |
| ------------------------------------ | ------ | ------------ | ---------------------------------------------- |
| `family.members`, `family.pets` etc. | NO     | NOT INGESTED | migration 066 skipped; page not user-reachable |

#### Goals + Risk

| Table                         | Exists        | Write path                                                               | Read path                                     | Graph?                       | Status                                         |
| ----------------------------- | ------------- | ------------------------------------------------------------------------ | --------------------------------------------- | ---------------------------- | ---------------------------------------------- |
| `public.goals`                | ✓             | `/api/goals` POST                                                        | `/api/goals` GET, `/dashboard/goals` page     | NO trigger (074/076 skipped) | **LIVE** in Supabase, **NOT FLOWING** to graph |
| `public.risk_assessments`     | ✓             | `/api/onboarding/risk-profile`, `/api/risk-assessment`                   | `/api/risk-assessment` GET                    | NO trigger                   | **LIVE**, not in graph                         |
| `public.user_persona_profile` | ✓             | `/api/integrations/plaid/activate-persona` (via `persistPersonaProfile`) | recommendations engine, Edge Function         | YES — 52 jobs queued         | **LIVE**                                       |
| `public.user_preferences`     | ✓             | `/api/conversation/analysis` POSTs `conversation_analysis` JSONB         | not currently read by recommendations or chat | none                         | **LIVE** but unused downstream                 |
| `public.goal_hierarchies`     | NOT ON REMOTE | n/a                                                                      | n/a                                           | n/a                          | UNUSED (migration 076 skipped)                 |
| `public.goal_discovery_turns` | NOT ON REMOTE | n/a                                                                      | n/a                                           | n/a                          | UNUSED (068 skipped)                           |

#### Need Behind Need + Conversation Intelligence

| Component                                               | Status                  | Notes                                                                                                   |
| ------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `lib/conversation/need-behind-need-engine.ts`           | EXISTS, PURE-FUNCTIONAL | not imported anywhere outside its file                                                                  |
| `lib/conversation/conversation-engine.ts`               | EXISTS, PURE-FUNCTIONAL | not imported outside DiscoveryChat                                                                      |
| `decision_intelligence.discovery_sessions`              | NOT ON REMOTE           | migration 084 skipped                                                                                   |
| `decision_intelligence.conversation_traces`             | NOT ON REMOTE           | same                                                                                                    |
| `public.user_preferences.conversation_analysis` (JSONB) | ✓ exists                | already wired as the "in-memory engine output → persistence" pattern (P0-3 in BETA_PRODUCT_GAP_TREE.md) |

#### Chat history (pending migration 111)

| Table                | Exists                              | Status  |
| -------------------- | ----------------------------------- | ------- |
| `chat.conversations` | NOT YET — migration 111 not applied | PENDING |
| `chat.messages`      | NOT YET                             | PENDING |

### Table classification summary

```
LIVE:        finance.financial_accounts, finance.transactions, finance.plaid_items,
             public.goals, public.risk_assessments, public.user_persona_profile,
             public.user_preferences, public.profiles, finance.assets
PARTIAL:     education courses/certifications/records (verification needed),
             finance.investment_holdings (table exists, no write path)
UNUSED:      finance.tax_profiles, finance.employer_benefits, finance.retirement_plans,
             finance.financial_goals (tables exist, no read/write paths today)
BROKEN:      every healthcare table, every family table, finance.budgets,
             finance.investments, career.*, education.learning_paths, calendar.*,
             decision_intelligence.*, arcana.*, providers.*
```

---

## E. Recommendation Pipeline audit

### Engine architecture (verified from `lib/finance/recommendations.ts`)

The engine is **DETERMINISTIC, persona-aware, no LLM call**. It has 13 rule producers:

```
stabilizeRec            — for fragile personas (debt > threshold, low savings)
debtPayoffRec           — high-interest debt above invest threshold
taxSetAsideRec          — self-employed personas
bonusAllocationRec      — bonus-eligible personas
deployIdleCashRec       — cash-heavy positions
retirementStartRec      — pre-retirement personas without retirement plan
taxOptimizationRec      — high-income personas in low-tax bucket
concentrationRec        — single-asset concentration risk
insuranceRec            — life-stage-driven insurance gap
emergencyReserveRec     — below 3-month emergency fund
keepCardPaidRec         — card with revolving balance
maxTaxAdvantagedRec     — leaving 401k match on the table
startSmallSaveRec       — first-time savers
keepInvestingRec        — already-investing, stay-the-course
```

### For each recommendation: source map

| Field                                                               | Source                                                                                   |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `category` (immediate_action / risk_reduction / growth_opportunity) | rule-emitted, theme-deduped                                                              |
| `title` (< 10s line)                                                | templated, persona-substituted                                                           |
| `detail` (the why)                                                  | templated; uses metrics from `computeMetrics()`                                          |
| `action` (concrete next step)                                       | templated, persona-aware                                                                 |
| `metric` (the number that makes it real)                            | from `finance.financial_accounts`, `finance.transactions`, `public.user_persona_profile` |
| `severity` (risk / caution / positive / neutral)                    | rule-emitted                                                                             |
| `theme` (internal dedupe)                                           | rule constant                                                                            |
| `rank` (priority)                                                   | rule-assigned                                                                            |

**Source data:**

- `finance.financial_accounts` (LIVE — direct read)
- `finance.transactions` (LIVE — direct read)
- `public.user_persona_profile` (LIVE — direct read)
- `public.goals` — NOT YET READ (engine could but doesn't)
- `public.risk_assessments` — NOT YET READ
- Personal graph (Qdrant + Neo4j) — NOT READ by this engine; graph influence is only via the chat path
- Central knowledge — NOT READ here

**Confidence model:** implicit via `severity`. No numeric confidence.

**Explainability:** `detail` field IS the explanation. No XAI evidence-link chain yet (migration 082 deferred).

### Quality flags (per audit prompt)

| Flag                                           | Status                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disconnected recommendations (no data backing) | NO — every rec cites a metric from the source tables                                                                                                                                                                                                                                    |
| Generic recommendations                        | LOW — recs are persona-substituted; the "no data" branch returns a single starter card                                                                                                                                                                                                  |
| Recommendations not grounded in user data      | NO — see above                                                                                                                                                                                                                                                                          |
| Recommendations not reflected in chat          | PARTIAL — chat can SEE finance facts and emit reasoning, but the chat path doesn't currently know about the dashboard's `Recommendation[]` array (no link). Operator-facing implication: "ask your advisor about this" prefills the rec text into the chat, which is the right pattern. |

### Risks specific to this engine

1. **Goal-blind.** Engine doesn't read `public.goals`. A user with a stated "save for kids' college" goal won't see recs tilt toward 529 / education savings.
2. **No cross-domain enrichment.** Career situation isn't considered (would feed `retirementStartRec`). Health situation isn't considered (could feed insurance / emergency reserve).
3. **No LLM-narrated voice.** Templated detail strings work; they don't sound like a wise grandparent. The "AI-narrated brief" enhancement is a future option.
4. **`PROHIBITED_LANGUAGE` regex strips "guaranteed", "certain", "will earn", "risk-free"** — solid compliance discipline.

### Classification

```
Recommendation Engine: LIVE (finance only)
  Determinism:           YES
  Persona awareness:     YES
  Graph enhancement:     NOT WIRED to this engine; the chat path uses graph
  Cross-domain:          NO (only reads finance)
  Goal awareness:        NO
  Risk-aware:            NO (engine doesn't read risk_assessments)
  XAI / audit:           detail field only; no evidence chain
```

---

## F. Decision Intelligence audit

### Capability map (verified from `lib/decision/`, `lib/advisor/`, `lib/scenario-lab/`)

The repo has a SURPRISING amount of decision-intelligence code already written. Most is dormant.

| Capability                        | Backend service                                                                                      | API                                                                                                           | Graph dep                              | Gemini dep | Persistence dep                                                                                  | Status                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Tradeoff analysis                 | `lib/advisor/advisor-reasoning-service.ts` (deterministic, no LLM)                                   | none yet                                                                                                      | YES (PersonalGraphRetriever interface) | NO         | NO                                                                                               | **CONCEPT (engine exists, not called)**           |
| Scenario analysis (Monte Carlo)   | `lib/scenario-lab/simulator/`                                                                        | `/api/scenario-lab/scenarios`, `/api/scenario-lab/versions/[id]/simulate` ✓                                   | partial                                | NO         | `public.scenarios` etc. (per migration 005 applied)                                              | **LIVE** for scenario lab; UI uses it             |
| Decision ranking                  | `lib/advisor/advisor-reasoning-service.ts`                                                           | none                                                                                                          | YES                                    | NO         | NO                                                                                               | **CONCEPT**                                       |
| Risk analysis                     | `lib/decision/` (multiple engines: assumption-engine, decision-impact-engine, counterfactual-engine) | none called from web                                                                                          | YES                                    | NO         | `decision_intelligence.*` tables (migrations 079-082 SKIPPED)                                    | **CONCEPT**                                       |
| Recommendation prioritization     | rec engine emits ranks (1, 2, 3, …) via the rule producers                                           | implicit                                                                                                      | NO                                     | NO         | NO                                                                                               | **LIVE (finance only)**                           |
| Decision journal                  | `lib/decision/decision-journal-service.ts`                                                           | none                                                                                                          | NO                                     | NO         | `decision_intelligence.decision_journals` (migration 079 SKIPPED)                                | **CONCEPT — schema missing**                      |
| Counterfactual ("what if I had…") | `lib/decision/counterfactual-engine.ts`                                                              | none                                                                                                          | NO                                     | NO         | `decision_intelligence.counterfactual_scenarios` (082 SKIPPED)                                   | **CONCEPT — schema missing**                      |
| Ahead-of-plan / catch-up          | `lib/decision/ahead-of-plan-engine.ts`, `catch-up-engine.ts`                                         | likely wired via `/api/goals/[id]/ahead-of-plan` and `/catch-up` (these routes appeared earlier in the audit) | NO                                     | NO         | `public.goals`, `outcome.goal_progress_snapshots` (the LATTER missing per 080 SKIPPED)           | **PARTIAL — engine exists, target table missing** |
| Cross-domain attribution          | `lib/decision/cross-domain-attribution-service.ts`                                                   | none                                                                                                          | NO                                     | NO         | `decision_intelligence.cross_domain_impacts` (080 SKIPPED)                                       | **CONCEPT — schema missing**                      |
| Calibration                       | `lib/decision/calibration-service.ts`                                                                | none                                                                                                          | NO                                     | NO         | `decision_intelligence.prediction_calibration` (080 SKIPPED)                                     | **CONCEPT — schema missing**                      |
| Assumption audit                  | `lib/decision/assumption-engine.ts`                                                                  | none                                                                                                          | NO                                     | NO         | `decision_intelligence.assumption_challenges` (084 SKIPPED)                                      | **CONCEPT — schema missing**                      |
| XAI / evidence                    | `lib/decision/audit-and-evidence.ts`                                                                 | partial                                                                                                       | NO                                     | NO         | `decision_intelligence.recommendation_audit_trail`, `why_chains`, `evidence_links` (082 SKIPPED) | **CONCEPT — schema missing**                      |

### Pattern

Almost every Decision Intelligence engine is **fully written, deterministic, well-engineered, and dormant** because its target persistence table is in a skipped migration. The library is months ahead of the database it expects.

### What this means for v1 beta

- **Scenario Lab works** (uses scenarios table from migration 005 + Monte Carlo simulator). Surface it on Roadmap or Goals page if there's an empty state.
- **Recommendation prioritization works** via the rec engine. Sufficient for v1.
- **AdvisorReasoningService** is the most interesting unused asset — cross-domain reasoning over personal graph + central ontology, no LLM, fully auditable. It would route via the Fly api-gateway naturally (which has a `/recommendations.py` route).
- **Counterfactuals, decision journal, calibration, XAI** — all dormant. v2 territory.

### Three-tier classification

```
IMPLEMENTED & LIVE:    Scenario Lab simulator
                       Finance recommendation engine
                       Risk-aware persona rules

PARTIAL (engine exists, target table missing):
                       AdvisorReasoningService (needs Neo4j personal nodes for non-finance)
                       Ahead-of-plan / catch-up (needs outcome.goal_progress_snapshots)

CONCEPT ONLY (engine + schema both missing or one is missing):
                       Decision journal
                       Counterfactuals
                       Cross-domain attribution
                       Calibration
                       Assumption audit
                       XAI / why-chains
```

---

## G. Target architecture validation (Section G)

### Stated target (per audit prompt)

```
Frontend displays
Supabase stores
Worker syncs
Core API thinks
GraphRAG grounds
Gemini reasons
```

### Current ownership map

| Responsibility                          | Currently lives in                                                     | Correctness                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Auth                                    | Vercel (Supabase Auth SDK + magic-link) + Resend SMTP                  | ✓ correct                                                                                         |
| Onboarding orchestration                | Vercel page + proxy.ts redirect                                        | ✓ correct (currently SampleFinancialProfile; should be DiscoveryChat-led per P0-3)                |
| Persona activation                      | Vercel route → Plaid → Supabase persist + sync_queue trigger           | ✓ correct                                                                                         |
| Dashboard summary                       | Vercel server component → recommendations engine (TS) → finance tables | ✓ correct                                                                                         |
| Real-time data sync                     | Postgres triggers → graphrag.sync_queue → Rust worker (Fly)            | ✓ correct architecturally; **operationally broken** (Gemini 401)                                  |
| Recommendation rules                    | `lib/finance/recommendations.ts` (Vercel server-side)                  | ⚠ **misplaced** — should move to Fly api-gateway `/recommendations.py` for cross-domain reasoning |
| GraphRAG retrieval (Qdrant + Cypher)    | Supabase Edge Function `graphrag-query` (Deno)                         | ✓ correct                                                                                         |
| Gemini generation                       | Edge Function + Sprint T factory                                       | ✓ correct                                                                                         |
| Governance + character + injection scan | Vercel Sprint T factory (`createGovernedHandler`)                      | ✓ correct                                                                                         |
| Chat persistence                        | Vercel `/api/agent/chat` → service-role → `chat.*` (pending 111)       | ✓ correct                                                                                         |
| Cross-domain reasoning                  | `lib/advisor/advisor-reasoning-service.ts` (Vercel)                    | ⚠ **dormant** — should be called from a Vercel route or proxied to Fly api-gateway                |
| Decision intelligence engines           | `lib/decision/*` (Vercel)                                              | ⚠ **dormant** + schemas missing                                                                   |
| Plaid sync & graph promotion            | Vercel route → Supabase → Fly worker                                   | ✓ correct                                                                                         |
| Central knowledge ingestion             | **MISSING** — no service owns this                                     | ✗ ownership gap                                                                                   |
| Health monitoring of the pipeline       | none                                                                   | ✗ ownership gap (no dashboard showing sync_queue health, Qdrant point count, Neo4j growth)        |

### Duplicated logic

| Duplication                                       | Detail                                                                                                                                                                          | Fix                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Finance read paths                                | `/api/financial` aggregator + `lib/finance/recommendations.ts` + `/api/integrations/plaid/accounts` + `/api/integrations/plaid/transactions` all read `finance.*` independently | Extract `lib/finance/account-and-transaction-reader.ts` and call from all four                                             |
| Risk endpoints                                    | `/api/risk-assessment` + `/api/onboarding/risk-profile` both touch `public.risk_assessments`                                                                                    | Consolidate                                                                                                                |
| Fly api-gateway routes overlap with Vercel routes | `/recommendations.py`, `/optimizer.py`, `/simulations.py`, `/graphrag.py` on Fly mirror Vercel routes                                                                           | Make the Fly gateway authoritative for cross-domain reasoning + multi-step LLM orchestration; Vercel proxies thin requests |

### Missing ownership

| Capability                  | Should own                                      | Why                                                                                                                      |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Central knowledge ingestion | **Operator + Vercel script** (one-off seed)     | Low frequency, no need for a service                                                                                     |
| Pipeline health dashboard   | **`/dashboard/ops/sync-health`** (new)          | Surfaces sync_queue stats, Qdrant point count growth, Neo4j node growth — would have caught the Gemini 401 in 10 minutes |
| Worker config sanity check  | **Fly worker `/healthz` (it doesn't have one)** | Worker would self-report "Gemini auth failing" instead of silently failing 80% of jobs                                   |

### Wrong ownership

| Today                                                    | Should be                                                             | Why                                                                                                                                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/finance/recommendations.ts` deterministic on Vercel | Move cross-domain rec engine to Fly api-gateway `/recommendations.py` | The api-gateway already exists, runs FastAPI, has Gemini + Neo4j + Qdrant clients. Cross-domain reasoning needs those three; Vercel + edge function is a more expensive code path. |
| The "AI-augmented brief" (future enhancement)            | Fly api-gateway                                                       | Same reasoning                                                                                                                                                                     |

### Target architecture (recommended for v1)

```
Vercel        — UI + auth + thin API routes + the Sprint T governance factory
Edge Function — chat generation + Qdrant + Cypher retrieval (graphrag-query)
Fly worker    — graphrag ingestion (current); ALSO cross-domain rec generation
                (post-beta migration)
Fly gateway   — cross-domain reasoning routes (today unused; should be the
                "Core API thinks" layer)
Supabase      — system of record (today); ALSO source for sync_queue (today)
Neo4j         — personal + central graph (single physical DB today, two logical
                tenants)
Qdrant        — personal + central vector store (two collections today)
Gemini        — embedding (worker) + chat generation (Edge Function + factory)
```

The Fly api-gateway is the most under-leveraged piece of the architecture today. It exists, it's healthy, it has the right clients. The web app barely uses it.

---

## Final classification (across all PART 10 sections)

| Section                        | Letter grade                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| A. Supabase system-of-record   | B+ for finance/goals/risk; D for career/education/health/family                                |
| B. Personal GraphRAG ingestion | C — architecture A, execution D (80% failure rate)                                             |
| C. Central GraphRAG ingestion  | F — no content, no pipeline                                                                    |
| D. Context assembly            | A — best-of-class refusal behavior                                                             |
| E. Recommendation pipeline     | B+ — solid for finance, no cross-domain                                                        |
| F. Decision Intelligence       | B for what's used; D for what's dormant (most of the library)                                  |
| G. Target architecture         | B+ — well-designed, but Fly api-gateway is under-used + central knowledge ownership is missing |

**Composite grade for v1 beta: B-**

The architecture is genuinely better than most products at this stage. The operational gaps (Gemini key on worker, central knowledge empty, 5 domains over-promising, no pipeline health dashboard) are what hold it back from a B+ / A-.

---

End of `INTELLIGENCE_ARCHITECTURE_AUDIT.md`.
