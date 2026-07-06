# LifeNavigator Build Plan — Sequenced Delivery

This is the master plan for the 7-prompt sequence you sent. Each step is a
self-contained deliverable. At the end of every step I'll commit, write a
short status summary, and hand you the next prompt to paste back.

The original 7 prompts are:

| #   | Topic                              | Original prompt                                           |
| --- | ---------------------------------- | --------------------------------------------------------- |
| 1   | Complete intake, user graph, RLS   | Already delivered in 060–068 + this step's 069            |
| 2   | Rust ingestion worker (Fly.io)     | New apps/ingestion-worker                                 |
| 3   | Dynamic Goal Optimizer             | Schema 070 (done) + lib + API + UI + tests + doc          |
| 4   | Life Trajectory Simulation         | Schema 071 (done) + lib + API + tests + doc               |
| 5   | FastAPI GraphRAG + compliance      | New apps/api-gateway                                      |
| 6   | Career Marketplace                 | Schema 072 (done) + matching lib + API + UI + tests + doc |
| 7   | Wearable Monitoring + Alert engine | Schema 073 (done) + lib + API + tests + doc               |

To keep quality high, we'll execute one step per turn instead of trying to
ship all seven in one response.

---

## Step 1 — Schema Foundation (DONE in this turn)

**What landed:**

- `supabase/migrations/069_intake_logs_and_benefit_profile.sql` — closes
  the Prompt-1 gap: `health_meta.workout_logs`,
  `health_meta.supplement_logs`, `health_meta.medication_logs`,
  `health_meta.health_profile` (singleton), `public.benefit_profiles`.
- `supabase/migrations/070_dynamic_goal_optimizer.sql` —
  `goal_interpretations`, `goal_optimizer_runs`, `_inputs`,
  `_assumptions`, `_allocations`, `_tradeoffs`, `_recommendations`,
  `_outcomes` (8 tables).
- `supabase/migrations/071_life_trajectory_simulation.sql` —
  `life_scenarios`, `_versions`, `_decisions`, `_assumptions`,
  `_outputs`, `_metrics`, `_events`, `_comparisons`,
  `life_trajectory_snapshots` (9 tables).
- `supabase/migrations/072_career_marketplace.sql` — `employer_profiles`,
  `employer_users` (+ `is_employer_member` helper), `employer_job_posts`
  (+ requirements / benefits / locations / pricing),
  `candidate_career_profiles`, `job_candidate_matches`,
  `employer_match_anonymized` view, `job_match_feedback`,
  `employer_candidate_messages`, `employer_billing_events`,
  `job_post_analytics` (13 tables + 1 view).
- `supabase/migrations/073_wearable_monitoring.sql` —
  `health_monitoring_preferences`, `health_alert_rules`,
  `health_alert_events` (3 tables under the existing
  `is_health_enabled()` gate).

**Conventions preserved:** uuid PK, `user_id` FK CASCADE, `source TEXT`,
`confidence_score NUMERIC(3,2)`, `metadata JSONB DEFAULT '{}'`,
`core.set_updated_at()` triggers, owner + service_role RLS, sensible
indexes, CHECK constraints on enum-style columns. The web app still
compiles cleanly (`tsc --noEmit` → 0 errors).

**Total schema added in this step:** ~33 tables / 1 view across 5 files.

---

## Step 2 — Prompt 7: Wearable Monitoring + Non-Diagnostic Alert Engine

Smallest scope first to lock in the pattern.

**Scope:**

- `apps/web/src/lib/health-monitoring/alert-engine.ts` — deterministic
  rule evaluator. Built-in rules: `rhr_up_sleep_down`,
  `bp_trend_worsening`, `weight_sudden_drop`, `recovery_score_collapse`,
  `concerning_combo`, `lab_out_of_range`. Each rule reads recent
  `health_meta.daily_wellbeing` / `vitals_log` / `body_measurements` /
  `lab_results`. Non-diagnostic copy ONLY ("Your recent trend may warrant
  review. Consider contacting your physician.").
- `apps/web/src/lib/health-monitoring/copy.ts` — vetted non-diagnostic
  message bank, indexed by `rule_key + severity`.
- API routes:
  - `POST /api/health-monitoring/manual-entry` — accepts a daily
    wellbeing or vitals payload (RLS-checked), then triggers the alert
    engine.
  - `POST /api/health-monitoring/wearable-event` — webhook for
    Apple Health / Google Health Connect / Oura / Whoop / Garmin / Fitbit
    pushes; normalizes into `wearable_metrics`, then evaluates rules.
  - `GET /api/health-monitoring/alerts` — list pending + acknowledged
    alerts for the user.
  - `PATCH /api/health-monitoring/alerts/[id]` — acknowledge / dismiss /
    share-with-physician.
  - `GET/PUT /api/health-monitoring/preferences` — user prefs (quiet
    hours, severity threshold, physician email).
- Jest tests for the engine (deterministic rules, cooldown, severity
  threshold, non-diagnostic copy guarantee).
- SQL validation `scripts/validation/073_wearable_monitoring_rls.sql`.
- Doc: `WEARABLE_MONITORING_IMPLEMENTATION.md`.

**Prompt to paste back to continue Step 2:**

> Execute Step 2 of the sequenced build plan
> (`SEQUENCED_BUILD_PLAN.md`): Wearable Monitoring + Alert engine.
> Build the alert engine library, the four API routes, jest tests,
> SQL validation, and the implementation doc. Migration 073 is already
> in place. Don't start any other step.

---

## Step 3 — Prompt 3: Dynamic Goal Optimizer

**Scope:**

- `apps/web/src/lib/optimizer/scoring.ts` — deterministic scoring engine
  that takes a financial profile + debts + insurance + risk +
  decision-preference inputs and produces per-category allocation scores
  across the 13 categories defined in migration 070.
- `apps/web/src/lib/optimizer/engine.ts` — orchestrator:
  loadInputs → inferTrueGoal (deterministic stub + LLM adapter
  point) → score → normalize to a sum-matches-surplus allocation →
  generate tradeoffs → recommended next-best-action.
- `apps/web/src/lib/optimizer/types.ts`.
- API routes:
  - `POST /api/optimizer/run`
  - `GET /api/optimizer/runs/[id]`
  - `POST /api/optimizer/runs/[id]/accept` / `reject`
- UI: `/dashboard/next-dollar-optimizer` page — "monthly surplus",
  recommended allocation, why this allocation, tradeoffs, accept /
  reject / modify.
- Compliance copy reviewed; no specific securities recommendations.
- Tests for the deterministic scorer.
- SQL validation for 070.
- `DYNAMIC_GOAL_OPTIMIZER_IMPLEMENTATION.md`.

**Prompt to paste back to continue Step 3:**

> Execute Step 3 of the sequenced build plan: Dynamic Goal Optimizer.
> Build the scoring + engine library, the API routes, the
> `/dashboard/next-dollar-optimizer` UI, jest tests, SQL validation,
> and the implementation doc. Migration 070 is already in place.
> Don't start any other step.

---

## Step 4 — Prompt 4: Life Trajectory Simulation Engine

**Scope:**

- `apps/web/src/lib/trajectory/projector.ts` — deterministic month-by-month
  projector for: net worth, income, debt, savings, emergency-fund
  months, health-cost exposure (with assumptions). Reuses the
  Scenario Lab Monte Carlo where appropriate.
- `apps/web/src/lib/trajectory/generator.ts` — builds the canonical 5
  paths (current behavior / conservative / balanced / aggressive /
  goal-optimized) from a single base scenario.
- `apps/web/src/lib/trajectory/types.ts`.
- API routes:
  - `POST /api/simulations/create` — create scenario + N versions.
  - `POST /api/simulations/[id]/run` — run the projector for all
    versions, write `life_scenario_outputs` + `life_scenario_metrics`.
  - `POST /api/simulations/compare` — write a `life_scenario_comparisons`
    row with diffs.
  - `GET  /api/simulations/[id]` — full read.
- Minimal `/dashboard/life-trajectory` page wired to the API (chart of
  net worth over time + scenario comparison cards).
- Tests for projector determinism.
- SQL validation for 071.
- `LIFE_TRAJECTORY_SIMULATION_ENGINE.md`.

**Prompt to paste back:**

> Execute Step 4 of the sequenced build plan: Life Trajectory
> Simulation. Build the projector + generator, the four API routes,
> minimal UI, jest tests, SQL validation, and the doc. Migration 071
> is already in place. Don't start any other step.

---

## Step 5 — Prompt 6: Career Marketplace

**Scope:**

- `apps/web/src/lib/marketplace/matcher.ts` — deterministic 0..100
  scorer per match dimension (skills, certs, education, salary,
  location, growth alignment). Returns `match_score` and the
  employer-facing anonymized summary.
- `apps/web/src/lib/marketplace/match-batch.ts` — bulk job to refresh
  matches for a job post (or for a candidate).
- API routes:
  - `POST /api/employer/profile`
  - `POST/PUT /api/employer/jobs` + `[id]` (CRUD)
  - `POST /api/employer/jobs/[id]/publish` / `pause` / `archive`
  - `GET /api/employer/jobs/[id]/matches` (employer-facing,
    anonymized via the `employer_match_anonymized` view)
  - `POST /api/employer/matches/[id]/request-intro`
  - `GET /api/jobs/matches` (candidate's matches)
  - `POST /api/jobs/matches/[id]` → save / dismiss / apply /
    consent-to-intro
  - `POST /api/jobs/matches/[id]/feedback`
- Minimal UIs:
  - `/employer` — create profile + list jobs + post a job
  - `/dashboard/jobs` — candidate match list with "why this fits"
- Jest tests for the matcher.
- SQL validation for 072 (RLS isolation, anonymization view, employer
  cannot see PII).
- `CAREER_MARKETPLACE_IMPLEMENTATION.md`.

**Prompt to paste back:**

> Execute Step 5 of the sequenced build plan: Career Marketplace.
> Build the matching library, the API routes, the employer + candidate
> UIs, jest tests, SQL validation, and the doc. Migration 072 is
> already in place. Don't start any other step.

---

## Step 6 — Prompt 2: Rust ingestion worker on Fly.io

**Scope (new app):** `apps/ingestion-worker/` Cargo crate with the
modular layout from the prompt:

```
src/
  main.rs
  config.rs
  supabase_client.rs
  queue.rs
  entities.rs
  normalizer.rs
  gemini_client.rs
  qdrant_client.rs
  neo4j_client.rs
  processor.rs
  errors.rs
  telemetry.rs
Cargo.toml
Dockerfile
fly.toml
.env.example
README.md (= INGESTION_WORKER_IMPLEMENTATION.md)
tests/
  tenant_isolation.rs
  idempotency.rs
  retry_safety.rs
  no_sensitive_field_embedding.rs
```

Polls `graphrag.sync_queue`, normalizes per-entity payloads to the
canonical graph object, generates Gemini embeddings, upserts to Qdrant

- Neo4j with `tenant_id` filters everywhere, marks jobs done/failed,
  respects retry/backoff. Never logs raw PHI/PII.

**Prompt to paste back:**

> Execute Step 6 of the sequenced build plan: Rust ingestion worker.
> Create the apps/ingestion-worker Cargo crate with the layout in the
> plan, complete Dockerfile + fly.toml + .env.example, and the four
> required tests. Don't start any other step.

---

## Step 7 — Prompt 5: FastAPI GraphRAG / compliance backend

**Scope (new app):** `apps/api-gateway/` FastAPI app:

```
app/
  main.py
  config.py
  auth.py            (Supabase JWT validation)
  deps.py
  routes/
    graphrag.py
    recommendations.py
    simulations.py
    optimizer.py
    compliance.py
    arcana.py
    health_monitoring.py
  services/
    graphrag_personal.py
    graphrag_central.py
    gemini.py
    qdrant.py
    neo4j_client.py
    compliance.py
    arcana_lead_package.py
  schemas/
  tests/
Dockerfile
fly.toml
requirements.txt
README.md (= GRAPHRAG_FASTAPI_COMPLIANCE_IMPLEMENTATION.md)
```

JWT validation on every request, `user_id` taken only from the JWT,
personal-collection retrieval filtered by `tenant_id`, central-collection
read-only, compliance module that vets recommendations before return
(no securities advice, no medical diagnosis, no guaranteed outcomes,
no cross-user leakage), Arcana lead package preview + consent flow,
audit log on every consent and lead send.

**Prompt to paste back:**

> Execute Step 7 of the sequenced build plan: FastAPI GraphRAG +
> compliance backend. Create the apps/api-gateway FastAPI app with
> the layout in the plan, Dockerfile + fly.toml + requirements.txt,
> and tests for JWT, personal-retrieval filter, and compliance
> rejection paths. Don't start any other step.

---

## Status

| Step                           | Status   |
| ------------------------------ | -------- |
| 1. Schema foundation (069–073) | **Done** |
| 2. Wearable Monitoring engine  | Pending  |
| 3. Dynamic Goal Optimizer      | Pending  |
| 4. Life Trajectory Simulation  | Pending  |
| 5. Career Marketplace          | Pending  |
| 6. Rust ingestion worker       | Pending  |
| 7. FastAPI gateway             | Pending  |

Paste the **Step 2 prompt** above when ready to continue.
