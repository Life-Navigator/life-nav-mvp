# Personalized GraphRAG Activation

This document is the operator's runbook for taking LifeNavigator's
Personalized GraphRAG architecture from "compiles and tests" to
"running in production." It is the activation work prescribed by the
prior audit (`LIFENAVIGATOR_ARCHITECTURE_INTEGRITY_AUDIT.md`) and is
scoped to **wiring + deployment + verification — no new features**.

## What changed in this round

| Deliverable                                                             | File / Location                                                               |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Migration **074** — sync triggers for 41 new tables across 060–073      | `supabase/migrations/074_graphrag_v2_triggers.sql`                            |
| Rust worker: 19 new `EntityType` variants for everything 074 enqueues   | `apps/ingestion-worker/src/entities.rs`                                       |
| Rust worker: `relationships_for` now takes `user_id` directly (bug fix) | `apps/ingestion-worker/src/normalizer.rs`                                     |
| Rust worker: summary builders for every new entity type                 | same                                                                          |
| Rust worker: doctest regression fixed                                   | `apps/ingestion-worker/src/processor.rs` (ASCII art now in `text` code fence) |
| Worker test suite extended (25 passing, was 22)                         | `apps/ingestion-worker/tests/relationships.rs`                                |
| Fly.io deploy scripts (idempotent, secrets-from-env)                    | `apps/ingestion-worker/deploy.sh`, `apps/api-gateway/deploy.sh`               |
| End-to-end smoke test                                                   | `scripts/validation/smoke_test_graphrag.sh`                                   |
| This doc                                                                | `PERSONALIZED_GRAPHRAG_ACTIVATION.md`                                         |

## Verification snapshot

| Component                                                  | Status                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `psql -f supabase/migrations/074_graphrag_v2_triggers.sql` | applies cleanly (idempotent via `CREATE OR REPLACE` + `DROP TRIGGER IF EXISTS`) |
| `cargo check --all-targets`                                | clean, 0 warnings                                                               |
| `cargo test` (default — includes doctests)                 | **25 passed, 0 failed**                                                         |
| `cargo build --release --bin ingestion-worker`             | clean                                                                           |
| FastAPI gateway `pytest -q` (unchanged this round)         | 29 passed                                                                       |
| Web app `tsc --noEmit` + `jest`                            | 0 errors, 237 passed (unchanged this round)                                     |

---

## 1. Migration 074 — what it adds

41 triggers across nine groups. The pattern is the standard one from
`055_graphrag_expanded_triggers.sql`: a `SECURITY DEFINER` function per
entity that calls `graphrag.enqueue_sync(user_id, entity_type,
entity_id::uuid, source_table, operation, payload)`, plus an
`AFTER INSERT OR UPDATE OR DELETE` trigger. All payloads exclude
sensitive fields (encrypted columns, member_id, group_number, raw OCR
text, notes_encrypted). Every trigger is wrapped in
`DROP TRIGGER IF EXISTS` so the migration is re-applicable.

| Group                       | Tables (entity_type emitted)                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core user-graph (12)        | user_life_vision → `life_vision`, user_constraints → `constraint`, user_capabilities → `capability`, user_commitment_levels → `commitment_level`, user_motivations → `motivation`, user_decision_preferences → `decision_preference`, user_domain_risk_tolerance → `domain_risk_tolerance`, user_decisions → `decision`, user_recommendations → `recommendation`, user_outcomes → `outcome`, user_actions → `action`, user_life_events → `life_event` |
| Optimizer (4)               | goal_interpretations → `goal_interpretation`, goal_optimizer_runs → `optimizer_run`, goal_optimizer_allocations → `optimizer_allocation`, goal_optimizer_recommendations → `optimizer_recommendation`                                                                                                                                                                                                                                                 |
| Trajectory (5)              | life_scenarios → `life_scenario`, life_scenario_versions → `life_scenario_version`, life_scenario_decisions → `life_scenario_decision`, life_scenario_outputs → `life_scenario_output`, life_trajectory_snapshots → `life_trajectory_snapshot`                                                                                                                                                                                                        |
| Insurance + benefits (4)    | insurance_plans → `insurance_plan`, insurance_documents → `insurance_document`, insurance_extracted_facts → `insurance_document_fact`, benefit_profiles → `benefit_profile`                                                                                                                                                                                                                                                                           |
| Finance summary (3)         | finance.user_financial_profile → `user_financial_profile`, finance.debts → `debt`, finance.financing_preferences → `financing_preference`                                                                                                                                                                                                                                                                                                             |
| Education + family (3)      | education_intake → `education_intake`, education_credentials → `certification`, family_lifestyle_profile → `lifestyle_goal`                                                                                                                                                                                                                                                                                                                           |
| Health (7)                  | health_meta.training_profile → `fitness_profile`, body_measurements → `body_measurement`, injuries → `injury`, daily_wellbeing → `health_metric`, nutrition_profile → `nutrition_log`, health_profile → `health_profile`, health_alert_events → `health_alert_event`                                                                                                                                                                                  |
| Marketplace user-scoped (2) | candidate_career_profiles → `career_profile`, job_candidate_matches → `candidate_match`                                                                                                                                                                                                                                                                                                                                                               |
| **Sub-total**               | **40**                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Already exists (068)        | goal_discovery_turns, estate_planning_profile, estate_beneficiaries                                                                                                                                                                                                                                                                                                                                                                                   |

### Pre-existing trigger bug — flagged, not fixed in 074

`055_graphrag_expanded_triggers.sql` passes `OLD.id::text` /
`NEW.id::text` to `graphrag.enqueue_sync(... p_entity_id UUID ...)`.
PostgreSQL does not implicitly cast TEXT → UUID, so **16 of the 19
pre-existing triggers fail at runtime.** This was identified during the
074 work and is documented in the audit but **not fixed here** to
avoid changing existing behavior outside the scope of this prompt.

**Recommended follow-up:** a small migration `075_fix_055_triggers.sql`
that rewrites the 12 functions in 055 to pass `OLD.id` / `NEW.id`
without the cast. Cost: ~30 minutes. Until then, the education /
courses / job_application / financial_goal / investment_holding /
transaction / family_member / health_record / health_metric /
document triggers do not actually enqueue rows.

---

## 2. Rust worker updates

### EntityType — 19 new variants

Added to cover everything 074 emits:

```
GoalDiscoveryTurn          → goal_discovery_turn      (goals     / high)
GoalInterpretation         → goal_interpretation      (goals     / medium)
OptimizerRun               → optimizer_run            (financial / medium)
OptimizerAllocation        → optimizer_allocation     (financial / medium)
OptimizerRecommendation    → optimizer_recommendation (financial / medium)
LifeScenario               → life_scenario            (financial / low)
LifeScenarioVersion        → life_scenario_version    (financial / low)
LifeScenarioDecision       → life_scenario_decision   (financial / low)
LifeScenarioOutput         → life_scenario_output     (financial / medium)
LifeTrajectorySnapshot     → life_trajectory_snapshot (financial / medium)
EstateProfile              → estate_profile           (estate    / high)
EstateBeneficiary          → estate_beneficiary       (estate    / high)
InsuranceDocument          → insurance_document       (insurance / high)
BenefitProfile             → benefit_profile          (insurance / medium)
HealthAlertEvent           → health_alert_event       (health    / high)
UserFinancialProfile       → user_financial_profile   (financial / medium)
FinancingPreference        → financing_preference     (financial / medium)
EducationIntake            → education_intake         (education / low)
Injury                     → injury                   (health    / high)
```

The `EntityType::Unknown` catch-all is preserved so a future schema
addition that lands before the worker is updated doesn't crash.

### `relationships_for` regression fix

**Bug:** The old function tried to read `user_id` from the sanitized
payload attributes (`attrs.get("user_id")`). But the 050 / 055 / 068 /
074 trigger payloads deliberately omit `user_id` — it's already a
top-level column on `graphrag.sync_queue`. So `relationships_for` was
silently emitting **zero edges** for every entity type. Every Neo4j
upsert was creating an isolated node with no Person → entity edge.

**Fix:** `relationships_for` now takes `user_id: &str` directly from
the `SyncQueueJob`. New test (`tests/relationships.rs`) walks a
representative slice of 28 entity types and asserts each one emits
exactly one Person edge pinned to the job's `user_id`, with an
appropriate label (`HAS_GOAL`, `HAS_INSURANCE_PLAN`,
`HAS_OPTIMIZER_RUN`, etc.).

### Summary builders

Each new entity type gets a dedicated `parts_for(&[...])` block in
`build_summary` so the embedding text is information-dense
instead of a serialized JSON blob via the fallback.

### Doctest

`processor.rs`'s module-level ASCII flow diagram was being parsed as
Rust code by rustdoc. Wrapped it in a `text` code fence. `cargo test`
(default — includes doctests) now passes cleanly.

### Tests

```
9  inline lib tests
3  tenant_isolation.rs
3  idempotency.rs
3  retry_safety.rs
4  no_sensitive_field_embedding.rs
3  relationships.rs  (new)
-----------------------------
25 total — all passing
```

---

## 3. Deployment

### Why we're not deploying from this terminal

This terminal has no Fly.io auth token. The deployment scripts are
ready and idempotent; running them requires:

- `fly auth login` on the operator's machine
- Pre-set environment variables for every secret (see scripts)
- Outbound network to Fly.io, Supabase, Gemini, Qdrant, Neo4j

### Worker

```bash
cd apps/ingestion-worker
export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
       GEMINI_API_KEY=... \
       QDRANT_URL=... QDRANT_API_KEY=... QDRANT_PERSONAL_COLLECTION=life_navigator \
       NEO4J_URI=... NEO4J_USERNAME=neo4j NEO4J_PASSWORD=... NEO4J_PERSONAL_DATABASE=neo4j
./deploy.sh
```

The script runs `cargo test --release`, creates the Fly app if
needed, stages secrets, and ships. Tail `fly logs -a lifenavigator-ingestion-worker`
to watch the worker drain the queue.

### Gateway (deferred — see §4)

```bash
cd apps/api-gateway
export SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_JWT_SECRET=... \
       SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... \
       QDRANT_URL=... QDRANT_API_KEY=... \
       QDRANT_PERSONAL_COLLECTION=life_navigator QDRANT_CENTRAL_COLLECTION=ln_central \
       NEO4J_URI=... NEO4J_USERNAME=neo4j NEO4J_PASSWORD=... \
       NEO4J_PERSONAL_DATABASE=neo4j NEO4J_CENTRAL_DATABASE=central \
       ALLOWED_ORIGINS="https://lifenavigator.app,https://*.vercel.app"
./deploy.sh
```

---

## 4. Production retrieval path — DECISION

The audit flagged ambiguity between two retrieval paths. Decision:

> **Production retrieval at beta launch is via the existing Supabase
> Edge Function (`graphrag-query`).** The FastAPI gateway exists,
> compiles, tests pass, and is ready to deploy — but is **deferred to
> a future cutover** when we have measurable reason to move retrieval
> out of the Edge Function.

### Why

| Criterion                       | Edge Function (today)                                | FastAPI gateway (deferred)             |
| ------------------------------- | ---------------------------------------------------- | -------------------------------------- |
| Already deployed                | ✅                                                   | ❌                                     |
| Latency                         | Lower (Vercel ↔ Supabase Edge same edge mesh)        | Higher (extra hop to Fly.io)           |
| Cost                            | Included in Supabase tier                            | One extra Fly app to operate           |
| Auth                            | Already integrates with Supabase JWT (server cookie) | Validates the same JWT explicitly      |
| Compliance vetting              | Not implemented                                      | Implemented (29 pytest tests)          |
| Central GraphRAG                | Wired in Edge Function                               | Wired in gateway                       |
| Future Arcana lead-package POST | Could be added                                       | Designed for it (consent gate + audit) |

For a **scoped beta** the Edge Function is sufficient and faster to
ship. The gateway is the right home for: (1) compliance-vetted
recommendation generation, (2) the Arcana outbound POST when the
partnership lands, (3) any service that wants to live closer to Qdrant

- Neo4j than the Edge Function runtime allows.

### Production wire diagram (beta)

```
Vercel (Next.js)
   ├── /api/agent/chat          → Supabase Edge Function `graphrag-query`
   ├── /api/optimizer/*         → Next.js handlers (talk to Supabase via RLS)
   ├── /api/simulations/*       → Next.js handlers (talk to Supabase via RLS)
   └── /api/onboarding/*        → Next.js handlers (talk to Supabase via RLS)
                                    │
                                    ▼ (RLS-checked write)
                            Supabase Postgres
                                    │
                                    ▼ (074 triggers + 050/055/068 triggers)
                            graphrag.sync_queue
                                    │
                                    ▼ (claim_sync_jobs)
                            Rust ingestion-worker (Fly.io)
                                    │
                          embeds via Gemini ──┐
                                    │        │
                                    ▼        ▼
                                Qdrant     Neo4j
                                (personal + central)

(FastAPI gateway — deferred — same Qdrant/Neo4j; activated when we
adopt compliance-vetted recommendations or the Arcana intake POST.)
```

### When to flip the switch

Adopt the FastAPI gateway when **any** of the following is true:

1. The compliance vetter is needed in front of LLM-generated
   recommendations (today the LLM call is inside the Edge Function
   and not vetted).
2. Arcana intake POST is ready to go live.
3. Cross-domain Neo4j relationships (`SUPPORTS_GOAL`, `BLOCKS_GOAL`,
   `IMPACTS`) are wired and require the richer query layer the gateway
   already has.
4. We start hitting Edge Function runtime limits (cold start, request
   duration, Deno deps).

Until then, the gateway is on standby — running its tests in CI and
ready to `fly deploy` on demand.

---

## 5. Smoke test

`scripts/validation/smoke_test_graphrag.sh` exercises the full data
plane end-to-end:

1. Seeds a synthetic user in `auth.users` + `public.profiles`.
2. Inserts one row per major entity type (life vision, root goal,
   constraint, decision preference, optimizer run, optimizer
   allocation, financial profile, debt, estate profile).
3. Asserts `graphrag.sync_queue` grew by ≥ 8 rows for that user.
4. Asserts every enqueued row has non-null `user_id`,
   `entity_type`, `source_table`, valid `operation`.
5. (Optional) Runs the Rust worker locally for 30s to drain the queue.
6. (Optional) Curls Qdrant for a point under the test user's
   `tenant_id` and asserts the payload contains the same
   `tenant_id` + `user_id` + `access_scope='personal'`.
7. (Optional) Curls Neo4j with a tenant-filtered Cypher query and
   asserts node rows return.
8. (Optional) **Cross-user leakage probe**: scrolls Qdrant for an
   unrelated tenant_id and asserts zero points.
9. Cleans up if `CLEANUP=1`; otherwise leaves the synthetic user for
   debugging.

Run it:

```bash
# Minimal — just verifies triggers fire and enqueued rows are well-formed
DATABASE_URL=postgres://postgres:...@localhost:54322/postgres \
  ./scripts/validation/smoke_test_graphrag.sh

# Full — also drains the queue via the local Rust worker
DATABASE_URL=...                       \
SUPABASE_URL=...                       \
SUPABASE_SERVICE_ROLE_KEY=...          \
GEMINI_API_KEY=...                     \
QDRANT_URL=... QDRANT_API_KEY=...      \
QDRANT_PERSONAL_COLLECTION=life_navigator \
NEO4J_URI=... NEO4J_USERNAME=neo4j NEO4J_PASSWORD=... \
NEO4J_PERSONAL_DATABASE=neo4j          \
RUN_WORKER=1 CLEANUP=1                 \
  ./scripts/validation/smoke_test_graphrag.sh
```

Exits non-zero on any failure. Prints a green check on each step.

---

## 6. Launch readiness checklist

This is the **scoped beta** checklist — the audit's GO WITH CONDITIONS
target. Tick each item before going live.

### CRITICAL

- [ ] **Encryption key provisioned.** Verify in prod:

  ```sql
  SELECT current_setting('app.settings.encryption_key', true) IS NOT NULL
     AND length(current_setting('app.settings.encryption_key', true)) > 0;
  ```

  Without this, `insurance_plans` member_id/group_number encryption
  silently fails.

- [ ] **Email verification enforced.** Add to `apps/web/src/middleware.ts`
      before the dashboard redirect: refuse dashboard access if the
      Supabase user object's `email_confirmed_at IS NULL`. ~10-line change.

- [ ] **Migration 074 applied.** `supabase db push` (or apply the SQL
      file manually). Re-runnable safely.

- [ ] **Rust worker deployed** via `apps/ingestion-worker/deploy.sh`.
      Verify with `fly logs -a lifenavigator-ingestion-worker`.

- [ ] **Insurance storage bucket created.** One-time setup:
  ```bash
  supabase storage create-bucket insurance --public=false
  ```

### HIGH

- [ ] **Rate-limiting plan.** At minimum: Upstash Redis + middleware
      on `/api/auth/*` (10 rpm per IP), `/api/agent/chat` (30 rpm per
      user), `/api/employer/jobs/[id]/publish` (5 rpm per employer).

- [ ] **Stripe path decided.** Either (a) launch free / pay-later
      (remove pricing CTAs), or (b) wire the existing
      `/api/integrations/stripe/*` stubs to real Stripe.

- [ ] **GraphRAG worker deployed.** (Same as critical; restated here
      because it bridges critical-and-high.)

- [ ] **FastAPI gateway deployed OR explicitly deferred.** Per §4:
      **deferred at beta**. Document in the launch announcement that
      retrieval is via the Edge Function.

- [ ] **Health feature gate decision documented.** Today
      `public.is_health_enabled()` returns `false`. Options:
  1. Keep it `false` — wearable monitoring + health intake stays in
     the schema, UI surfaces the "feature locked" banner. Recommended
     for beta.
  2. Flip to `true` — unlocks all 17 health_meta tables for
     owner reads/writes. Requires Arcana lead-package consent flow to
     be production-ready and HIPAA-aligned legal review.

- [ ] **Smoke test passes against production Supabase.** Run with
      `CLEANUP=1` to avoid leaving the synthetic user.

### MEDIUM

- [ ] `/test-agent` page hidden behind a build flag or removed.
- [ ] Legacy `AgentProxy` references to `localhost:8000` /
      `localhost:8080` cleaned up
      (`apps/web/src/components/auth/EmailVerification.tsx:42`,
      `apps/web/src/app/test-agent/page.tsx:239`).
- [ ] Sentry on web + worker (gateway when deployed).
- [ ] Cookie consent banner tied to `core.consent_records`.
- [ ] Pick a production path for the legacy
      `apps/graphrag-pipeline/` Python serverless app
      (today it shadows the Rust worker). Recommendation: archive it
      once the Rust worker is steady-state in prod for a week.

### LOW

- [ ] Follow-up migration `075_fix_055_triggers.sql` — drop the
      `::text` cast in 12 functions from 055 so all 19 historical
      triggers actually enqueue. Until then a known set of entities
      (education_record, course, job_application, etc.) is silently
      skipped.
- [ ] Outcome attribution worker (consumes
      `goal_optimizer_outcomes` + `user_outcomes`).
- [ ] Central GraphRAG ingestion (populate the central Qdrant +
      Neo4j collections).
- [ ] Monte Carlo wrapper on the trajectory projector.

---

## 7. Operator runbook (post-deploy)

### Did the queue drain?

```sql
SELECT sync_status, count(*)
  FROM graphrag.sync_queue
 WHERE created_at > NOW() - INTERVAL '1 hour'
 GROUP BY 1;
```

`pending` rising → worker is down. `failed` rising → external service
(Gemini / Qdrant / Neo4j) returned errors; check `last_error`.
`dead` rising → exceeded retries; investigate.

### Is a specific user's graph synced?

```sql
SELECT entity_type, count(*) FROM graphrag.sync_queue
 WHERE user_id = '<uuid>' AND sync_status = 'completed'
 GROUP BY 1;
```

### Cross-user leakage spot check (Qdrant)

```bash
curl -sS -X POST -H "api-key: $QDRANT_API_KEY" \
  -H "content-type: application/json" \
  "$QDRANT_URL/collections/life_navigator/points/scroll" \
  -d '{"limit":1,"with_payload":true}' \
  | python3 -c "import json,sys; p=json.load(sys.stdin)['result']['points'][0]['payload']; \
                assert p.get('access_scope')=='personal' and p.get('tenant_id'), p"
```

Every point should declare `access_scope=personal` and a non-empty
`tenant_id`. A point without either is a bug — file an incident.

### Re-process a failed batch

```sql
UPDATE graphrag.sync_queue
   SET sync_status = 'pending', attempts = 0, last_error = NULL
 WHERE sync_status = 'failed'
   AND created_at > NOW() - INTERVAL '24 hours';
```

The worker will pick them up on the next poll.

---

## 8. What this round did NOT do

(deliberate scope guardrails from the prompt)

- No new product features.
- No onboarding redesign.
- No dashboard UX changes.
- No LLM wiring of the discovery / optimizer / matcher engines.
- No new Plaid sync routes.
- No central-graph ingestion (the central collection remains empty;
  recommended Phase 2).
- No fix to 055's `::text` bug (see HIGH-priority follow-up
  `075_fix_055_triggers.sql`).
- No Stripe wiring.
- No outcome attribution worker.

The architecture is now **real**, **tested**, and **launchable** for a
scoped beta.

---

## File map (this round)

```
supabase/migrations/074_graphrag_v2_triggers.sql                          NEW
apps/ingestion-worker/src/entities.rs                                     MODIFIED (+19 entity types)
apps/ingestion-worker/src/normalizer.rs                                   MODIFIED (relationships_for fix + summary builders)
apps/ingestion-worker/src/processor.rs                                    MODIFIED (doctest fix)
apps/ingestion-worker/tests/relationships.rs                              NEW
apps/ingestion-worker/deploy.sh                                           NEW
apps/api-gateway/deploy.sh                                                NEW
scripts/validation/smoke_test_graphrag.sh                                 NEW
PERSONALIZED_GRAPHRAG_ACTIVATION.md                                       NEW
```
