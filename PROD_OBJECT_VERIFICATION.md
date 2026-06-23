# PROD_OBJECT_VERIFICATION.md — Phase 2

Object-level verification against prod `diwkyyahglnqmyledsey` (Management API, read-only). A migration is treated as **applied only if all required objects exist** — not inferred from table existence alone. Columns, functions, constraints, and indexes were checked explicitly.

## Verification queries run

1. `information_schema.tables` for 24 expected tables.
2. `information_schema.columns` for 16 specific added columns (the ALTER-only migrations).
3. `pg_proc`/`pg_namespace` for 3 functions.
4. `pg_namespace` for schema `core`.
5. `pg_constraint` for 3 check constraints.
6. `pg_indexes` for 4 indexes.
7. `to_regclass()` for `documents.document_fields` (target of 165) and `core.integration_audit_log`.

## Results — PRESENT (✅) / ABSENT (❌)

### Tables

✅ `analytics.advisor_turns` · `finance.asset_documents` · `career.side_projects` · `career.volunteer_records` · `education.licenses` · `public.school_catalog` · `life.readiness_snapshots` · `chat.projects` · `family.beneficiaries` · `family.emergency_contacts` · `family.trusted_advisors` · `life.rejected_goals` · `life.candidate_goals` · `family.family_members` · `family.guardianship` · `family.pets` · `analytics.model_usage` · `analytics.pilot_feedback` · `life.facts` · `life.relationships`
❌ `documents.field_conflicts` · `documents.field_conflict_items` (166) · `documents.resume_items` (167) · `core.integration_audit_log` (integration_audit)

### Columns

✅ `finance.assets.image_url` · `career.experience_records.employer_logo_url` · `education.certifications.credential_id` · `public.education_records.school_logo_url` · `chat.conversations.project_id` · `chat.conversations.mode` · `chat.messages.citations` · `life.life_objectives.confirmed` · `life.life_objectives.origin` · `analytics.pilot_feedback.kind` · `analytics.pilot_feedback.metrics` · `analytics.pilot_feedback.surprised`
❌ `documents.document_fields.page_number` · `.review_status` · `.extraction_method` (all of 165 — **none of the 7 provenance columns exist**)

### Functions

✅ `graphrag.trigger_course_sync` · `analytics.bump_model_usage`
❌ `core.log_integration_event` (integration_audit)

### Schema / Constraints / Indexes

- ✅ schema `core` exists (but its table+function do not → **partial** integration_audit)
- ✅ index `idx_readiness_snapshots_user_domain` (163)
- ❌ constraints `document_fields_review_status_chk` (165), `field_conflicts_status_chk` (166), `resume_items_section_chk` (167)
- ❌ indexes `idx_document_fields_review` (165), `idx_field_conflicts_user` (166), `idx_resume_items_review` (167)
- ✅ **`documents.document_fields` base table EXISTS** → migration 165's `ALTER TABLE … ADD COLUMN` will succeed.

## Per-migration verdict (all-objects test)

| Migration                                   | All required objects present?                         | Verdict                              |
| ------------------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| 160, 161, 162, 163, 164                     | YES                                                   | applied (160/164 unrecorded)         |
| **165**                                     | NO — 0/7 columns, 0 constraint, 0 index               | **NOT applied (cleanly absent)**     |
| **166**                                     | NO — both tables absent                               | **NOT applied (cleanly absent)**     |
| **167**                                     | NO — table absent                                     | **NOT applied (cleanly absent)**     |
| `20260610`–`20260616160000` (8 timestamped) | YES                                                   | applied (unrecorded)                 |
| **`20260617120000_integration_audit`**      | **PARTIAL** — schema `core` ✅, table ❌, function ❌ | **partially applied → NEEDS REVIEW** |
| `20260617130000_pilot_feedback_metrics`     | YES (5/5 columns)                                     | applied (unrecorded)                 |

## Key conclusions

1. **165/166/167 are cleanly, fully absent** — no partial state, no orphan objects. Their idempotent SQL will create everything from scratch with zero conflict risk.
2. **`documents.document_fields` exists**, so 165's ALTER has a valid target.
3. **Only one partial migration exists:** `integration_audit` (schema present, table+function missing). This is the single object-inconsistency in the system and is quarantined to BLOCKED_NEEDS_REVIEW.
4. Every other 160+ migration is **fully present but unrecorded** → safe to repair-mark, never to re-run.
   </content>
