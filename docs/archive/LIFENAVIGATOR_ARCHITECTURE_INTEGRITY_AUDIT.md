# LifeNavigator Architecture Integrity, Regression, Security, and Launch Readiness Audit

**Audit Date:** 2026-05-30
**Scope:** Full monorepo at `life-nav-mvp` (branch `mvp`, ~30 uncommitted changes + 14 new migrations on top of `bd5d4e6 Beta stabilization`)
**Auditor role:** Principal Architect / Security / Product / AI Systems / QA / DBA / DevOps
**Methodology:** Direct codebase inspection. Functionality not verifiable in code is marked **unverified**. The audit does NOT modify code.

---

## Section 1 — Executive Summary

### Scores

| Category                        | Score                                                                                  | Light     |
| ------------------------------- | -------------------------------------------------------------------------------------- | --------- |
| Overall platform completion     | **~70%** (up from ~55% in the prior audit)                                             | 🟡 YELLOW |
| Launch readiness                | **~50%** — significantly improved on data + intake; still blocked on production wiring | 🟡 YELLOW |
| Architecture health             | **80%** — clean layering, but two scaffolded services not yet deployed                 | 🟡 YELLOW |
| Security                        | **75%** — RLS comprehensive; JWT contract correct; secrets-management gap remains      | 🟡 YELLOW |
| User Graph readiness            | **90%** — 14 migrations, 56+ new tables, schemas honest                                | 🟢 GREEN  |
| GraphRAG readiness              | **65%** — pipeline + worker + gateway all exist; never run end-to-end                  | 🟡 YELLOW |
| Simulation readiness            | **80%** — engine + API + UI + tests; pure deterministic                                | 🟢 GREEN  |
| Recommendation engine readiness | **75%** — optimizer engine + tests + UI + persistence; LLM layer is a stub adapter     | 🟡 YELLOW |

### Headline assessment

The prior audit found a 55% platform with marketing-vs-implementation gaps and a missing decision graph. **The implementation gap has narrowed dramatically.** What's been added: 14 new migrations (~56 tables) covering goal discovery, driver scoring, decision graph, estate planning, insurance, optimizer, trajectory, marketplace, wearable monitoring; a deterministic discovery engine; a deterministic optimizer; a deterministic trajectory projector; a deterministic marketplace matcher; a non-diagnostic health alert engine; a complete Rust ingestion worker scaffold; a complete FastAPI gateway scaffold. **288 tests pass across three languages.**

What did **not** change since the prior audit: secrets-management contract (still env-config, not Vault), missing email-verification middleware enforcement, no rate limiting, no production deployment of the Rust worker or FastAPI gateway, Stripe still stubbed, Credly still stubbed, mobile app still skeleton.

### Major risks

1. **Two new services (Rust worker, FastAPI gateway) compile and test cleanly but have never been deployed.** Launch dependency on either is currently theoretical.
2. **`is_health_enabled()` still returns `false`** (verified at `supabase/migrations/038_health_locked.sql`). Every owner-context write to the 17+ health_meta tables added in 063/069/073 will fail until that's flipped. Routes fall back gracefully (`feature_locked: true`); UI surfaces a banner.
3. **Compliance-vetter is regex-based**, not LLM-aware. It catches the obvious cases but a sufficiently creative LLM output could slip through.
4. **A doctest regression** in `apps/ingestion-worker/src/processor.rs` was caught: the module-level comment's ASCII flow diagram parses as a doctest and fails. `cargo test` (default) shows 1 failed doctest; `cargo test --tests --lib` (which the implementation doc cites) passes 22/22. The crate is otherwise sound but the published doc claim was incomplete.
5. **AgentProxy / `localhost:8000`** legacy code is still in the repo (`apps/web/src/services/`) — referenced from `EmailVerification.tsx:42` and `test-agent/page.tsx:239`. Production-stale; remove or rewire.

### Major opportunities

1. The User Graph is now well over the threshold for the Decision Engine to operate. The optimizer already reads from `finance.user_financial_profile`, `finance.debts`, `insurance_plans`, `user_decision_preferences`, `user_domain_risk_tolerance`, `career_profiles`, `education_intake`, `goals` — all under RLS.
2. The Rust worker + FastAPI gateway together form a deployable two-process backend that resolves the prior audit's "multi-agent claim is theatre" finding by giving us a real, defensible architecture.
3. The deterministic engines (discovery, optimizer, projector, matcher, alert) are all LLM-adapter-ready. A single PR per engine can flip to Gemini without rewriting persistence or UI.

---

## Section 2 — Git and File Change Analysis

### Snapshot

- **Base commit:** `bd5d4e6 Beta stabilization: rewire auth to Supabase, restore missing API routes, harden onboarding`.
- **Uncommitted on top:** 4 modified files + ~60 new files / folders (per `git status --short`).
- **Documents added at repo root:**
  - `SEQUENCED_BUILD_PLAN.md`
  - `USER_GRAPH_ONBOARDING_IMPLEMENTATION.md`
  - `COMPLETE_INTAKE_USER_GRAPH_IMPLEMENTATION.md`
  - `ONBOARDING_ROOT_GOAL_DISCOVERY_IMPLEMENTATION.md`
  - `DYNAMIC_GOAL_OPTIMIZER_IMPLEMENTATION.md`
  - `LIFE_TRAJECTORY_SIMULATION_ENGINE.md`
  - `CAREER_MARKETPLACE_IMPLEMENTATION.md`
  - `WEARABLE_MONITORING_IMPLEMENTATION.md`
- **Migrations added:** `060`–`073` (14 files, ~56 tables, 1 view, 4 RPCs).
- **New apps:** `apps/ingestion-worker/` (Rust), `apps/api-gateway/` (FastAPI).
- **SQL validation scripts:** 7 files under `scripts/validation/` (one per major migration family) + `seed_intake_demo.sql`.

### Modified files (4)

| File                                                 | Change                                                                                                                                                                               | Intent      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `apps/web/src/app/onboarding/interactive/page.tsx`   | Inserted `USER_GRAPH` step between `RISK` and `ACHIEVEMENTS`; added `saveUserGraph()` call in `handleSubmit`; updated `stepLabels` array                                             | ✅ Intended |
| `apps/web/src/app/onboarding/questionnaire/page.tsx` | Inserted `USER_GRAPH` step between `RISK` and `COMPLETE`; redirected `RISK.onNext` from `handleSubmit` to `nextStep`; added `saveUserGraph()` call before `/api/onboarding/complete` | ✅ Intended |
| `apps/web/src/lib/supabase/types.ts`                 | Added Row/Insert/Update shapes for all 11 new public-schema tables + helper type aliases                                                                                             | ✅ Intended |
| `packages/supabase/src/database.types.ts`            | Same set of new tables in the shorter shape this package uses                                                                                                                        | ✅ Intended |

### Files deleted unexpectedly

**None observed.** `git status` shows no deletions. The independent agent investigation confirmed every prior auth form, middleware, Plaid route, scenario-lab route, dashboard folder, component, and pre-existing onboarding endpoint is intact.

### Routes removed

**None.** All 26 pre-existing onboarding routes still exist alongside the new ones. Prior `/api/integrations/plaid/*`, `/api/scenario-lab/*`, `/api/user/*`, `/api/goals/*`, `/api/dashboard/*`, `/api/career/*`, `/api/education/*`, `/api/data/*`, `/api/agent/chat` all present.

### Components removed

**None.** 134 component files in the verified directories remain in place.

### Schema drift

**None within additive migrations.** All 14 new migrations use `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS`. No `DROP TABLE`, `DROP COLUMN`, or destructive `ALTER` against prior tables. Existing GraphRAG triggers (050/055) on `public.goals` use `to_jsonb(NEW)` which is forward-compatible with the new columns added in 068 (verified by the RLS audit agent).

### Suspicious changes

- The Rust worker's `INGESTION_WORKER_IMPLEMENTATION.md` claims "**22 passed, 0 failed**" without qualifying which test layer. `cargo test` (the default invocation) actually fails one doctest (`src/processor.rs - processor (line 3)`) because the module-level ASCII flow diagram is parsed as Rust code. **The 22 unit + integration tests pass; the doc claim should have said `cargo test --tests --lib`.** Minor but it's a doc/reality drift.

---

## Section 3 — Regression Analysis

| Area                   | Verdict                | Evidence                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**     | Unchanged              | All four auth forms still call Supabase's standard auth methods (`signInWithPassword`, `signUp`, `resetPasswordForEmail`, `updateUser`). No changes to middleware or session handling.                                                                                                                                                                                              |
| **Plaid**              | Unchanged              | `apps/web/src/app/api/integrations/plaid/{link-token,exchange,accounts,transactions,disconnect}/route.ts` all exist and unchanged.                                                                                                                                                                                                                                                  |
| **Dashboards**         | Improved               | 3 new dashboard pages (`next-dollar-optimizer`, `life-trajectory`, `jobs`) added. Existing dashboards (`finance`, `career`, `education`, `healthcare`, `calculators`, `roadmap`, `scenario-lab`, `settings`) intact.                                                                                                                                                                |
| **Scenario Lab**       | Unchanged              | Spot-check of `/api/scenario-lab/{scenarios, health, pins}/route.ts` confirms no modifications. 19 scenario-lab routes still present.                                                                                                                                                                                                                                               |
| **Goal Tracking**      | Improved               | `public.goals` extended with 13 new columns (`stated_goal`, `root_goal`, driver scores, urgency, confidence). New audit log `goal_discovery_turns`. `/api/goals/*` routes unchanged but goals can now carry full discovery payload.                                                                                                                                                 |
| **Financial Planning** | Improved               | Optimizer added on top of existing `finance.*` tables. Existing routes intact. New summary table `finance.user_financial_profile`.                                                                                                                                                                                                                                                  |
| **Career Planning**    | Improved               | `career_profiles` extended with 10 new columns. New `/api/onboarding/career-extended/route.ts`. Career marketplace 13 tables added.                                                                                                                                                                                                                                                 |
| **Education Planning** | Improved               | New `education_intake` + `education_credentials` tables. New `/api/onboarding/education-intake/route.ts`. Existing `/api/education/*` unchanged.                                                                                                                                                                                                                                    |
| **Health Tracking**    | Improved (schema only) | 17 new `health_meta.*` tables; all gated by `is_health_enabled() = false`. Routes accept input but return `feature_locked: true` until the gate flips.                                                                                                                                                                                                                              |
| **Arcana Readiness**   | Improved               | Schema for body measurements, training, injuries, daily wellbeing, vitals, labs, meds, supplements, interventions, nutrition all present. `core.user_integration_consents` + `record_integration_consent` / `revoke_integration_consent` RPCs in place. FastAPI route `/api/arcana/lead-package/{preview,send}` scaffolded with consent gate. No outbound Arcana intake POST wired. |
| **Reporting**          | Unchanged              | Scenario Lab PDF generation route intact. No new reports built this iteration.                                                                                                                                                                                                                                                                                                      |
| **Notifications**      | Unchanged              | `user_notifications` table + `/api/dashboard/notifications` route unchanged. No new digest job.                                                                                                                                                                                                                                                                                     |
| **Mobile Readiness**   | Unchanged              | `apps/mobile/` still skeleton; build script still `echo 'Mobile build placeholder'`.                                                                                                                                                                                                                                                                                                |

**No regressions observed.** Every previously functional feature still functions. The two modifications to the onboarding pages are additive — the new `USER_GRAPH` step is inserted, the existing steps and their handlers are preserved, and `handleSubmit` calls every prior endpoint plus `saveUserGraph()` (which is non-blocking on partial failure).

---

## Section 4 — Conversational Onboarding Audit

### Implementation

| Capability                                                            | Status                                                                                                                                                                                                                               | Location                                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Conversational shell (turn-by-turn)                                   | ✅ Implemented                                                                                                                                                                                                                       | `apps/web/src/components/onboarding/ConversationalShell.tsx`                                                                   |
| Adaptive questioning (deterministic engine; LLM adapter point exists) | ✅ Implemented (no LLM yet)                                                                                                                                                                                                          | `apps/web/src/lib/discovery/engine.ts`                                                                                         |
| Save and resume                                                       | 🟡 Partial — `user_onboarding_sections` table tracks per-section status; the hub UI honors it. Discovery transcripts persist via `goal_discovery_turns`; the **shell does not currently rehydrate an in-progress session on reload** | `/onboarding/hub`, `goal_discovery_turns`, `ConversationalShell.tsx`                                                           |
| Section summaries                                                     | ✅ Implemented                                                                                                                                                                                                                       | `/onboarding/review` (consumes `/api/onboarding/profile-summary`)                                                              |
| Edit before save (confirmation card)                                  | ✅ Implemented                                                                                                                                                                                                                       | `ConversationalShell.tsx` — explicit "Did I understand that correctly?" card with `Yes` / `Not quite — let me adjust` controls |

### Root-goal discovery

| Element                   | Status | Evidence                                                                             |
| ------------------------- | ------ | ------------------------------------------------------------------------------------ | ------ | ---- | ---------- |
| `stated_goal`             | ✅     | `goals.stated_goal` column (068); engine writes it                                   |
| `need_behind_need`        | ✅     | `goals.need_behind_need` column (068); engine writes it after the `what_unlock` turn |
| `root_goal`               | ✅     | `goals.root_goal` column (068); engine writes it after the `why_important` turn      |
| `success_definition`      | ✅     | `goals.success_definition` column (068)                                              |
| `urgency`                 | ✅     | `goals.urgency` column (068) with `CHECK (low                                        | medium | high | critical)` |
| `consequence_of_inaction` | ✅     | `goals.consequence_of_inaction` column (068)                                         |

### Driver scoring (Financial Security / Image / Performance)

| Element                   | Status         | Evidence                                                                                                                                            |
| ------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scorer                    | ✅ Implemented | `apps/web/src/lib/discovery/scoring.ts` — word-boundary keyword bank + strong-signal regex table; 13 dedicated tests in `__tests__/scoring.test.ts` |
| Persisted scores          | ✅             | `goals.financial_security_score`, `goals.image_score`, `goals.performance_score`, `goals.dominant_driver`, `goals.secondary_driver` (068)           |
| Per-turn driver detection | ✅             | `goal_discovery_turns.detected_drivers JSONB` (068)                                                                                                 |

### What → What → Why methodology

Confirmed in `apps/web/src/lib/discovery/prompts.ts` — `ROOT_GOAL_DISCOVERY_SYSTEM_PROMPT` explicitly enumerates:

```
1. WHAT?    "What are you trying to accomplish?"
2. WHAT?    "What would achieving that allow you to do?"
3. WHY?     "Why is that important to you right now?"
```

And the `engine.ts` state machine walks `what_accomplish → what_unlock → why_important → success_definition → consequence_of_inaction → urgency` in that order via `chooseNextPromptKind`.

### Confirmation workflow

Implemented in `ConversationalShell.tsx` — `buildConfirmationText` produces the exact "You stated / It appears your underlying goal is / Your primary motivation appears to be / Success would look like / Did I understand that correctly?" template, and rejects the summary back into a follow-up "What would you change?" prompt.

### Missing / partial

- **Mid-session resume.** Discovery transcripts persist, but the `ConversationalShell` does not currently load a previously-started session on mount. **Verdict: partial.**
- **LLM-driven prompt generation.** The engine has a clean adapter point (`pickPromptText`, `inferRootGoal`) but no real LLM is wired. Today the prompts are canned and the root-goal inference is a deterministic concat. **Verdict: scaffolded.**

---

## Section 5 — User Graph Audit

| Concept              | Status                    | Table                                                                                                |
| -------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Life Vision          | ✅ Implemented            | `public.user_life_vision` (060) — unique `(user_id, horizon)`, 6-horizon CHECK                       |
| Goals                | ✅ Implemented + extended | `public.goals` + 12 new columns from 068                                                             |
| Constraints          | ✅ Implemented            | `public.user_constraints` (060) — 6-dimension CHECK, severity hard/soft                              |
| Capabilities         | ✅ Implemented            | `public.user_capabilities` (060) — proficiency level CHECK                                           |
| Motivations          | ✅ Implemented            | `public.user_motivations` (060) — optional FK to goals, 5-type CHECK                                 |
| Risk Tolerance       | ✅ Implemented            | `public.user_domain_risk_tolerance` (060) — 5 domains, qualitative + numeric                         |
| Decision Preferences | ✅ Implemented            | `public.user_decision_preferences` (060+061) — 10 axes after expansion                               |
| Decisions            | ✅ Implemented            | `public.user_decisions` (060) — reversibility, status, options_considered JSONB                      |
| Recommendations      | ✅ Implemented            | `public.user_recommendations` (060) — lifecycle: pending/accepted/rejected/expired/snoozed/completed |
| Outcomes             | ✅ Implemented            | `public.user_outcomes` (060) — references goal/decision/recommendation with CHECK                    |
| Actions              | ✅ Implemented            | `public.user_actions` (061) — domain, action_type, effort, cost                                      |
| Life Events          | ✅ Implemented            | `public.user_life_events` (061) — 21 event types with CHECK                                          |

### Schema quality

- Every table has `user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`.
- Every table has `source TEXT`, `metadata JSONB DEFAULT '{}'`, `created_at`, `updated_at` with `core.set_updated_at()` triggers.
- `confidence_score NUMERIC(3,2)` with `CHECK (… BETWEEN 0 AND 1)` on every table that has it.
- CHECK constraints on every enum-style column (verified by the RLS audit agent).
- Indexes: `user_id` on every table; `(user_id, created_at DESC)` for time-series; partial indexes on nullable FKs.
- UNIQUE constraints where natural (e.g. `(user_id, axis)` on decision preferences, `(user_id, domain)` on risk tolerance, `(user_id, horizon)` on life vision).

### Relationships (graph layer)

The Rust worker emits the following relationships in `normalizer.rs::relationships_for`:

`HAS_GOAL`, `HAS_CONSTRAINT`, `HAS_CAPABILITY`, `HAS_MOTIVATION`, `HAS_DECISION_PREFERENCE`, `HAS_RISK_TOLERANCE`, `MADE_DECISION`, `RECEIVED_RECOMMENDATION`, `TOOK_ACTION`, `OBSERVED_OUTCOME`, `HAS_HEALTH_METRIC`, `HAS_INSURANCE_PLAN`, `HAS_CAREER_PROFILE`, `HAS_EDUCATION_RECORD`, `HAS_WEARABLE_METRIC`, `GENERATED_ARCANA_LEAD`, `RELATED_TO` (catch-all).

Cross-domain edges (`SUPPORTS_GOAL`, `BLOCKS_GOAL`, `IMPACTS`, `DEPENDS_ON`) are **not yet emitted**; the worker writes one relationship per entity back to the user's Person node. Flagged as deferred in `INGESTION_WORKER_IMPLEMENTATION.md`.

### Normalization quality

Good. Domain-specific tables (`finance.*`, `health_meta.*`) avoid stuffing everything into `public.*`. Polymorphic outcomes use a `CHECK` constraint to require at least one of `goal_id`, `decision_id`, `recommendation_id` to be set.

### Design issues

- **`user_recommendations` and `goal_optimizer_recommendations` overlap.** The optimizer writes both — first the rich engine-specific row to `goal_optimizer_recommendations`, then _also_ could (and should, in a future iteration) write a row to `user_recommendations` so the central recommendation lifecycle is one table. Today the optimizer accept-route only updates `goal_optimizer_recommendations`. This is a forward-compatibility issue, not a bug.
- **Outcome attribution is not yet wired.** `user_outcomes` and `goal_optimizer_outcomes` both exist; no worker observes user metrics and writes them. Deferred.

---

## Section 6 — Financial Optimization Audit

### Plaid integration

| Capability        | Status        | Evidence                                                                                                         |
| ----------------- | ------------- | ---------------------------------------------------------------------------------------------------------------- |
| Plaid integration | ✅ Unchanged  | `/api/integrations/plaid/{link-token,exchange,accounts,transactions,disconnect}/route.ts` all present and intact |
| Account sync      | ✅            | `accounts/route.ts` calls Plaid SDK                                                                              |
| Transaction sync  | ✅            | `transactions/route.ts` present                                                                                  |
| Liability sync    | 🟡 Unverified | No dedicated route; covered partially via `accounts`                                                             |
| Investment sync   | 🟡 Unverified | No dedicated route observed                                                                                      |

### Dynamic Goal Optimizer

Confirmed at `apps/web/src/lib/optimizer/{scoring,engine}.ts` + `/api/optimizer/run/route.ts` + `/dashboard/next-dollar-optimizer/page.tsx`.

| Question                                                | Answer                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can the platform distinguish surface goal vs root goal? | **Yes.** `goals` carries `stated_goal` (surface) and `root_goal` (after discovery). `goal_interpretations` is a dedicated audit log of inferred true goals. The optimizer's `inferTrueGoal` function maps "pay off my credit cards" → "Reduce financial fragility and free up monthly cash flow" (verified by `__tests__/engine.test.ts::infers debt-payoff stated goal as financial fragility reduction`). |
| Allocation engine                                       | ✅ Implemented — 13 categories, hard-priority + proportional remainder, sums to surplus exactly (verified at $200, $500, $1500, $12,345 in tests)                                                                                                                                                                                                                                                           |
| Recommendation generation                               | ✅ Implemented — runs persist to `goal_optimizer_runs/_inputs/_assumptions/_allocations/_tradeoffs/_recommendations`                                                                                                                                                                                                                                                                                        |
| Accept → user_decisions + user_actions                  | ✅ Implemented in `/api/optimizer/runs/[id]/accept/route.ts`                                                                                                                                                                                                                                                                                                                                                |
| Compliance language                                     | ✅ — UI carries permanent compliance banner; assumptions row written on every run with `planning_language_only: true`                                                                                                                                                                                                                                                                                       |

### Missing logic

- **Liability + investment Plaid sync** — no dedicated routes observed.
- **Outcome attribution job** — `goal_optimizer_outcomes` schema exists; no worker observes net-worth delta after acceptance.
- **LLM upgrade of `inferTrueGoal`** — adapter point is clean.

---

## Section 7 — Health / Arcana Audit

| Capability                     | Status                                   | Evidence                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health intake fields exist     | ✅                                       | 17 health_meta tables across 063 + 069                                                                                                                                                                                                                                                                                                         |
| Insurance upload support       | ✅ Schema; ❌ no storage bucket creation | `public.insurance_documents` (064) with `storage_bucket TEXT DEFAULT 'insurance'`; the doc explicitly notes the bucket must be created out-of-band (`supabase storage create-bucket insurance --public=false`)                                                                                                                                 |
| Benefits upload support        | 🟡 Schema only                           | `public.benefit_profiles` (069) captures employer + government benefit posture; no upload UI yet                                                                                                                                                                                                                                               |
| Health document extraction     | 🟡 Schema only                           | `public.insurance_extracted_facts` (064) with bbox + confidence; no OCR worker writes to it                                                                                                                                                                                                                                                    |
| Arcana lead package generation | ✅ Service + route scaffold              | `apps/api-gateway/app/services/arcana_lead_package.py` builds preview with `goals / current_health_status / fitness_level / diet / sleep / injuries / recovery / timeline / motivation / risk_tolerance / constraints`; `apps/api-gateway/app/routes/arcana.py` exposes `/lead-package/{preview,send}`                                         |
| Consent workflow               | ✅                                       | `core.user_integration_consents` + `record_integration_consent` / `revoke_integration_consent` RPCs (068). The Arcana send route is consent-gated via `authorize_send(consent_record)` which checks `granted=true, revoked_at=null, expires_at>now()`. Audit-log entries emitted in both grant and revoke paths via `core.security_audit_log`. |

### Encryption — verified

`core.encrypt_with_app_key(plaintext TEXT) → TEXT` defined in `064_insurance_benefits.sql` (lines 23–42) reads the key from `current_setting('app.settings.encryption_key', true)`. The insurance route calls it via `supabase.schema('core').rpc('encrypt_with_app_key', { plaintext: member_id })`. **Key provisioning is the operator's responsibility — verify in prod.**

### Missing

- **Health feature gate still false.** `public.is_health_enabled() RETURNS BOOLEAN AS $$ SELECT false; $$;` at `038_health_locked.sql`. All owner-context writes to the 17 health_meta tables fail until this is flipped. Routes fall back to `feature_locked: true` and the UI banners it.
- **OCR worker for insurance documents.** Tables exist; no consumer process.
- **Outbound Arcana intake POST.** Service + audit framework + consent gate are in place; the actual HTTP call to Arcana is intentionally not wired and is called out in the FastAPI README as a partnership-contract follow-up.
- **Storage bucket creation** for `insurance` — must be run manually before document upload works.

---

## Section 8 — Career Marketplace Audit

| Capability            | Status                      | Evidence                                                                                                                                                                                |
| --------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Employer profiles     | ✅                          | `public.employer_profiles` (072) — verification status, subscription tier                                                                                                               |
| Job posting system    | ✅                          | `public.employer_job_posts` + `_requirements` + `_benefits` + `_locations` + `_pricing` (072)                                                                                           |
| Candidate profiles    | ✅                          | `public.candidate_career_profiles` (072) — visibility, open_to_introductions, availability_timeline                                                                                     |
| Candidate matching    | ✅                          | Deterministic 6-dimension scorer at `apps/web/src/lib/marketplace/matcher.ts`; bulk refresh on publish in `match-batch.ts`                                                              |
| Privacy controls      | ✅                          | Visibility flag (`hidden/anonymous/selected_employers/open`); employer-cannot-see-PII before consent enforced via RLS (verified in `scripts/validation/072_career_marketplace_rls.sql`) |
| Candidate consent     | ✅                          | `consent_to_intro` action in `/api/jobs/matches/[id]/route.ts` flips status to `intro_consented`, which is the trigger for employer raw-row read                                        |
| Anonymized matching   | ✅                          | `public.employer_match_anonymized` view (072) excludes `user_id` and is jest-tested at the columns level + SQL-validation tested via `information_schema.columns`                       |
| Employer messaging    | ✅ Schema; UI not yet built | `public.employer_candidate_messages` (072) with dual-side RLS; no UI page exposes it                                                                                                    |
| Pricing model support | ✅ Schema                   | `public.employer_job_post_pricing` + `employer_billing_events` (072); Stripe webhooks not wired                                                                                         |

### Missing

- **Stripe webhook integration** — billing rows can be created manually; no production payment flow.
- **Messaging UI** — thread UI does not exist; surface is API + DB only.
- **Featured-placement queries** — pricing table has `featured_placement BOOLEAN` but no ranker uses it.

---

## Section 9 — Estate & Legacy Planning Audit

| Capability                 | Status                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Will tracking              | ✅ — `public.estate_planning_profile.has_will`, `will_last_updated` (068)                                                |
| Trust tracking             | ✅ — `has_living_trust`, `trust_type`, `trust_last_updated` (068)                                                        |
| Beneficiary tracking       | ✅ — `public.estate_beneficiaries` with `asset_class`, `allocation_percent`, `is_contingent` (068)                       |
| Power of attorney tracking | ✅ — `has_financial_poa`, `financial_poa_holder`, `has_healthcare_poa`, `healthcare_poa_holder` (068)                    |
| Healthcare directives      | ✅ — `has_healthcare_directive`, `has_living_will`, `has_hipaa_release` (068)                                            |
| Legacy goals               | ✅ — `charitable_intent`, `legacy_goals` (068); also touched by `public.user_life_vision.horizon='fears_to_avoid'` (060) |
| API                        | ✅ — `/api/onboarding/estate/route.ts` (PUT/GET)                                                                         |
| UI                         | ❌ Missing — Estate persona exists at `/onboarding/converse` but no dedicated `/onboarding/sections/estate` page         |

**Verdict: schema + API implemented; UI partial.** The estate-advisor persona in the conversational shell is functional, but a dedicated structured-form section for users who prefer forms over chat is not built.

---

## Section 10 — GraphRAG Architecture Audit

### Intended architecture

```
Supabase  →  Rust worker  →  Gemini  →  Qdrant + Neo4j
```

### Actual

| Layer                            | State      | Evidence                                                                                                                                                                                                                 |
| -------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Supabase (`graphrag.sync_queue`) | ✅         | `050_graphrag.sql` defines the queue + `enqueue_sync` + `claim_sync_jobs` + `complete_sync_job` RPCs                                                                                                                     |
| Triggers on source tables        | ✅ Partial | `050_graphrag.sql` (goal, financial_account, risk_assessment, career_profile) + `055_graphrag_expanded_triggers.sql` (education_record, course, job_application). **Triggers for the 060–073 tables are NOT yet added.** |
| Rust worker                      | ✅ Built   | `apps/ingestion-worker/` — cargo check + cargo test pass (with the doctest caveat noted)                                                                                                                                 |
| Gemini embedding                 | ✅ Wired   | `gemini_client.rs::embed` calls `text-embedding-004`                                                                                                                                                                     |
| Qdrant upserts                   | ✅ Wired   | `qdrant_client.rs::upsert` with payload carrying `tenant_id, user_id, entity_type, entity_id, domain, source_table, access_scope='personal', sensitivity_level`                                                          |
| Neo4j upserts                    | ✅ Wired   | `neo4j_client.rs::upsert_node` with `MERGE (n:Label { tenant_id: $tenant_id, entity_id: $entity_id }) SET n += $attrs`                                                                                                   |

### Central graph vs personal graph

**Architecture:** correct. The FastAPI gateway exposes `services/graphrag_central.py` (no tenant filter) and `services/graphrag_personal.py` (refuses queries without `user_id`). The Qdrant client has `search_personal` and `search_central` with separate collections. The Neo4j client has `run_personal` (refuses Cypher without `$tenant_id`) and `run_central` (no tenant filter).

**Current state:** the personal graph is fed by the Rust worker once it's deployed. The central graph is empty — no central-knowledge ingestion job exists. The retrieval code returns the empty central hits gracefully.

### Tenant isolation

Verified at four layers:

1. **Rust worker** — `tenant_id == user_id`; every Qdrant payload carries both; every Neo4j MERGE filters by `tenant_id: $tenant_id`. Enforced by `tests/tenant_isolation.rs` (3 tests).
2. **FastAPI gateway** — `build_personal_filter(user_id)` always pins `tenant_id + user_id + access_scope='personal'`; `Neo4jClient.run_personal` refuses Cypher without `$tenant_id`. Enforced by `tests/test_personal_retrieval_filter.py` (10 tests).
3. **Supabase RLS** — every user-data row carries `auth.uid() = user_id` policy on the source-of-truth side.
4. **`user_id` from JWT only** — the gateway never reads `user_id` from request body. Enforced by `tests/test_auth.py::test_user_id_comes_only_from_jwt_not_from_body`.

### Idempotency

Worker upsert key: `tenant_id|entity_type|entity_id`. Same job processed twice produces the same Qdrant point id and the same Neo4j MERGE statement. Enforced by `tests/idempotency.rs` (3 tests) and `tests/retry_safety.rs` (3 tests).

### Sensitive-field embedding

`SENSITIVE_FIELD_PATTERN` in `apps/ingestion-worker/src/telemetry.rs` strips: `*_encrypted$`, `member_id`, `group_number`, `account_number`, `routing_number`, `ssn`, `social_security`, `notes_encrypted`, `password*`, `api_key`, `access_token*`, `refresh_token*`. Enforced by `tests/no_sensitive_field_embedding.rs` (4 tests).

### Architectural drift

- **Triggers gap.** The 060–073 tables (60+ tables) are NOT yet wired into the sync queue. The worker is ready; the producers aren't fully connected. Without those triggers the worker will never see a goal-discovery turn, an optimizer run, a trajectory snapshot, etc.
- **Deployment gap.** Neither the Rust worker nor the FastAPI gateway has been deployed. Until then, end-to-end retrieval is theoretical.
- **Existing Python `graphrag-pipeline` still in repo.** A prior generation of the same idea lives at `apps/graphrag-pipeline/`. If we keep both, document which is the production path. Currently the web app's `graphrag-query` Edge Function falls back to the Python pipeline; the Rust worker is the future replacement.

---

## Section 11 — Security Audit

### Authentication

| Item                                                    | Status                                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Supabase Auth still primary                             | ✅ — `apps/web/src/lib/supabase/{client,server}.ts` use `@supabase/ssr`                               |
| JWT validation in FastAPI gateway                       | ✅ — HS256, audience-checked, `require: ['exp', 'sub']`, 401 on every failure mode. **9 tests pass.** |
| `user_id` from JWT only                                 | ✅ Verified by test                                                                                   |
| Middleware gates dashboard/onboarding                   | ✅ Unchanged                                                                                          |
| **Email verification enforced before dashboard access** | ❌ Still not enforced (carried over from prior audit)                                                 |
| 2FA backend                                             | ❌ Not implemented (UI mentions it; backend doesn't)                                                  |
| Rate limiting                                           | ❌ None on auth or any other route                                                                    |

### Authorization

- Middleware allow-list for public routes is concrete and minimal. All `/dashboard/*`, `/onboarding/*`, `/api/*` (except `/api/auth/*`) gated.
- The FastAPI gateway requires the JWT on every route except `/healthz` and `/readyz`.
- Service-role usage in the Next.js API surface is limited to: account creation (employer profile + owner link), match-batch refresh, and the encryption RPC's effective context. Each path was verified to confirm the caller's authority before doing anything.

### RLS

The independent RLS audit walked every table in migrations 060–073 (56+ tables) and reported:

**All 56 new tables have RLS enabled with `auth.uid() = user_id` owner policies plus service-role bypass where backend jobs need it.** Health_meta tables additionally carry `is_health_enabled() AND auth.uid() = user_id`. Marketplace tables intentionally allow public read on `status='verified'` employer profiles and `status='published'` job posts. Every `user_id` FK uses `ON DELETE CASCADE` (GDPR-clean).

**Zero RLS gaps observed.**

### Tenant isolation

Beyond the GraphRAG layer (Section 10): the Marketplace's `job_candidate_matches` table uses a **three-tier policy** (candidate sees own, employer sees only `intro_consented`/`applied`, service-role full) which is the strongest tenant-style isolation in the codebase. Verified end-to-end by `scripts/validation/072_career_marketplace_rls.sql`.

### Sensitive fields encrypted

- `member_id_encrypted`, `group_number_encrypted` on `insurance_plans` — go through `core.encrypt_with_app_key`.
- `notes_encrypted` on health_meta tables (063).
- `ocr_raw_text_encrypted` on `insurance_documents`.
- Plaid + OAuth tokens — via existing `011_mvp_integrations_auth.sql`.

**Risk:** the encryption key is read from `current_setting('app.settings.encryption_key', true)`. If this Postgres runtime config is not set in production, encrypted columns silently fail to insert. **Pre-launch checklist item.**

### Consent tracking

- `core.consent_records` extended with `purpose`, `scope`, `expires_at` in 068.
- New `core.user_integration_consents` with `(user_id, integration, purpose)` UNIQUE.
- Both `record_integration_consent` and `revoke_integration_consent` RPCs emit `core.security_audit_log` events automatically.

### Audit logging

- `core.security_audit_log` exists (020).
- Optimizer accept route does NOT write an audit log entry — only updates `user_decisions` and `user_actions`. Minor gap.
- Consent RPCs DO write audit log entries.

### RLS gaps / cross-user leakage / exposed secrets / privilege escalation

**RLS gaps:** zero observed.

**Cross-user leakage risk:** zero observed in the source-of-truth tables. The FastAPI gateway's compliance vetter explicitly catches a "based on similar users' data" pattern and refuses to surface it. The Rust worker strips sensitive fields before embedding and is jest-tested against an explicit allowlist of sensitive field names.

**Exposed secrets:** none in code. `.env.example` files explicitly list secrets and warn against committing them. **The two new apps (ingestion-worker, api-gateway) need `fly secrets set` before deploy.**

**Unsafe API routes:** the test-only `apps/web/src/app/test-agent/page.tsx` is reachable in production builds. Should be hidden behind a build flag or removed.

**Privilege escalation:** the only routes that elevate to service-role on behalf of a user are the employer-profile create (one-time) and the match-batch refresh (cross-user reads for matching). Both confirm caller identity before doing anything. No paths observed where service-role is used speculatively.

### Findings summary

| Severity | Finding                                                                                 |
| -------- | --------------------------------------------------------------------------------------- |
| HIGH     | Email verification not enforced in middleware before dashboard access                   |
| HIGH     | No rate limiting on `/api/auth/*` or `/api/agent/chat`                                  |
| MEDIUM   | `app.settings.encryption_key` provisioning unverified in target env                     |
| MEDIUM   | Legacy AgentProxy references to `localhost:8000` / `localhost:8080` in 2 frontend files |
| LOW      | Optimizer accept route does not write `security_audit_log`                              |
| LOW      | `/test-agent` page reachable in prod builds                                             |

---

## Section 12 — Simulation Engine Audit

| Capability                 | Status      | Evidence                                                                                                                                                                                       |
| -------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Life-scenario tables exist | ✅          | 9 tables in `071_life_trajectory_simulation.sql`                                                                                                                                               |
| Simulation service exists  | ✅          | `apps/web/src/lib/trajectory/{projector,generator,inputs}.ts`                                                                                                                                  |
| Multi-year support         | ✅          | `horizon_years INT CHECK (horizon_years > 0 AND horizon_years <= 60)` — projector compiles up to 720 months                                                                                    |
| Monte Carlo support        | ❌ Deferred | Doc explicitly calls out: "Returns are deterministic — Monte Carlo is a follow-up wrapper. The schema already supports it via `life_scenario_metrics` (add `metric_key='net_worth_p10'` etc.)" |
| Financial simulation       | ✅          | net worth, cash flow, debt avalanche, employer match, retirement contributions, taxable investing, HSA, inflation, income growth                                                               |
| Career simulation          | 🟡 Partial  | `career_change` and `enroll_education` decision types fire income uplifts at completion month; no dedicated career-path model                                                                  |
| Education simulation       | 🟡 Partial  | `enroll_education` decision type charges tuition + schedules income uplift; no dedicated education-ROI rollup                                                                                  |
| Health simulation          | 🟡 Partial  | `annual_health_premium + expected_annual_oop` as a flat assumption; no productivity or healthcare-cost-trajectory model                                                                        |

13 jest tests verify determinism, shape, and the 5 canonical scenario paths (current_behavior / conservative / balanced / aggressive_upside / goal_optimized).

### Missing functionality

- Monte Carlo wrapper (return distributions; percentile bands).
- LLM-driven scenario narration.
- "Accept this scenario as my plan" → `user_decisions` + `user_actions` (mirrors the optimizer accept flow). Deferred per doc.

---

## Section 13 — API and Backend Audit

### Web app API routes (Next.js)

`125` `route.ts` files under `apps/web/src/app/api/`. Spot-check confirms:

- All onboarding routes (26 new + 7 pre-existing) use `createServerSupabaseClient()` and validate with Zod. **No `userId` is read from request body anywhere I inspected.**
- All optimizer routes properly chain `auth.getUser()` → load → persist → return.
- All marketplace routes follow the same pattern.
- All health-monitoring routes follow the same pattern, with the additional `feature_locked` graceful-degradation shape when RLS denies because the health gate is off.

### FastAPI gateway routes

13 routes registered, 11 protected by `current_user`, 2 public (`/healthz`, `/readyz`). Verified by importing `app.main:app` and listing `app.routes`.

### Middleware / authentication / authorization

- Web app middleware unchanged from prior audit; still gates dashboard + onboarding.
- FastAPI gateway: `current_user` dependency on every protected route; no manual JWT parsing duplicated anywhere; 29 pytest tests verify the contract.

### Dead endpoints / duplicates / orphans / unused code

- **Dead:** none observed in the new code.
- **Duplicates:** the Next.js app has `/api/simulations/*`, `/api/optimizer/run`, `/api/health-monitoring/*` AND the FastAPI gateway has `/api/simulations/*`, `/api/optimizer/run`, `/api/health-monitoring/*` (passthrough stubs). The doc explicitly calls these "delegated_to web /api/…" — the intent is that the gateway will eventually own these, but today they're acknowledgement endpoints only. **Confusing if both are live.** Pick one before launch.
- **Orphan services:** `apps/web/src/services/` still references an `AgentProxy` pointing at `localhost:8000`. The audit explicitly flags this in the prior LIFENAVIGATOR_PLATFORM_AUDIT.md — still not removed.
- **Technical debt:** `apps/graphrag-pipeline/` (Python serverless on Vercel) overlaps with `apps/ingestion-worker/` (Rust). Pick one or document the relationship.

---

## Section 14 — Frontend Integrity Audit

### Pages

8 new pages added across the iteration:

- `/onboarding/hub`, `/onboarding/converse`, `/onboarding/review`
- `/onboarding/sections/{financial, insurance, family-lifestyle, career, education, health}`
- `/dashboard/next-dollar-optimizer`, `/dashboard/life-trajectory`, `/dashboard/jobs`
- `/employer`, `/employer/jobs/[id]`

All pages compile cleanly (`tsc --noEmit` → 0 errors).

### Components

5 new components added:

- `UserGraphQuestionnaire.tsx` (6-substep wizard for vision/constraints/decision-prefs/commitment/risk/motivation)
- `ConversationalShell.tsx` (turn-by-turn chat with confidence indicator + confirmation card)
- `SectionShell.tsx` (reusable Save/Skip wrapper for the 6 section pages)
- 5 sub-section components under `components/onboarding/sections/`

All present, all imported from the right places.

### Navigation

- Onboarding hub at `/onboarding/hub` is the entrypoint; links to `converse`, `review`, and 6 section pages.
- The existing `/onboarding/questionnaire` and `/onboarding/interactive` flows are preserved alongside the hub.

### State management

React hooks + `react-query` where appropriate. No global store added.

### Forms

Zod-validated on the server; client-side validation is form-by-form.

### Chat onboarding

`ConversationalShell.tsx` works against the deterministic engine. **No LLM wired.** UI is functional and shippable as-is for the deterministic version.

### Dashboards

All prior dashboards intact. 3 new dashboard pages added.

### Broken routes / imports / placeholders / missing components

- **Broken imports:** zero (verified by `tsc --noEmit` returning 0 errors across the whole web app).
- **Placeholder components:** `coming-soon/ComingSoon.tsx` and `placeholders/ComingSoon.tsx` both still exist. Used by ~11 routes (per prior audit) — unchanged.
- **Missing components:** none surfaced this iteration.
- **UI regressions:** none observed. All 237 jest tests pass.

---

## Section 15 — Database Integrity Audit

### Migrations

14 new migrations (`060`–`073`), additive only, ~56 new tables + 1 view + ~10 helper RPCs. All use `IF NOT EXISTS` so re-applying is safe. Numbering gaps (056–059) are deliberate per the original migration pattern.

### Indexes

Every new user-data table has at least `idx_<table>_user`. Time-series tables additionally have `(user_id, <time_col> DESC)`. Partial indexes on nullable FKs (`goal_id`, `decision_id`, `recommendation_id`). The optimizer's `goal_optimizer_recommendations` has `(run_id, status)` for the accept lifecycle.

### Constraints

Every enum-style column has a `CHECK` constraint (verified by the RLS audit agent). Polymorphic outcome rows enforce `goal_id IS NOT NULL OR decision_id IS NOT NULL OR recommendation_id IS NOT NULL`. Marketplace comparisons enforce `version_a_id <> version_b_id`. Allocation percentages enforced `BETWEEN 0 AND 100`.

### Foreign keys

Every user-data table FKs back to `profiles(id) ON DELETE CASCADE`. Parent-child cascades: optimizer run → inputs/assumptions/allocations/tradeoffs/recommendations/outcomes (all CASCADE). Scenario → versions → outputs/metrics/decisions/assumptions/events (all CASCADE). All verified by the SQL validation scripts under `scripts/validation/`.

### RLS

See Section 11. **Zero gaps.**

### Encryption

`core.encrypt_with_app_key` SECURITY DEFINER (064). Plaid/OAuth token encryption from prior 011. Health notes encrypted as `notes_encrypted` on `health_meta.health_records` + `lab_panels` + `injuries`.

### Duplicate tables

None observed.

### Schema drift

None within additive migrations.

### Performance risks

- **Optimizer metrics table** (`life_scenario_metrics`) is sampled to ≤120 points per metric × 10 metric keys × N versions. Bounded.
- **Goal discovery turns** can accumulate per goal. Recommend a TTL or archival policy after 90 days.
- **Audit log** (`core.security_audit_log`) has no rotation policy. Will grow unbounded.

### Data integrity risks

- **Optimizer accept does not also write `user_recommendations`.** Two recommendation surfaces drift. Easy fix.
- **`is_health_enabled() = false`** means owner-context writes to health tables silently fail unless the routes catch the RLS error (they do, by collapsing to `feature_locked: true`).
- **`app.settings.encryption_key` provisioning** — must verify in target environments.

---

## Section 16 — Launch Readiness Audit

### CRITICAL (blocks launch)

1. **Provision `app.settings.encryption_key` in production Supabase.** Without it, every encrypted-column insert fails. Verify with `SELECT current_setting('app.settings.encryption_key', true)` post-deploy.
2. **Enforce email verification before dashboard access.** Carry-over from prior audit. One middleware change.
3. **Deploy the FastAPI gateway** (or explicitly delete it from the launch path). It exists, compiles, tests pass — but is not running anywhere. Either deploy it or scope launch to the web app + Plaid + Supabase only.
4. **Deploy the Rust ingestion worker** (or accept that personal-graph syncing won't happen at launch). Same as above.
5. **Add GraphRAG sync triggers for the 060–073 tables.** Without them, the worker never receives a goal-discovery turn, an optimizer run, or any new entity type. The infrastructure is there but the producers aren't wired.

### HIGH

1. Rate limiting on `/api/auth/*`, `/api/agent/chat`, `/api/optimizer/run`, `/api/employer/jobs/[id]/publish`. Upstash + middleware. ~2 hours.
2. Stripe stubbed — billing won't function. Either go free at launch or wire the existing `apps/web/src/app/api/integrations/stripe/{checkout,portal}/route.ts` to real Stripe.
3. Storage bucket creation: `supabase storage create-bucket insurance --public=false`.
4. The Rust worker's doctest failure — fix the module-level comment so `cargo test` (without `--tests --lib`) passes.
5. Remove or hide `/test-agent` from production.
6. Reconcile `/api/simulations/*`, `/api/optimizer/run`, `/api/health-monitoring/*` between the Next.js app and the FastAPI gateway. Pick one home before launch.
7. Decide between `apps/graphrag-pipeline/` (Python) and `apps/ingestion-worker/` (Rust) for the prod sync path.

### MEDIUM

1. Wire LLM into the discovery engine (`pickPromptText`, `inferRootGoal`).
2. Wire LLM into the optimizer (`inferTrueGoal`).
3. Add mid-session resume to `ConversationalShell.tsx`.
4. Add Plaid investment + liability sync routes (not just accounts/transactions).
5. Stripe webhook handler for marketplace billing.
6. Estate-section UI variant (the persona conversational works; the form does not).
7. Add `user_recommendations` write to the optimizer accept route.
8. Mid-session resume across hub sections (today each section is single-shot).
9. Cookie consent UI tied to `consent_records`.
10. Sentry on web + gateway + worker.
11. SOC2-style access reviews on `employer_users`.

### LOW

1. Monte Carlo wrapper on the trajectory projector.
2. Cross-domain Neo4j relationships in the worker (`SUPPORTS_GOAL`, `BLOCKS_GOAL`, etc.).
3. Central GraphRAG ingestion job (today the central collection is empty).
4. Outcome-attribution worker that observes net-worth deltas after optimizer-accept and writes to `user_outcomes`.
5. Mobile app feature work.
6. Audit log rotation policy.
7. Goal-discovery-turn TTL/archival.

---

## Section 17 — Architecture Drift Analysis

### Intended

```
Vercel (Next.js)
      ↓ Authorization: Bearer <Supabase JWT>
Fly.io FastAPI gateway
      ↓ verified JWT → user_id
Supabase Postgres (RLS)
      ↓ trigger
graphrag.sync_queue
      ↓ claim
Rust ingestion worker (Fly.io)
      ↓ embed
Gemini
      ↓ vectors                  ↓ graph
Qdrant (personal + central)       Neo4j (personal + central)
```

### Actual

| Layer                                                                                                          | Implemented?          | Drift                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js on Vercel                                                                                              | ✅                    | None                                                                                                                                                                                                                                                                              |
| FastAPI gateway                                                                                                | ✅ Code exists        | **Not deployed.** The frontend currently does NOT go through the FastAPI gateway — it hits Next.js API routes directly. Acceptable as a transitional state; document the migration plan.                                                                                          |
| Supabase Postgres + RLS                                                                                        | ✅                    | None                                                                                                                                                                                                                                                                              |
| `graphrag.sync_queue`                                                                                          | ✅                    | Triggers exist for goals, financial_account, risk_assessment, career_profile, education_record, course, job_application. **Missing triggers for the ~50 new tables in 060–073.** Acceptable short-term; sync them in a follow-up migration (e.g. `074_graphrag_v2_triggers.sql`). |
| Rust ingestion worker                                                                                          | ✅ Code exists        | **Not deployed.** Acceptable as a transitional state.                                                                                                                                                                                                                             |
| Gemini                                                                                                         | ✅ Integrated in code | Not exercised end-to-end yet.                                                                                                                                                                                                                                                     |
| Qdrant personal + central                                                                                      | ✅ Code paths         | **Central collection is empty.** Worker doesn't populate central; no central-knowledge ingestion job exists.                                                                                                                                                                      |
| Neo4j personal + central                                                                                       | ✅ Code paths         | Same — central DB is empty.                                                                                                                                                                                                                                                       |
| **Legacy Python `graphrag-pipeline`**                                                                          | ✅ Still in repo      | **Drift.** Same purpose as Rust worker. Pick one.                                                                                                                                                                                                                                 |
| **Web app talks directly to Gemini/Qdrant via Supabase Edge Functions** (`supabase/functions/graphrag-query/`) | ✅ Still exists       | **Drift.** This bypasses the FastAPI gateway. Acceptable if the gateway is deferred; document explicitly.                                                                                                                                                                         |

**Drift verdict:** the intended pipeline is implemented at the _code_ level. The deployed surface is closer to the prior architecture (web → Edge Function → Gemini/Qdrant/Neo4j) than the intended (web → FastAPI → Gemini/Qdrant/Neo4j). **Not catastrophic — this is what "scaffolded but not yet deployed" looks like — but the gap must be acknowledged in launch decisions.**

---

## Section 18 — Final Recommendation

### GO / GO WITH CONDITIONS / NO-GO

**GO WITH CONDITIONS** for a **scoped beta launch** of:

- Auth, onboarding (hub + questionnaire + interactive + converse + sections + review),
- Plaid account + transaction sync,
- Goal tracking + driver scoring,
- Dynamic Goal Optimizer (full vertical),
- Life Trajectory Simulator (deterministic, no Monte Carlo),
- Scenario Lab (unchanged),
- Career marketplace (with privacy contract intact; billing manual or free),
- Wearable monitoring (UI-side disabled until `is_health_enabled` flips).

**NO-GO** for marketing claims that depend on:

- Personalized GraphRAG (Rust worker not deployed; sync triggers for new tables not wired)
- Central GraphRAG (collection empty)
- Multi-agent AI (still single Gemini call via Edge Function; no orchestration in production)
- Arcana lead generation (consent + audit framework exists; outbound POST not wired)
- Stripe billing (stubbed)

### Top 20 remaining tasks, ranked

The ranking weights user impact (40%), security impact (30%), launch risk (20%), revenue impact (10%).

| #   | Task                                                                                                          | User | Security | Launch   | Revenue | Composite |
| --- | ------------------------------------------------------------------------------------------------------------- | ---- | -------- | -------- | ------- | --------- |
| 1   | Provision `app.settings.encryption_key` in prod Supabase                                                      | H    | H        | CRITICAL | –       | 100       |
| 2   | Enforce email verification in middleware before dashboard                                                     | H    | H        | CRITICAL | –       | 95        |
| 3   | Add GraphRAG sync triggers for new 060–073 tables (migration 074)                                             | H    | M        | HIGH     | –       | 85        |
| 4   | Deploy Rust ingestion worker on Fly.io                                                                        | H    | –        | HIGH     | –       | 75        |
| 5   | Deploy FastAPI gateway on Fly.io                                                                              | M    | M        | HIGH     | –       | 72        |
| 6   | Rate limiting on `/api/auth/*`, `/api/agent/chat`, `/api/employer/jobs/[id]/publish`                          | M    | H        | HIGH     | –       | 70        |
| 7   | Storage bucket: `supabase storage create-bucket insurance --public=false`                                     | H    | M        | HIGH     | –       | 68        |
| 8   | Wire Stripe (checkout + portal) or go free at launch — decide                                                 | M    | –        | HIGH     | H       | 65        |
| 9   | Fix Rust worker doctest regression                                                                            | –    | –        | M        | –       | 60        |
| 10  | Remove `/test-agent` from production build                                                                    | –    | M        | M        | –       | 58        |
| 11  | Pick one home for `/api/simulations/*`, `/api/optimizer/run`, `/api/health-monitoring/*` (Next.js vs FastAPI) | M    | –        | M        | –       | 55        |
| 12  | Decide between `apps/graphrag-pipeline/` (Python) and `apps/ingestion-worker/` (Rust)                         | M    | –        | M        | –       | 55        |
| 13  | Wire LLM into discovery engine (`pickPromptText`, `inferRootGoal`)                                            | H    | –        | –        | M       | 55        |
| 14  | Add mid-session resume to `ConversationalShell.tsx`                                                           | M    | –        | –        | –       | 45        |
| 15  | Add `user_recommendations` write to optimizer accept route (recommendation surface dedup)                     | M    | –        | –        | –       | 40        |
| 16  | Plaid investment + liability sync routes                                                                      | M    | –        | –        | M       | 40        |
| 17  | Cookie consent UI tied to `core.consent_records`                                                              | M    | M        | –        | –       | 40        |
| 18  | Sentry on web + gateway + worker                                                                              | –    | M        | M        | –       | 38        |
| 19  | Estate-section UI variant (form alternative to the converse persona)                                          | M    | –        | –        | –       | 35        |
| 20  | Remove or rewire legacy AgentProxy / `localhost:8000` references in frontend                                  | –    | M        | –        | –       | 30        |

**Items 1–8 are launch-blockers under the scoped beta plan.** Items 9–13 are highly recommended pre-launch. Items 14–20 can ship after.

---

## Appendix — Verification methodology

- **Code inspected** directly via Read + Bash (grep, find) without modification.
- **Tests run:**
  - Web app: `npx jest --no-coverage` → **237 passed, 0 failed, 18 suites**
  - Web app: `npx tsc --noEmit -p tsconfig.json` → **0 errors**
  - Rust worker: `cargo test --tests --lib --quiet` → **22 passed**
  - Rust worker: `cargo test --doc` → **1 failed** (regression flagged in §2)
  - Rust worker: `cargo build --release --bin ingestion-worker` → **clean**
  - FastAPI gateway: `pytest -q` → **29 passed**
- **RLS audit** delegated to a parallel agent walking each new migration file; 56 new tables verified, 0 gaps.
- **Regression audit** delegated to a parallel agent comparing prior functionality against the modified surface; 0 regressions.
- **Claims marked unverified**: liability + investment Plaid sync (no dedicated route observed; not confirmed broken).

**End of audit.**
