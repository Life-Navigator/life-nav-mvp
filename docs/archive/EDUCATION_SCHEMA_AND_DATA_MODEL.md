# EDUCATION — SCHEMA & DATA MODEL

Supabase `education` schema using the proven Finance/Health pattern (116-RLS, security_invoker
views, source provenance, confidence, no triggers until worker enums ship). Design only.

## Standard columns (every table)

`id uuid pk`, `user_id uuid not null` (+ `tenant_id uuid` on recommendations/reports),
`created_at`, `updated_at`. **Provenance on every catalog/outcome fact:** `source text`
(institution / IPEDS / College Scorecard / BLS), `source_as_of date`, `confidence numeric(4,3)`.
Personal tables: `user_id` owner. Catalog tables (schools/programs/outcomes) may be central
reference data — see note below.

## Tables

| Table                          | Purpose                                     | Key columns (beyond standard)                                                                                                                                                  |
| ------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `education_profiles`           | the user's education context                | existing_credentials, highest_level, learning_prefs                                                                                                                            |
| `education_goals`              | what they want                              | title, goal_type, target_role, target_date, status                                                                                                                             |
| `schools`                      | institutions (catalog)                      | name, type (public/private/online/trade), location, prestige_index                                                                                                             |
| `education_programs`           | a program at a school                       | school_id, name, level, major, modality, duration_months                                                                                                                       |
| `degree_options`               | degree variants of a program                | program_id, degree_type, credit_hours                                                                                                                                          |
| `certifications`               | certs/bootcamps                             | name, issuer, duration_weeks, exam_required                                                                                                                                    |
| `courses`                      | individual courses                          | program_id, title, credits                                                                                                                                                     |
| `tuition_costs`                | cost of a program                           | program_id, tuition, fees, period, currency                                                                                                                                    |
| `financial_aid_options`        | aid for a program                           | program_id, type, amount, eligibility                                                                                                                                          |
| `scholarships`                 | scholarships                                | program_id?, name, amount, criteria                                                                                                                                            |
| `education_cost_scenarios`     | computed cost scenarios                     | program_id, net_cost, opportunity_cost, debt_estimate, scenario                                                                                                                |
| `education_roi_models`         | computed ROI                                | program_id, income_lift, breakeven_months, risk_adjusted_roi, scenario                                                                                                         |
| `program_outcomes`             | outcomes (catalog)                          | program_id, graduation_rate, employment_rate, median_salary, source                                                                                                            |
| `accreditation_records`        | accreditation                               | school_id/program_id, body, status, source                                                                                                                                     |
| `licensing_requirements`       | licensure/bar                               | program_id, license, pass_rate, source                                                                                                                                         |
| `education_recommendations`    | **standard RECOMMENDATION_FRAMEWORK shape** | (id/user/tenant/title/type/priority/confidence/governance_verdict/status/evidence_json/assumptions_json/tradeoffs_json/source_tables/source_graph_nodes/derived_by/timestamps) |
| `education_comparison_reports` | a generated report                          | user_id, tenant_id, title, version, status, options_json, summary_json, pdf_url, generated_at                                                                                  |
| `report_sections`              | report section content                      | report_id, section_key, ord, content_json                                                                                                                                      |
| `report_charts`                | chart specs                                 | report_id, chart_key, spec_json                                                                                                                                                |

## RLS (uniform DO-loop, like migration 117/119)

Each table: `ENABLE` + `FORCE ROW LEVEL SECURITY`; owner-ALL policy `USING/WITH CHECK
(user_id = auth.uid())`; service_role-ALL policy; grants to `authenticated` + `service_role`;
**`GRANT USAGE ON SCHEMA education`** (the H1 lesson — usage was missed in 119) +
`security_invoker` views for user-facing tables (recommendations, comparison_reports).

## Catalog data note (schools/programs/outcomes/accreditation/licensing)

These are **reference data**, not personal. Two options, decided at E1:

1. **Central reference** (preferred): live in a central schema/collection (like Job-Market
   Intelligence), cited by value into the user's evidence — no per-user rows for IPEDS facts.
2. **Per-user snapshot**: copy the relevant rows under `user_id` when the user adds an option
   (simpler RLS, more storage).
   The recommendation/report tables are always **per-user** (owner-scoped).

## API exposure

Add `education` to PostgREST exposed schemas **including the existing list (graphrag must stay
present — the H1 incident)** + `GRANT USAGE`. Migration order: schema+RLS (no triggers) →
worker enums deploy → triggers migration → exposure migration.

## Provenance + confidence everywhere

No outcome/cost/comp fact without `source` + `source_as_of` + `confidence`. The comparison
engine refuses to score an option on a missing fact — it emits a missing-data prompt instead.
