# MIGRATION_BRANCH_AUDIT.md — Phase 5

**Method:** `git ls-tree -r <branch> -- supabase/migrations` compared against `main`. Read-only.
**Production DB:** Supabase `diwkyyahglnqmyledsey` — **confirmed** as production (Vercel prod `NEXT_PUBLIC_SUPABASE_URL` points here; Vercel production branch = `main`).
**Remote applied-state: VERIFIED 2026-06-21** via `supabase migration list --linked` + Management API schema query.

## ⚠️ VERIFIED REMOTE STATE — production has migration-history DRIFT

`supabase migration list` against prod reports as **applied**: `161`, `162`, `163` (plus the ≤149 lineage). Reported as **NOT applied**: `150–160`, **`164`, `165`, `166`, `167`**, and **all eleven** `20260610…–20260617…` timestamped migrations.

But a direct schema query proves the history is **wrong/drifted**:

- `chat.projects` + `public.chat_projects` **EXIST** → migration `164` objects are present despite history saying "not applied".
- `family.family_members` / `family.pets` / `family.guardianship` **EXIST** → the `20260613…` family migration objects are present despite "not applied".
- `field_conflicts` (`166`), `resume_items`/`resume_imports` (`167`), `document_field_provenance` (`165`) **DO NOT EXIST** → genuinely unapplied.

**Conclusion:** the production schema was built through a path other than these migration files (direct SQL / integration / differently-named migrations). The `supabase_migrations.schema_migrations` history does not reflect reality.

**Therefore `supabase db push` is UNSAFE as-is** — it would attempt to (re)apply ~20 "missing" migrations, many of whose objects already exist → `relation already exists` failures. Required approach: `migration repair --status applied` to reconcile the already-present versions, then apply **only the genuinely-missing** `165/166/167` (and confirm `164`'s remaining objects). Do this behind `--dry-run` first. **Not performed in this audit.**

## Migrations currently on `main` (16x + timestamped)

`160_advisor_turns` · `20260610…family_contacts_beneficiaries_advisors` · `20260611…life_rejected_goals` · `20260611…life_candidate_goals` · `20260611…fix_course_sync_topic` · `20260613…family_members_pets_guardianship` · `20260613…cleanup_archetype_risks` · `20260616120000_pilot_routing` · `20260616140000_discovery_intelligence` · `20260616160000_mcp_ingestion` · `20260617120000_integration_audit` · `20260617130000_pilot_feedback_metrics`

**⚠️ Main has `160` then jumps to the timestamped set — it is MISSING `161`, `162`, `163`, `164`.**

## Migrations NOT on main

| Migration                            | On branch               | On main? | Applied in prod?                                   | Dependency / ordering                         | Risk | Action                          |
| ------------------------------------ | ----------------------- | -------- | -------------------------------------------------- | --------------------------------------------- | ---- | ------------------------------- |
| `161_asset_media.sql`                | dashboard, onboarding   | NO       | Likely YES (prod runs the branch) — **unverified** | Asset CRUD; sorts before all `2026*`          | MED  | **PORT to main** with branch #1 |
| `162_career_education_expansion.sql` | dashboard, onboarding   | NO       | Likely YES — unverified                            | Career/Education tables                       | MED  | **PORT to main**                |
| `163_readiness_snapshots.sql`        | dashboard, onboarding   | NO       | Likely YES — unverified                            | Readiness snapshots (advisor PDF source)      | MED  | **PORT to main**                |
| `164_chat_command_center.sql`        | dashboard only          | NO       | **Unknown** (Command Center E2E unrun)             | Chat projects/threads                         | MED  | **PORT to main**                |
| `165_document_field_provenance.sql`  | **none (working tree)** | NO       | NO                                                 | Doc provenance; depends on `documents` schema | MED  | **COMMIT then port**            |
| `166_field_conflicts.sql`            | **none (working tree)** | NO       | NO                                                 | Field conflicts; pairs with `conflicts.py`    | MED  | **COMMIT then port**            |
| `167_resume_imports.sql`             | **none (working tree)** | NO       | NO                                                 | Resume imports; pairs with `resume.py`        | MED  | **COMMIT then port**            |

## ⚠️ Ordering landmine (filename-sort vs apply-order)

Supabase applies migrations in **filename sort order**. All numbered `161–167` sort **before** every `20260610…–20260617…` timestamped migration. But `main` already has the timestamped set applied in prod (Jun 10–17), while `161–164` were authored on the feature branch and never landed.

Consequence: when `161–167` are merged to main and `supabase db push` runs, the CLI will detect them as **missing earlier-sorting versions** and apply them **out of order relative to already-applied later migrations**. Supabase will warn (`found local migration … older than remote`). This is benign **only if** `161–167` have no dependency on objects created by the `2026*` migrations.

- `161/162/163` (asset, career/education, readiness) — independent schemas; low coupling. Likely safe.
- `164` (chat command center) — independent. Likely safe.
- `165/166/167` (doc provenance / conflicts / resume) — depend on the `documents` schema, not on the `2026*` set. Likely safe.

**Required before any apply:** run `supabase db push --dry-run` (or `migration list`) once a token is available, confirm no `161–167` object depends on a `2026*` table, and decide whether to **renumber `161–167` to sort after `20260617130000`** to eliminate the out-of-order warning.

## Rules honored

- No migration applied from any branch in this audit.
- No migration may be applied from an old branch without first being ported to `main`. The 4 committed (161–164) live only on branch #1; the 3 uncommitted (165–167) live only in the working tree.
  </content>
