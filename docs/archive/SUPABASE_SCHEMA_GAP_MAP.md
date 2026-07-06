# SUPABASE SCHEMA GAP MAP (C)

**Date:** 2026-06-07 · **Status:** DESIGN ONLY · Live-inventoried against prod.

For each domain: **existing tables**, **missing tables**, **RLS**, **views**, **write/read paths**. The standard pattern (established by migrations 111 + 116) is the target for every domain:

> **Standard domain table pattern**
>
> - `user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`
> - RLS enabled; policies: `*_owner` SELECT `USING (user_id = auth.uid())`, `*_service` ALL to `service_role`, `zz_auth_owner_insert/update` (migration 116) `WITH CHECK (user_id = auth.uid())`.
> - `public.<schema>_<table>` view `WITH (security_invoker = true)` for PostgREST/client reads.
> - **Writes:** service-role via the Core API domain service only. **Reads:** RLS-scoped (authenticated) or Core API.
> - GraphRAG `enqueue_sync` trigger (only AFTER the worker `EntityType` variant exists — see `GRAPHRAG_ENTITY_PIPELINE_SPEC.md`).

---

## 1. Finance — ✅ COMPLETE (reference)

- **Existing:** `finance.financial_accounts, transactions, financial_goals, investment_holdings, assets, asset_loans, employer_benefits, retirement_plans, tax_profiles, plaid_items, account_connections, transactions_inbox`.
- **Missing:** none for beta.
- **RLS:** finance.\* RLS enabled (owner + service). **Views:** finance data served via service-role API route today (`/api/financial`); migrating to `GET /v1/finance/summary`. **Triggers:** ✅ on financial_accounts/transactions/financial_goals/investment_holdings.
- **Action:** none structural; move read orchestration to Core API.

## 2. Health & Wellness — 🟡 PARTIAL (biggest gap; see `HEALTH_WELLNESS_BACKEND_SPEC.md`)

- **Existing:** `health_meta.{health_metrics, health_records, basic_records, appointments, insurance_cards, insurance_documents, wearable_connections}`, `public.{habits, habit_completions}`.
- **Missing:** `health_meta.wellness_profile` (the domain root), `sleep_logs`, `exercise_logs`, `nutrition_logs`, `supplement_logs`. (`labs/vitals`, `wearable_metric` ingestion, Arcana deep integration are later phases.)
- **RLS:** health*meta.\* has RLS; confirm owner+service+invoker-view parity. **Views:** add `public.health*\*` security_invoker views. **Triggers:** ✅ on health_metrics/health_records; **add** for the new wellness tables (after enum variants).

## 3. Career — 🟡 consolidate

- **Existing:** `public.career_profiles, career_connections, job_applications`, `resumes`.
- **Missing:** `public.career_skills` (skills as first-class rows for gap analysis; currently embedded/derived).
- **RLS/Views:** confirm owner+service+invoker views. **Triggers:** ✅ career_profiles/career_connections/job_applications/resumes.

## 4. Education — 🟡 consolidate

- **Existing:** `public.education_records, courses, degree_analyses`.
- **Missing:** `public.study_logs` (study-session tracking; `/api/education/study-logs` route exists but verify backing table), `public.certifications` (verify vs derived).
- **RLS/Views:** standard. **Triggers:** ✅ education_records/courses.

## 5. Family — 🟡 thin

- **Existing:** `public.family_members, family_appointments`.
- **Missing:** `public.family_dependents_plan` (dependents/care planning), optional `family_documents`.
- **RLS/Views:** standard. **Triggers:** ✅ family_members; **add** family_appointments (after enum variant `FamilyAppointment`).

## 6. Goals — ✅ rich

- **Existing:** `public.goals, goal_milestones, goal_dependencies, goal_benefits, goal_reminders, goal_updates`, `finance.financial_goals`.
- **Missing:** none. **RLS/Views:** standard (chat-style). **Triggers:** ✅ goals (+enum Goal). Milestones/deps reach graph via Goal\* enum variants — audit which child tables have triggers.

## 7. Risk — ✅ COMPLETE (today)

- **Existing:** `public.risk_assessments, risk_category_scores, risk_recommendations`.
- **Missing:** none for beta. **RLS/Views:** standard. **Triggers:** ✅ risk_assessments (+enum RiskAssessment, fixed 2026-06-07). **Audit:** add triggers for risk_category_scores/risk_recommendations only if those need independent graph nodes (else fold into the assessment summary).

## 8. Calendar / Events — 🟡 integration

- **Existing:** `public.calendar_events, calendar_connections`.
- **Missing:** none structurally; needs connector sync (Google/Microsoft via `connectors.*`). **Triggers:** ✅ calendar_events (+enum CalendarEvent — VERIFY the variant exists; if not, add before relying on graph).

## 9. Roadmap — 🔴 DERIVED (no own store)

- **Existing:** none (intentional).
- **Design:** `GET /v1/roadmap` composes a timeline from `goals` + `goal_milestones` + `scenario_*` + `calendar_events` + `decision_outcomes`. No table, no trigger, no entity type. Pure Core API projection.

## 10. Decisions / Scenarios — 🟡 audit

- **Existing:** `public.scenario_labs, scenario_inputs, scenario_versions, scenario_sim_runs, scenario_reports, scenario_jobs, scenario_documents, scenario_extracted_fields, scenario_goal_snapshots, scenario_pins, scenario_audit_log`, `public.decision_outcomes, decision_outcome_events`.
- **Missing:** none structurally. **Triggers:** enum has `LifeScenario*` + `Decision*` variants; **audit** which scenario/decision tables actually enqueue and whether the emitted `entity_type` matches an enum variant (RiskAssessment-style mismatch risk is highest here given the breadth).

---

## Cross-cutting schema facts (from the security sprint)

- **Migration drift:** local migrations **105–110 are NOT applied to prod** (e.g. `public.persona_event` absent). 111–116 depend on none of them. Decide per `IMPLEMENTATION_SEQUENCE_TO_10_10.md` §J: apply selectively or formally retire.
- **RLS posture (post-116):** 41 user-scoped `public.*` views are `security_invoker` with owner read + owner write (`WITH CHECK user_id=auth.uid()`) + service ALL. New domain views MUST follow this exact pattern — do **not** create plain (security_definer) views over user tables (that was the cross-user leak).
- **20 "review" views** (RLS, no `user_id` — tenant/global config) remain unhardened; classify before extending.
- **`chat.*`** (conversations/messages) is the per-user content store, service-role writes, owner-read views — the template for any new per-user "log/history" table.

---

## Per-domain readiness summary

| Domain              | Tables        | Missing tables                                             | Triggers wired | Enum variant present             | Net status |
| ------------------- | ------------- | ---------------------------------------------------------- | -------------- | -------------------------------- | ---------- |
| Finance             | ✅            | —                                                          | ✅             | ✅                               | ready      |
| Goals               | ✅            | —                                                          | ✅             | ✅                               | ready      |
| Risk                | ✅            | —                                                          | ✅             | ✅ (fixed)                       | ready      |
| Career              | ✅            | career_skills                                              | ✅             | ✅                               | minor      |
| Education           | ✅            | study_logs?, certifications?                               | ✅             | ✅                               | minor      |
| Family              | ✅            | dependents_plan                                            | partial        | ✅ member / ? appointment        | minor      |
| Calendar            | ✅            | —                                                          | ✅             | VERIFY CalendarEvent             | audit      |
| Scenarios/Decisions | ✅            | —                                                          | partial        | LifeScenario*/Decision* — VERIFY | audit      |
| Health & Wellness   | partial       | wellness_profile, sleep/exercise/nutrition/supplement logs | partial        | Health\* present; add wellness   | **build**  |
| Roadmap             | n/a (derived) | —                                                          | n/a            | n/a                              | derived    |
