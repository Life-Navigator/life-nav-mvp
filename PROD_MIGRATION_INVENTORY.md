# PROD_MIGRATION_INVENTORY.md — Phase 1

**Audit date:** 2026-06-21 · **Prod DB:** Supabase `diwkyyahglnqmyledsey` (confirmed via Vercel prod env) · **Method:** `supabase migration list --linked` + Supabase Management API schema queries (read-only). **No mutations.**

## Ground truth

- **Migration history (`supabase_migrations.schema_migrations`) for versions ≥150 contains exactly: `161`, `162`, `163`.** Nothing else from 150 onward is recorded.
- **`db push --dry-run` reports it would insert migrations starting at `105`** ("found local migration files to be inserted before the last migration on remote") — i.e. the recorded baseline is effectively 163 with a huge unrecorded gap behind it.
- Schema inspection proves most of those "missing" migrations' **objects already exist** in prod → history is drifted, not the schema.

## Inventory — every local migration 160+

| Migration                                | Expected key objects                                                                                                           | In history? | Objects in prod? | Action                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------- | ---------------- | -------------------------------- |
| `160_advisor_turns`                      | `analytics.advisor_turns` + idx + policy                                                                                       | NO          | **YES**          | ALREADY_APPLIED_REPAIR_HISTORY   |
| `161_asset_media`                        | `finance.asset_documents`, `finance.assets.image_url`                                                                          | **YES**     | YES              | DO_NOT_TOUCH (consistent)        |
| `162_career_education_expansion`         | `career.side_projects/volunteer_records`, `education.licenses`, `public.school_catalog` + cols                                 | **YES**     | YES              | DO_NOT_TOUCH                     |
| `163_readiness_snapshots`                | `life.readiness_snapshots` + idx                                                                                               | **YES**     | YES              | DO_NOT_TOUCH                     |
| `164_chat_command_center`                | `chat.projects`, `chat.conversations.{project_id,mode}`, `chat.messages.citations`                                             | NO          | **YES**          | ALREADY_APPLIED_REPAIR_HISTORY   |
| **`165_document_field_provenance`**      | `documents.document_fields.{page_number,section,char_start,char_end,extraction_method,extracted_at,review_status}` + chk + idx | NO          | **NO**           | **APPLY_NOW**                    |
| **`166_field_conflicts`**                | `documents.field_conflicts`, `documents.field_conflict_items` + idx + RLS                                                      | NO          | **NO**           | **APPLY_NOW**                    |
| **`167_resume_imports`**                 | `documents.resume_items` + idx + RLS                                                                                           | NO          | **NO**           | **APPLY_NOW**                    |
| `20260610…family_contacts…`              | `family.beneficiaries/emergency_contacts/trusted_advisors`                                                                     | NO          | **YES**          | ALREADY_APPLIED_REPAIR_HISTORY   |
| `20260611010000_life_rejected_goals`     | `life.rejected_goals`                                                                                                          | NO          | **YES**          | ALREADY_APPLIED_REPAIR_HISTORY   |
| `20260611020000_life_candidate_goals`    | `life.candidate_goals`                                                                                                         | NO          | **YES**          | ALREADY_APPLIED_REPAIR_HISTORY   |
| `20260611030000_fix_course_sync_topic`   | `graphrag.trigger_course_sync()` (CREATE OR REPLACE)                                                                           | NO          | **YES**          | ALREADY_APPLIED_REPAIR_HISTORY   |
| `20260613000000_family_members…`         | `family.family_members/guardianship/pets`                                                                                      | NO          | **YES**          | ALREADY_APPLIED_REPAIR_HISTORY   |
| `20260613010000_cleanup_archetype_risks` | data cleanup (no new objects)                                                                                                  | NO          | n/a (data op)    | REPAIR_HISTORY (see risk review) |
| `20260616120000_pilot_routing`           | `analytics.model_usage/pilot_feedback`, `analytics.bump_model_usage()`                                                         | NO          | **YES**          | ALREADY_APPLIED_REPAIR_HISTORY   |
| `20260616140000_discovery_intelligence`  | `life.life_objectives.{confirmed,origin}`                                                                                      | NO          | **YES**          | ALREADY_APPLIED_REPAIR_HISTORY   |
| `20260616160000_mcp_ingestion`           | `life.facts`, `life.relationships` + uq idx                                                                                    | NO          | **YES**          | ALREADY_APPLIED_REPAIR_HISTORY   |
| `20260617120000_integration_audit`       | `core` schema ✅ but `core.integration_audit_log` ❌, `core.log_integration_event()` ❌                                        | NO          | **PARTIAL/NO**   | **BLOCKED_NEEDS_REVIEW**         |
| `20260617130000_pilot_feedback_metrics`  | `analytics.pilot_feedback.{kind,metrics,context,insight_detected,surprised}`                                                   | NO          | **YES**          | ALREADY_APPLIED_REPAIR_HISTORY   |

## Band below 160 (also unrecorded — affects `db push` safety)

`db push --dry-run` lists `105–110, 117–160` as "to be inserted before remote" (objects exist in prod; includes `149/150/158` force-RLS and `159` deprecate-orphaned — **non-idempotent/destructive if re-run**). These are out of mission scope to apply, but they prove **`db push` must not be used** (see DRY_RUN report). They are REPAIR_HISTORY candidates for the follow-up hygiene sprint.

## Action tally

- **APPLY_NOW:** 165, 166, 167 (the doc-intelligence/provenance/conflict/resume features).
- **BLOCKED_NEEDS_REVIEW:** `20260617120000_integration_audit` (genuinely missing; OAuth-audit, not required for this launch).
- **ALREADY_APPLIED_REPAIR_HISTORY:** 160, 164 + all 8 verified timestamped migrations (+ 105–160 band as follow-up).
- **DO_NOT_TOUCH:** 161, 162, 163 (already consistent).
  </content>
