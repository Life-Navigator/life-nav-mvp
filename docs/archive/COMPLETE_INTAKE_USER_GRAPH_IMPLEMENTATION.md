# Complete Intake & User Graph — Implementation Notes

This change builds out the rest of the LifeNavigator intake, user-graph,
and tracking foundation on top of the work landed in
`USER_GRAPH_ONBOARDING_IMPLEMENTATION.md`. It now covers financial, career,
education, health, insurance, family, and lifestyle, plus the user
actions/life-events plumbing required for the Decision Engine and the
Arcana Health lead pipeline.

Nothing in the prior flow is broken. The old `/onboarding/questionnaire`
linear wizard still works end-to-end. The new modular hub at
`/onboarding/hub` lets users skip sections and return to them later.

---

## What changed

### A. Migrations (`supabase/migrations/`)

Seven additive migrations, each idempotent (`IF NOT EXISTS` / `ADD COLUMN IF
NOT EXISTS`):

| #   | File                                 | Adds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------- | ------------------------------------------------------------------ |
| 061 | `061_user_graph_expansion.sql`       | `user_actions`, `user_life_events`; `domain TEXT` on every 060 user-graph table; expands `user_decision_preferences.axis` to include `minimize_downside`, `minimize_stress`, `minimize_cost`, `maximize_long_term_net_worth`, `maximize_healthspan`, `maximize_family_stability`.                                                                                                                                                                                                                                  |
| 062 | `062_financial_intake_expansion.sql` | `finance.user_financial_profile` (singleton: income, stability, employment type, spouse/household income, monthly expenses, emergency fund, credit score range, credit-card utilization, HSA/FSA, employer match, pension, tax bracket, current bank/brokerage), `finance.debts` (non-asset debts with APR, min payment, payoff strategy), `finance.financing_preferences` (liquidity, debt vs invest vs save weights). Adds missing columns on `finance.financial_accounts`, `employer_benefits`, `tax_profiles`. |
| 063 | `063_health_intake_expansion.sql`    | 9 new `health_meta` tables under the existing `is_health_enabled()` gate: `body_measurements`, `training_profile`, `injuries`, `mobility_limitations`, `daily_wellbeing`, `vitals_log`, `lab_panels`, `lab_results`, `medications`, `supplements`, `interventions` (TRT/peptides/NAD/NMN/NAC), `nutrition_profile`, `diet_log`.                                                                                                                                                                                    |
| 064 | `064_insurance_benefits.sql`         | `insurance_plans` (medical/dental/vision/disability/etc., encrypted `member_id`/`group_number`), `insurance_documents` (uploaded card/policy/summary + OCR status), `insurance_extracted_facts` (per-fact OCR output with bbox + confidence). Adds the `core.encrypt_with_app_key(plaintext TEXT) RETURNS TEXT` SECURITY DEFINER RPC granted to `authenticated, service_role`.                                                                                                                                     |
| 065 | `065_career_education_expansion.sql` | `career_profiles` gains `current_income`, `income_trajectory`, `promotion_target`, `target_income`, `time_for_upskilling_hours_per_week`, `job_change_willingness`, `entrepreneurial_interest`, `networking_capacity`, `relocation_willingness`, `skill_gaps[]`. New `education_intake` (tuition budget, GI Bill, VA, employer reimbursement, ROI preference, urgency) and `education_credentials` (certifications / licenses / target credentials).                                                               |
| 066 | `066_family_lifestyle.sql`           | `profiles` gains `marital_status`, `dependents_count`. New `family_lifestyle_profile` (elder care, caregiving hours, relocation, travel, household priorities) and `children_education_goals` (per-child target degree, 529 status, monthly contribution).                                                                                                                                                                                                                                                         |
| 067 | `067_onboarding_sections.sql`        | `user_onboarding_sections` — one row per `(user_id, section)` with status `not_started                                                                                                                                                                                                                                                                                                                                                                                                                             | in_progress | skipped | completed`and a`fields_captured JSONB` snapshot for hub rendering. |

All new tables follow the project's standard conventions:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`
- `source TEXT`, `confidence_score NUMERIC(3,2)`, `metadata JSONB DEFAULT '{}'`
- `created_at`, `updated_at` with `core.set_updated_at()` triggers
- `CHECK` constraints on every enum-style column
- `user_id` indexes everywhere; partial indexes on nullable FKs

### B. RLS

Every new table:

```sql
ENABLE ROW LEVEL SECURITY;
CREATE POLICY "<table>_owner_all" ON <table>
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "<table>_service_role" ON <table>
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

Health-meta tables additionally gate on `public.is_health_enabled()` to
preserve the existing feature flag behavior. Service-role bypass exists so
the GraphRAG sync worker, Arcana lead-package builder, and ingestion
pipeline can read/write while the feature is still locked for end users.

### C. Encryption

`insurance_plans.member_id_encrypted` and `group_number_encrypted` are
encrypted with pgcrypto AES256 via the new `core.encrypt_with_app_key()`
RPC. The function reads the key from `current_setting('app.settings.encryption_key', true)`
— the same source used by 011_mvp_integrations_auth. The API route never
sees the key; it just hands the plaintext to the database. Reads
deliberately exclude both encrypted columns.

### D. API routes (`apps/web/src/app/api/`)

Ten new routes, all built on `createServerSupabaseClient()` + Zod
validation, so RLS does the actual permission work:

| Path                                | Methods   | What it does                                                                                                                                                                                                   |
| ----------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/user-graph/actions`           | POST, GET | Insert up to 50 actions per call; list latest 100.                                                                                                                                                             |
| `/api/user-graph/life-events`       | POST, GET | Insert up to 50 life events; list 100 most recent (occurred/expected).                                                                                                                                         |
| `/api/onboarding/financial-profile` | PUT, GET  | Upsert the singleton `finance.user_financial_profile` and `finance.financing_preferences`.                                                                                                                     |
| `/api/onboarding/debts`             | POST, GET | Insert N debts (optional `replace_existing: true` to wipe prior onboarding-sourced rows).                                                                                                                      |
| `/api/onboarding/insurance`         | POST, GET | Create N insurance plans; `member_id` / `group_number` go through `core.encrypt_with_app_key` before storage; GET excludes encrypted columns.                                                                  |
| `/api/onboarding/family-lifestyle`  | PUT, GET  | Upsert `family_lifestyle_profile`; patches `profiles.marital_status` / `dependents_count`.                                                                                                                     |
| `/api/onboarding/education-intake`  | PUT, GET  | Upsert `education_intake` + bulk-insert `education_credentials`.                                                                                                                                               |
| `/api/onboarding/career-extended`   | PUT, GET  | Upsert the new columns on `career_profiles`.                                                                                                                                                                   |
| `/api/onboarding/health-intake`     | PUT       | Single payload for training profile + body measurements + daily wellbeing + injuries + nutrition profile. Returns per-section pass/fail so the UI can surface that health storage is currently feature-locked. |
| `/api/onboarding/sections`          | GET, PUT  | Hub status. GET materializes a complete 10-section checklist (`not_started` placeholders for missing rows). PUT upserts a section row, automatically stamps `completed_at` when status flips to `completed`.   |

### E. Onboarding UI

- **Hub:** `app/onboarding/hub/page.tsx` — lists all 10 sections with per-section status badges and an overall progress bar. Sections can be Started, Resumed, Reviewed, or Skipped from the hub at any time.
- **Reusable shell:** `components/onboarding/SectionShell.tsx` — header, back-to-hub link, Save / Skip controls, post-save navigation. Used by every section page.
- **Per-section components:** under `components/onboarding/sections/`:
  - `FinancialSection.tsx` — income, expenses, emergency fund, credit, HSA/FSA, employer match, financing preference sliders, debt list (add/edit/remove).
  - `InsuranceSection.tsx` — multi-plan UI with carrier, plan name, member-id/group-number (encrypted on save), premiums, deductible, OOP max, copays, coinsurance, HSA/FSA/HRA eligibility, primary-plan flag.
  - `FamilyLifestyleSection.tsx` — marital status, dependents, elder care, caregiving hours, relocation, travel, lifestyle goals, household-priority chips.
  - `CareerExtendedSection.tsx` — income trajectory, target income, upskilling time, job-change willingness, entrepreneurial interest, networking, relocation, skill-gap tags.
  - `EducationIntakeSection.tsx` — degree, current program, tuition budget, ROI preference, credential urgency, GI Bill / VA / employer tuition, desired schools, credentials list.
  - `app/onboarding/sections/health/page.tsx` — body measurements + training basics + sleep / energy / stress + nutrition targets. Shows a friendly amber banner when the health feature gate blocks the underlying write.
- **Routes:** `app/onboarding/sections/{financial,insurance,family-lifestyle,career,education,health}/page.tsx`.

The original `/onboarding/questionnaire` and `/onboarding/interactive`
wizards remain. The hub links to `/onboarding/questionnaire` for the
Core Life Vision / Risk / Commitment sections so we don't duplicate
the existing `UserGraphQuestionnaire` work.

### F. TypeScript types

Both database type files were extended:

- `apps/web/src/lib/supabase/types.ts` — full `Row/Insert/Update` shapes for `user_actions`, `user_life_events`, `insurance_plans`, `insurance_documents`, `insurance_extracted_facts`, `education_intake`, `education_credentials`, `family_lifestyle_profile`, `children_education_goals`, `user_onboarding_sections`. Plus typed exports (`InsurancePlanRow`, `UserActionRow`, etc.) and the `OnboardingSectionKey` union.
- `packages/supabase/src/database.types.ts` — same tables in the shorter shape this package uses.

A new `apps/web/src/types/intake.ts` holds the input-side types
(`FinancialProfileInput`, `DebtInput`, `InsurancePlanInput`,
`FamilyLifestyleInput`, `EducationIntakeInput`,
`EducationCredentialInput`, `CareerExtendedInput`,
`FamilyProfileFieldsInput`, `OnboardingSectionKey`,
`OnboardingSectionStatus`).

### G. Tests / validation

**SQL validation** — `scripts/validation/061_067_intake_rls.sql`:

- Seeds two synthetic users (`A`, `B`) in `auth.users` + `public.profiles`.
- Populates every new table for User A (financial profile, debts, financing prefs, training profile, body measurements, daily wellbeing, injuries, nutrition profile, insurance plan, career profile, education intake + credentials, family/lifestyle profile, children-education goals, expanded decision-preference axes, actions, life events).
- Switches role to User A and asserts they can read each table.
- Asserts cross-user `INSERT (..., user_id = user_b)` is blocked by the WITH CHECK.
- Switches to User B and asserts they see zero of User A's rows in every table.
- Verifies User B can write the minimum-required-field shape into each table (proves "skippable optional fields don't break completion").
- If `app.settings.encryption_key` is configured, round-trips `core.encrypt_with_app_key('test-member-id-12345')`. If not, prints a SKIP and continues.
- `ROLLBACK`s at the end — no test rows survive.

Run:

```bash
psql "$DATABASE_URL" -f scripts/validation/061_067_intake_rls.sql
```

Success looks like `NOTICE: ALL ASSERTIONS PASSED`. Any failure raises a
PostgreSQL exception and exits non-zero.

**Seed** — `scripts/validation/seed_intake_demo.sql`:

- Creates (or re-seeds) a single demo user `demo+intake@lifenavigator.local`.
- Populates every intake table with realistic, plausible values so the
  hub UI shows a full picture (multiple debts, two insurance plans, two
  children with 529 plans, etc.).
- Idempotent — running it twice cleans the prior intake first.
- Run with `psql -v ON_ERROR_STOP=1 -f scripts/validation/seed_intake_demo.sql`.

**Jest** — added `apps/web/src/app/api/onboarding/sections/__tests__/sections.test.ts`:

- GET returns a complete 10-section checklist even with zero rows.
- GET correctly merges existing rows over the defaults.
- PUT rejects unknown section names and unknown statuses.
- PUT upserts with `user_id`, `section`, `status`, `fields_captured`, and stamps `completed_at` when status flips to `completed`.

Existing `save-user-graph.test.ts` and `onboarding.test.tsx` still pass.
Full relevant suite: **13 passed, 0 failed** (`save-user-graph` 4,
`onboarding` 4, `sections` 5).

`tsc --noEmit -p tsconfig.json`: **clean**.
`eslint` over every new file: **clean**.

---

## How to deploy

1. **Run the migrations.**

   ```bash
   supabase db push
   ```

   The migrations apply in numeric order; 061 depends on 060.

2. **Validate RLS in your dev project.**

   ```bash
   psql "$DATABASE_URL" -f scripts/validation/061_067_intake_rls.sql
   ```

3. **Confirm the encryption key is set.** The insurance route requires
   `current_setting('app.settings.encryption_key')` to return a non-empty
   string. In dev:

   ```bash
   supabase secrets set INTEGRATION_ENCRYPTION_KEY=<your-64-char-hex>
   ```

   And ensure `ALTER DATABASE postgres SET app.settings.encryption_key = '<…>'`
   has been run (mirrors what 011_mvp_integrations_auth assumes).

4. **(Optional) Seed a demo user.**

   ```bash
   psql "$DATABASE_URL" -f scripts/validation/seed_intake_demo.sql
   ```

5. **Regenerate database types when convenient** — the manually maintained
   shapes are already accurate, so this is non-blocking:

   ```bash
   pnpm db:gen-types
   ```

6. **Smoke-test onboarding hub.**
   - Sign in as a fresh user (or the demo user).
   - Visit `/onboarding/hub`.
   - Open each section in turn; confirm Save → returns to hub → status flips
     to `completed`.
   - Skip a section; confirm the hub shows "Skipped" and you can still get
     to `/dashboard`.

---

## Decision-engine readiness

After this change the User Graph has the structured surface area the
Decision Engine needs:

| Concept               | Table                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Vision                | `user_life_vision` (060)                                                                                                      |
| Constraints           | `user_constraints` (060)                                                                                                      |
| Capabilities          | `user_capabilities` (060)                                                                                                     |
| Commitment            | `user_commitment_levels` (060)                                                                                                |
| Motivations           | `user_motivations` (060)                                                                                                      |
| Decision preferences  | `user_decision_preferences` (060+061)                                                                                         |
| Domain risk tolerance | `user_domain_risk_tolerance` (060)                                                                                            |
| Recommendations       | `user_recommendations` (060)                                                                                                  |
| Decisions             | `user_decisions` (060)                                                                                                        |
| Actions               | `user_actions` (061)                                                                                                          |
| Outcomes              | `user_outcomes` (060)                                                                                                         |
| Life events           | `user_life_events` (061)                                                                                                      |
| Financial state       | `finance.user_financial_profile`, `finance.debts`, `finance.financing_preferences`, plus the existing `finance.*` (062 + 031) |
| Health state (gated)  | every `health_meta.*` (063 + 038)                                                                                             |
| Insurance & benefits  | `insurance_plans`, `insurance_documents`, `insurance_extracted_facts` (064)                                                   |
| Career intake         | `career_profiles` extended (065)                                                                                              |
| Education intake      | `education_intake`, `education_credentials` (065)                                                                             |
| Family / lifestyle    | `family_lifestyle_profile`, `children_education_goals`, `profiles.marital_status`, `profiles.dependents_count` (066)          |
| Onboarding progress   | `user_onboarding_sections` (067)                                                                                              |

The Decision Engine worker can now read structured constraints,
preferences, commitment, and risk; write candidate `user_recommendations`;
observe accepts/rejects via `user_recommendations.status`; observe taken
work via `user_actions`; and attribute results via `user_outcomes`.

---

## Intentionally deferred

- **GraphRAG sync triggers** for the 11 new public-schema tables (and the
  `health_meta.*` set once the feature flips on). Mirror the pattern in
  `055_graphrag_expanded_triggers.sql` in a follow-up.
- **OCR worker** that reads `insurance_documents` with `ocr_status = 'pending'`
  and writes `insurance_extracted_facts`. The schema is ready; the worker is
  the next step.
- **Storage bucket creation.** The schema references the `insurance` bucket;
  create it out-of-band:
  `supabase storage create-bucket insurance --public=false`.
- **Health feature unlock.** `is_health_enabled()` still returns `false`.
  Flipping it to `true` immediately unlocks all 11 health tables for owner
  reads/writes. Until then the `/onboarding/sections/health` page surfaces
  a friendly "feature locked" banner but still records the user's intent in
  `user_onboarding_sections`.
- **Section editing from settings.** GET endpoints exist on every intake
  route, so a settings UI to edit captured data is a thin layer to build.

---

## File map (everything added or changed)

```
supabase/migrations/
  061_user_graph_expansion.sql                                            NEW
  062_financial_intake_expansion.sql                                       NEW
  063_health_intake_expansion.sql                                          NEW
  064_insurance_benefits.sql                                               NEW
  065_career_education_expansion.sql                                       NEW
  066_family_lifestyle.sql                                                 NEW
  067_onboarding_sections.sql                                              NEW

scripts/validation/
  061_067_intake_rls.sql                                                   NEW
  seed_intake_demo.sql                                                     NEW

apps/web/src/app/api/
  user-graph/actions/route.ts                                              NEW
  user-graph/life-events/route.ts                                          NEW
  onboarding/financial-profile/route.ts                                    NEW
  onboarding/debts/route.ts                                                NEW
  onboarding/insurance/route.ts                                            NEW
  onboarding/family-lifestyle/route.ts                                     NEW
  onboarding/education-intake/route.ts                                     NEW
  onboarding/career-extended/route.ts                                      NEW
  onboarding/health-intake/route.ts                                        NEW
  onboarding/sections/route.ts                                             NEW
  onboarding/sections/__tests__/sections.test.ts                           NEW

apps/web/src/app/onboarding/
  hub/page.tsx                                                             NEW
  sections/financial/page.tsx                                              NEW
  sections/insurance/page.tsx                                              NEW
  sections/family-lifestyle/page.tsx                                       NEW
  sections/career/page.tsx                                                 NEW
  sections/education/page.tsx                                              NEW
  sections/health/page.tsx                                                 NEW

apps/web/src/components/onboarding/
  SectionShell.tsx                                                         NEW
  sections/FinancialSection.tsx                                            NEW
  sections/InsuranceSection.tsx                                            NEW
  sections/FamilyLifestyleSection.tsx                                      NEW
  sections/CareerExtendedSection.tsx                                       NEW
  sections/EducationIntakeSection.tsx                                      NEW

apps/web/src/types/
  intake.ts                                                                NEW

apps/web/src/lib/supabase/types.ts                                         MODIFIED
packages/supabase/src/database.types.ts                                    MODIFIED
```
