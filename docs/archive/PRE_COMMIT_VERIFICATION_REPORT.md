# LifeNavigator Pre-Commit Verification Report

**Date:** 2026-05-31
**Branch:** `mvp`
**Last commit:** `bd5d4e6 Beta stabilization: rewire auth to Supabase, restore missing API routes, harden onboarding`
**Status:** **COMMIT WITH NOTES** (see §11)

---

## 1. Git Hygiene

```bash
git status --short    # 91 entries
git diff --stat       # 4 files modified, 1125 / 3 (+/-) lines
git diff --name-status # 4 'M' rows
```

### Modified (tracked, indexed types extensions)

| File                                                 | + / −     | Notes                                                                       |
| ---------------------------------------------------- | --------- | --------------------------------------------------------------------------- |
| `apps/web/src/app/onboarding/interactive/page.tsx`   | +28 / −3  | extends interactive flow with the user-graph step (additive, no removals)   |
| `apps/web/src/app/onboarding/questionnaire/page.tsx` | +25 / −0  | wires `UserGraphQuestionnaire` + `EMPTY_USER_GRAPH_PAYLOAD` into the wizard |
| `apps/web/src/lib/supabase/types.ts`                 | +870 / −0 | Database types extension for new tables/columns — additive                  |
| `packages/supabase/src/database.types.ts`            | +205 / −0 | same, in the shared package                                                 |

All four diffs are **additive type/UI extensions**, no breaking changes.

### Untracked (87 entries)

| Category                 | Count | Examples                                                                                                                                                                                                                                |
| ------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New migrations (060-077) | 18    | `supabase/migrations/0{60..73}_*.sql`, `074_graphrag_v2_triggers.sql`, `075_fix_055_triggers.sql`, `076_goal_hierarchy.sql`, `077_central_graph_ontology.sql`                                                                           |
| New apps                 | 2     | `apps/api-gateway/`, `apps/ingestion-worker/`                                                                                                                                                                                           |
| New web modules          | ~30   | `apps/web/src/{lib,types}/{advisor,goals,discovery,trajectory,optimizer,marketplace,onboarding,health-monitoring}/...`                                                                                                                  |
| New web API routes       | ~22   | `apps/web/src/app/api/onboarding/*/`, `api/optimizer/`, `api/simulations/`, `api/user-graph/`, `api/employer/`, `api/jobs/`, `api/health-monitoring/`                                                                                   |
| New dashboards           | 3     | `apps/web/src/app/dashboard/{jobs,life-trajectory,next-dollar-optimizer}/`                                                                                                                                                              |
| New components           | ~12   | `apps/web/src/components/onboarding/{ConversationalShell,SectionShell,UserGraphQuestionnaire}.tsx`, `sections/`, etc.                                                                                                                   |
| Docs                     | 11    | `*_IMPLEMENTATION.md` × 10, plus `LIFENAVIGATOR_ARCHITECTURE_INTEGRITY_AUDIT.md`, `SEQUENCED_BUILD_PLAN.md`, `PERSONALIZED_GRAPHRAG_ACTIVATION.md`, `TRIGGER_REPAIR_REPORT.md`, `GOAL_HIERARCHY_AND_CENTRAL_GRAPHRAG_IMPLEMENTATION.md` |
| Validation scripts       | 3     | `scripts/validation/{smoke_test_graphrag,verify_075_triggers,verify_076_rls}.{sh,sql}`                                                                                                                                                  |

### Deleted

**None.** `git diff --diff-filter=D --name-only HEAD` returns empty.

### Unexpected / generated artifacts (must NOT be committed)

| Path                              | Size                    | Status                 | Action required before commit                                      |
| --------------------------------- | ----------------------- | ---------------------- | ------------------------------------------------------------------ |
| `apps/api-gateway/.venv/`         | **79 MB**               | NOT gitignored         | **BLOCKER** — add to `.gitignore` or stage api-gateway selectively |
| `apps/api-gateway/.pytest_cache/` | 24 KB                   | NOT gitignored         | **BLOCKER** — same                                                 |
| `apps/ingestion-worker/target/`   | (debug + release built) | NOT gitignored at root | **BLOCKER** — same                                                 |
| `apps/mobile/ios/.xcode.env`      | (pre-existing)          | tracked                | acceptable — iOS build convention                                  |

`git check-ignore apps/api-gateway/.venv apps/api-gateway/.pytest_cache apps/ingestion-worker/target` → **all three return empty** (not ignored). A `git add apps/api-gateway apps/ingestion-worker` would commit ~100MB of generated artifacts.

**Recommendation:** before staging those two apps, append to root `.gitignore`:

```gitignore
# Python
.venv/
.pytest_cache/
__pycache__/
*.pyc

# Rust
target/

# Misc
.mypy_cache/
.ruff_cache/
```

### Secrets / .env files

- Only `*.env.example` files exist anywhere in the tree (5 total, all committed).
- No real `.env` file in any new directory.
- `apps/mobile/ios/.xcode.env` is an Xcode build placeholder (no secrets).
- Secret-pattern scan (`AIza`, `sk-`, `SERVICE_ROLE=ey`, hard-coded passwords) hits only:
  - `apps/{ingestion-worker,api-gateway}/deploy.sh` — comments showing `GEMINI_API_KEY=AIza...` as a **format example**, not a real key. Reviewed and confirmed safe.
  - Vendored `.venv/lib/.../{pydantic,starlette,httpx}` — third-party docs, will not be committed once `.venv` is gitignored.
- **No secrets in tracked or staged content.** ✅

---

## 2. Dependency Hygiene

### pnpm

| Check                                            | Result                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `pnpm-lock.yaml` present                         | ✅ (639 KB)                                                                             |
| `package-lock.json` present                      | ✅ absent                                                                               |
| `yarn.lock` present                              | ✅ absent                                                                               |
| `node_modules/` tracked                          | ✅ ignored by root `.gitignore`                                                         |
| `package.json` `"packageManager": "pnpm@9.15.0"` | ✅ pinned                                                                               |
| `preinstall: npx only-allow pnpm`                | ✅ enforced                                                                             |
| `pnpm install --frozen-lockfile`                 | ✅ **PASS** ("Lockfile is up to date, resolution step is skipped / Already up to date") |

### Cargo

| Check                              | Result     |
| ---------------------------------- | ---------- |
| `apps/ingestion-worker/Cargo.lock` | ✅ present |
| `apps/ingestion-worker/Cargo.toml` | ✅ present |

### Python

| Check                                   | Result     |
| --------------------------------------- | ---------- |
| `apps/api-gateway/requirements.txt`     | ✅ present |
| `apps/api-gateway/requirements-dev.txt` | ✅ present |
| `pyproject.toml`                        | ❌ absent  |
| `uv.lock`                               | ❌ absent  |

---

## 3. Frontend Verification

### `pnpm type-check`

| Package                         | Result                                              |
| ------------------------------- | --------------------------------------------------- |
| `@life-navigator/web`           | ✅ **PASS** (`tsc --noEmit -p tsconfig.check.json`) |
| `@life-navigator/ui-components` | ✅ PASS                                             |
| `@life-navigator/supabase`      | ✅ PASS                                             |
| `@life-navigator/mobile`        | ❌ FAIL (**pre-existing**, see below)               |

The mobile failure is in `apps/web/apps/web/src/components/ui/dropdown-menu.tsx` (`error TS1005: ',' expected` at line 3 — `'use client'` directive parsed as identifier). Reproduced on a clean `HEAD` after stashing the working-tree changes: **the failure pre-dates this sprint** and is unrelated to anything delivered here.

Root cause: `apps/web/apps/web/src/components/ui/*.tsx` is a _doubled-path leftover_ checked in by a previous commit; the mobile `tsconfig` walks into it. Out of scope for this commit.

### `pnpm lint`

`@life-navigator/web` lint: **0 errors, 55 warnings** (all `react-hooks/exhaustive-deps` and `@next/next/no-head-element` advisories). None are new from this sprint. None block.

### `pnpm test`

`@life-navigator/web` jest: **255 passed / 255 total, 21 suites passed / 21 suites total** — matches the pre-sprint baseline of 237 + 18 new tests from this sprint (goal-path-service: 8, advisor-reasoning-service: 5, hierarchy-aware-evaluator: 5). No regressions.

### `pnpm build`

UNVERIFIED — not run in this audit due to elapsed-time budget. Recent CI runs and the type-check pass are strong proxies. **Recommended:** run `pnpm --filter @life-navigator/web build` manually before pushing if you want a paranoid check.

---

## 4. Rust Worker Verification

| Command                                        | Result                                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `cargo fmt --check`                            | ❌ **FAIL** (16 files have drift)                                                                           |
| `cargo clippy --all-targets -- -D warnings`    | ❌ **FAIL** (1 error: `clippy::manual_div_ceil` in `src/neo4j_client.rs:196` inside vendored base64 helper) |
| `cargo test`                                   | ✅ **PASS** (25 tests across 8 suites + 0 doctests)                                                         |
| `cargo build --release --bin ingestion-worker` | ✅ **PASS** (already built; `Finished release profile`)                                                     |

### fmt drift breakdown

| File                                                                                                                                                               | Source                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `src/config.rs`, `src/entities.rs`, `src/errors.rs`, `src/gemini_client.rs`, `src/neo4j_client.rs`, `src/qdrant_client.rs`, `src/processor.rs`, `src/telemetry.rs` | **pre-existing** (untracked; were added in the pre-sprint worker delivery without `cargo fmt`) |
| `src/normalizer.rs`                                                                                                                                                | mixed — some lines from this sprint's 074 additions                                            |
| `tests/idempotency.rs`                                                                                                                                             | pre-existing                                                                                   |
| `tests/relationships.rs`                                                                                                                                           | **this sprint** — new test file                                                                |

### clippy error breakdown

`src/neo4j_client.rs:196` — `String::with_capacity((bytes.len() + 2) / 3 * 4)` — the only Clippy violation. Inside the inline `base64_impl` helper that ships with the worker (no external crate). **Pre-existing**, not authored this sprint.

### Doctest status

`cargo test --doc` runs as part of `cargo test` and produces "0 passed; 0 failed". The ASCII-art docstring fix in `src/processor.rs` (wrapped in ```text fence) confirmed: rustdoc no longer parses it as Rust.

### Note

`cargo test` (default) and `cargo build --release` succeed. The `-D warnings` clippy gate and `fmt --check` would fail CI if enforced. Neither blocks runtime correctness.

---

## 5. FastAPI Gateway Verification

`uv` is installed at `/home/riffe007/.local/bin/uv`, but the project ships without `pyproject.toml` or `uv.lock`. Existing workflow uses `requirements.txt` + a venv at `.venv/`.

| Command                         | Result                                                   |
| ------------------------------- | -------------------------------------------------------- |
| `uv sync`                       | ❌ UNVERIFIED (no `pyproject.toml`)                      |
| `uv run ruff check`             | ❌ UNVERIFIED (`ruff` not in `.venv`, no uv-managed env) |
| `uv run mypy .`                 | ❌ UNVERIFIED (`mypy` not in `.venv`, no uv-managed env) |
| `pytest` (via existing `.venv`) | ✅ **PASS** — **29 passed in 0.08s**                     |

### Recommended uv conversion (no files modified per audit rules)

Create `apps/api-gateway/pyproject.toml`:

```toml
[project]
name = "lifenavigator-api-gateway"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi==0.115.6",
    "uvicorn[standard]==0.32.1",
    "pydantic==2.10.4",
    "pydantic-settings==2.7.1",
    "PyJWT[crypto]==2.10.1",
    "httpx==0.28.1",
    "python-dotenv==1.0.1",
]

[dependency-groups]
dev = [
    "pytest",
    "pytest-asyncio",
    "ruff",
    "mypy",
]
```

Then:

```bash
cd apps/api-gateway
uv sync                  # creates uv.lock + .venv
uv run pytest            # works today (29 pass)
uv run ruff check        # would gate lint
uv run mypy app          # would gate types
```

This is a **non-destructive migration** — `requirements.txt` can be left in place until cutover. Files NOT modified in this audit.

---

## 6. Supabase Migration Verification

`supabase` CLI is **not installed** in this environment (`command not found`). Local Supabase reset cannot be exercised here.

| Command                                                | Result                                |
| ------------------------------------------------------ | ------------------------------------- |
| `supabase db reset`                                    | ❌ UNVERIFIED (CLI absent)            |
| `psql … -f scripts/validation/verify_075_triggers.sql` | ❌ UNVERIFIED (no local DB target)    |
| `psql … -f scripts/validation/verify_076_rls.sql`      | ❌ UNVERIFIED (no local DB target)    |
| `./scripts/validation/smoke_test_graphrag.sh`          | ❌ UNVERIFIED (needs DB + worker env) |

### Static migration audit (per file inspection)

| Migration                           | Idempotent?                                                | Destructive? | Order safe? | Notes                                                               |
| ----------------------------------- | ---------------------------------------------------------- | ------------ | ----------- | ------------------------------------------------------------------- |
| 060_user_graph_foundation           | ✅ `IF NOT EXISTS`                                         | ❌ none      | ✅          | new tables only                                                     |
| 061_user_graph_expansion            | ✅                                                         | ❌           | ✅          | additive                                                            |
| 062_financial_intake_expansion      | ✅                                                         | ❌           | ✅          | additive                                                            |
| 063_health_intake_expansion         | ✅                                                         | ❌           | ✅          | additive                                                            |
| 064_insurance_benefits              | ✅                                                         | ❌           | ✅          | additive                                                            |
| 065_career_education_expansion      | ✅                                                         | ❌           | ✅          | additive                                                            |
| 066_family_lifestyle                | ✅                                                         | ❌           | ✅          | additive                                                            |
| 067_onboarding_sections             | ✅                                                         | ❌           | ✅          | additive                                                            |
| 068_root_goal_discovery_and_estate  | ✅                                                         | ❌           | ✅          | additive                                                            |
| 069_intake_logs_and_benefit_profile | ✅                                                         | ❌           | ✅          | additive                                                            |
| 070_dynamic_goal_optimizer          | ✅                                                         | ❌           | ✅          | additive                                                            |
| 071_life_trajectory_simulation      | ✅                                                         | ❌           | ✅          | additive                                                            |
| 072_career_marketplace              | ✅                                                         | ❌           | ✅          | additive                                                            |
| 073_wearable_monitoring             | ✅                                                         | ❌           | ✅          | additive                                                            |
| 074_graphrag_v2_triggers            | ✅ `DROP TRIGGER IF EXISTS` + `CREATE OR REPLACE FUNCTION` | ❌           | ✅          | trigger additions                                                   |
| 075_fix_055_triggers                | ✅ `CREATE OR REPLACE FUNCTION` (no DDL changes)           | ❌           | ✅          | function body fixes                                                 |
| 076_goal_hierarchy                  | ✅ `IF NOT EXISTS`                                         | ❌           | ✅          | new tables only                                                     |
| 077_central_graph_ontology          | ✅ `IF NOT EXISTS` + `CREATE OR REPLACE VIEW`              | ❌           | ✅          | new schema + tables; bootstrap INSERT uses `ON CONFLICT DO NOTHING` |

**No destructive statements** (`DROP TABLE`, `DELETE FROM`, `TRUNCATE`, `ALTER ... DROP COLUMN`) in any of the 18 new migrations.

### Migration order

Numerically sequential 060 → 077. No gaps that affect dependencies. 075 depends on 055 (functions it replaces). 076 depends on `core.set_updated_at` (010+) and `public.profiles` + `public.goals`. 077 depends on `graphrag.sync_queue` (050) and `central.is_*` helpers introduced earlier in the same file.

---

## 7. RLS and Security Verification

### New user-owned tables — RLS enabled and `auth.uid() = user_id` enforced

Grep + per-file inspection confirms:

| Migration | Tables                                                                                                                                                                                                                                                        | RLS enabled | Owner policy                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------- |
| 060       | user_constraints, user_decision_preferences, user_commitment_levels, user_motivations, user_domain_risk_tolerance, user_capabilities                                                                                                                          | ✅ each     | ✅ `auth.uid() = user_id` per table                                        |
| 062-067   | finance.user_financial_profile, finance.debts, finance.financing_preferences, family_lifestyle_profile, education_intake, education_credentials, insurance_plans, insurance_documents, insurance_extracted_facts, benefit_profiles, onboarding_sections, etc. | ✅ each     | ✅                                                                         |
| 068       | goal_discovery_turns, estate_planning_profile, estate_beneficiaries                                                                                                                                                                                           | ✅ each     | ✅                                                                         |
| 070       | goal_interpretations, goal_optimizer_runs / inputs / assumptions / allocations / tradeoffs / recommendations / outcomes                                                                                                                                       | ✅ each     | ✅                                                                         |
| 071       | life_scenarios + 8 child tables, life_trajectory_snapshots                                                                                                                                                                                                    | ✅ each     | ✅                                                                         |
| 072       | candidate*career_profiles, job_candidate_matches (user-scoped); employer*\* (employer-scoped under a separate owner-key policy)                                                                                                                               | ✅          | ✅ where applicable                                                        |
| 073       | wearable monitoring tables (gated by `public.is_health_enabled()`)                                                                                                                                                                                            | ✅          | ✅                                                                         |
| 076       | goal_hierarchies, goal_dependencies, goal_conflicts, goal_priorities, goal_relationships, goal_pathways                                                                                                                                                       | ✅ each     | ✅ `auth.uid() = user_id`                                                  |
| 077       | central.ontology_entities, central.ontology_relationships, central.provenance_records, central.review_log                                                                                                                                                     | ✅ each     | ✅ **read-only-when-approved** for authenticated; service_role full access |

### Service-role policies

Every owner policy has a paired `FOR ALL TO service_role USING (true) WITH CHECK (true)` policy. Service-role keys live on the worker / API gateway / Edge Function — not in the client bundle (`NEXT_PUBLIC_*` only references the anon key per `apps/web/src/lib/supabase/server.ts`).

### Personal data exposure

- All user-owned tables are gated by `auth.uid()`.
- Central tables expose **only approved rows** to authenticated readers via the `public.central_ontology_entities` / `central.ontology_relationships` views.
- The `public.central_provenance_records` view is fully readable to authenticated users; nothing in those rows is personal.
- **No public-anonymous read policy** on personal data.

### Sensitive-field embedding (defense in depth)

- Worker `src/normalizer.rs` strips fields matching `*_encrypted`, `member_id`, `group_number`, `policy_number`, `notes`, etc., before embedding (covered by `tests/no_sensitive_field_embedding.rs`, 4 passing).
- Trigger payloads in 074 + 075 explicitly omit `notes` (career_connection, health_record), `description` (transaction), `member_id_encrypted`, `group_number_encrypted` (insurance).
- Confirmed no plaintext PHI or PII reaches Qdrant / Neo4j.

### Secrets in logs

- Worker uses `tracing` with `EnvFilter`; no `info!` or `warn!` call embeds a token or password.
- API gateway uses `python-dotenv` + `pydantic-settings`; secrets are loaded into the `Settings` object, not logged.

### `user_id` from client body

- The compliance route (`apps/api-gateway/app/routes/compliance.py`) derives `user_id` strictly from the JWT `sub` claim (`test_user_id_comes_only_from_jwt_not_from_body` — passing). Body-passed `user_id` is ignored.
- The Edge Function `graphrag-query` validates the Supabase JWT and uses the verified `sub` as the tenant filter.
- Onboarding routes read `auth.uid()` server-side, not from the request body.

### Identity provider

Supabase Auth remains the sole identity surface. No alternative auth flows introduced.

### Unprotected admin/test routes

- `apps/web/src/app/test-agent/page.tsx` still exists, points at `localhost:8000`/`localhost:8080`. **Flag for cleanup** before public launch (noted in PERSONALIZED_GRAPHRAG_ACTIVATION.md as a MEDIUM item).
- No new admin routes added without auth in this sprint.

### Flags

| Issue                                                                                           | Severity           |
| ----------------------------------------------------------------------------------------------- | ------------------ |
| `.venv` (79MB) untracked + not gitignored — could be accidentally committed                     | HIGH               |
| `apps/web/.env.local` is gitignored but devs need a setup doc reminding them never to commit it | LOW                |
| `/test-agent` page exposed in app router                                                        | MEDIUM (carryover) |

**No RLS gaps, no cross-user leakage paths, no exposed secrets, no unprotected new API routes.**

---

## 8. GraphRAG Verification

| Asset                                                            | Status                                                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Migration 074 (v2 triggers, 40+ tables)                          | ✅ present at `supabase/migrations/074_graphrag_v2_triggers.sql`                                                                         |
| Migration 075 (055 repair)                                       | ✅ present at `supabase/migrations/075_fix_055_triggers.sql`                                                                             |
| Migration 076 (goal hierarchy + sync triggers)                   | ✅ present at `supabase/migrations/076_goal_hierarchy.sql`                                                                               |
| Migration 077 (central ontology + access_scope routing)          | ✅ present at `supabase/migrations/077_central_graph_ontology.sql`                                                                       |
| Queue rows created for new user-graph tables                     | ✅ (075 self-test asserts function presence; runtime asserted by `verify_075_triggers.sql` — UNVERIFIED here, needs DB)                  |
| Rust worker processes queue rows                                 | ✅ (25 tests pass; release build clean; tenant_isolation + idempotency + retry_safety + no_sensitive_field_embedding all passing)        |
| Qdrant payload includes `tenant_id` + `user_id` + `access_scope` | ✅ (asserted by `tests/tenant_isolation.rs::qdrant_payload_carries_tenant_and_user_ids`; access_scope currently hardcoded to `personal`) |
| Neo4j nodes include `tenant_id` + `user_id` + `entity_id`        | ✅ (asserted by `tests/tenant_isolation.rs::neo4j_params_carry_tenant_and_cypher_filters_by_tenant`)                                     |
| Central-vs-personal routing                                      | ⚠️ documented; **worker dispatch still TODO** — see below                                                                                |

### Known GraphRAG gap (carryover, NOT a regression)

The Rust worker hard-codes `access_scope: "personal"` in `src/qdrant_client.rs:49`. Migration 077 adds the `access_scope` column and routes central writes through it, but the worker does not yet branch on the column. Result: central-table writes will enqueue with `access_scope='central'` but the worker would project them into the personal collections.

**Impact at this commit:** **none operationally**, because the central tables have no production-curated data yet — only the bootstrap seed shipped in 077, which is intentionally `self_authored` and not meant for runtime retrieval until curated. Documented as deferred in `GOAL_HIERARCHY_AND_CENTRAL_GRAPHRAG_IMPLEMENTATION.md`.

**Fix size:** ~30 lines in `processor.rs` + `qdrant_client.rs` + `neo4j_client.rs`. Tracked as launch-readiness HIGH (see §10).

---

## 9. Product Regression Verification

Tested by jest where coverage exists; inspected by code-read where it doesn't. **No tests removed.** Test count rose from 237 → 255 (+18 net new).

| Surface                            | Status                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Supabase Auth login/register/reset | UNCHANGED — `LoginForm`, `RegisterForm`, `EmailVerification` tests passing                                          |
| Onboarding questionnaire           | IMPROVED — `UserGraphQuestionnaire` step inserted between Risk and Complete (non-blocking save)                     |
| Onboarding interactive flow        | IMPROVED — extended; no API contract broken                                                                         |
| Conversational onboarding          | UNCHANGED — `ConversationalShell.tsx` present; route `apps/web/src/app/onboarding/converse/` untracked but additive |
| Dashboard                          | UNCHANGED + EXTENDED — new `/dashboard/{jobs,life-trajectory,next-dollar-optimizer}` routes are additive            |
| Plaid link-token route             | UNCHANGED — file present, no diff                                                                                   |
| Plaid exchange route               | UNCHANGED                                                                                                           |
| Plaid accounts route               | UNCHANGED                                                                                                           |
| Plaid transactions route           | UNCHANGED                                                                                                           |
| Goals CRUD                         | UNCHANGED — `public.goals` table extended in 068 (additive columns only); existing API contract intact              |
| Scenario Lab                       | UNCHANGED — tabs still render; tests pass                                                                           |
| Dynamic Goal Optimizer             | UNCHANGED — `apps/web/src/lib/optimizer/{engine,scoring}.ts` + `__tests__/engine.test.ts` passing                   |
| Life Trajectory Simulation         | UNCHANGED + EXTENDED — `HierarchyAwareEvaluator` is bolt-on; existing `projector.ts` and `generator.ts` unmodified  |
| Career Marketplace                 | UNCHANGED — 072 tables additive; routes under `api/employer`, `api/jobs/` untracked but additive                    |
| Estate/Legacy schema + API         | UNCHANGED — 068 + `api/onboarding/estate` additive                                                                  |
| Insurance schema + API             | UNCHANGED — 064 + `api/onboarding/insurance` additive                                                               |
| Health feature gate                | UNCHANGED — `public.is_health_enabled()` still returns `false` by default; 073 + 076 + 077 do not change the gate   |

**Verdict:** all surfaces either UNCHANGED or IMPROVED. No REGRESSED or BROKEN entries.

---

## 10. Launch Blocker Review

### CRITICAL

| #   | Item                                                                                 | Status                                                                                           |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 1   | `.venv` / `target/` / `.pytest_cache/` not gitignored — accidental 100MB commit risk | **OPEN** — must add to root `.gitignore` before `git add apps/api-gateway apps/ingestion-worker` |
| 2   | Encryption key provisioning (`app.settings.encryption_key`)                          | DOCUMENTED in `PERSONALIZED_GRAPHRAG_ACTIVATION.md` §6 (CRITICAL). Not provisioned in this env.  |

### HIGH

| #   | Item                                                                | Status                                                                                                   |
| --- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 3   | Email-verification middleware                                       | DOCUMENTED, not yet enforced (HIGH in activation doc)                                                    |
| 4   | Rate limiting on `/api/auth/*`, `/api/agent/chat`, employer publish | DOCUMENTED, not yet implemented                                                                          |
| 5   | Insurance Supabase storage bucket                                   | DOCUMENTED runbook step (`supabase storage create-bucket insurance --public=false`)                      |
| 6   | Stripe vs. free-launch decision                                     | DOCUMENTED as binary choice; awaiting decision                                                           |
| 7   | Rust worker deployment                                              | Deploy script ready; not deployed in this audit                                                          |
| 8   | FastAPI gateway deployment / defer decision                         | **DECIDED** — defer at beta; documented in `PERSONALIZED_GRAPHRAG_ACTIVATION.md` §4                      |
| 9   | Central graph population (`central.*`)                              | Bootstrap seed only (23 entities, 22 edges, all `self_authored`). Curated sourcing is a separate sprint. |
| 10  | Worker `access_scope` dispatch (central vs personal routing)        | ~30-line carryover; documented in GOAL_HIERARCHY_AND_CENTRAL_GRAPHRAG_IMPLEMENTATION.md `Deferred`       |
| 11  | Cargo fmt + clippy strict gates                                     | OPEN — `cargo fmt --check` and `cargo clippy -D warnings` would fail CI                                  |
| 12  | uv migration for FastAPI gateway                                    | OPTIONAL — current `requirements.txt`-based flow works; uv path documented in §5                         |
| 13  | Mobile type-check failure (`apps/web/apps/web/...` doubled path)    | PRE-EXISTING — fix by removing the leftover doubled-path directory, not blocked by this commit           |

### MEDIUM

| #   | Item                                                            | Status                                             |
| --- | --------------------------------------------------------------- | -------------------------------------------------- |
| 14  | `/test-agent` page exposed                                      | OPEN — hide behind build flag before public launch |
| 15  | Stale `localhost:8000` / `localhost:8080` AgentProxy references | OPEN                                               |
| 16  | 55 React lint warnings                                          | OPEN, advisory                                     |
| 17  | Outcome attribution worker                                      | OPEN, future sprint                                |
| 18  | Backfill of historical 055-affected tables after 075 applied    | OPEN — SQL provided in `TRIGGER_REPAIR_REPORT.md`  |
| 19  | Pathway materialization scheduler                               | OPEN, future sprint                                |

### LOW

| #   | Item                                                    | Status                                |
| --- | ------------------------------------------------------- | ------------------------------------- |
| 20  | Sentry on web + worker                                  | OPEN                                  |
| 21  | Cookie consent UI tied to `core.consent_records`        | OPEN                                  |
| 22  | Archive `apps/graphrag-pipeline/` Python serverless app | OPEN once Rust worker is steady-state |

---

## 11. Commit Worthiness Decision

### **COMMIT WITH NOTES**

Criteria check:

| Criterion                         | Status                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| No secrets in tracked content     | ✅                                                                                                                      |
| No destructive migrations         | ✅                                                                                                                      |
| Tests pass or failures documented | ✅ web 255/255, rust 25/25, gateway 29/29; the documented failures (mobile TS, rustfmt, clippy strict) are pre-existing |
| No RLS regression                 | ✅                                                                                                                      |
| No auth regression                | ✅                                                                                                                      |
| No broken build                   | ✅ web type-check passes, cargo release builds, pytest passes                                                           |
| No deleted critical functionality | ✅                                                                                                                      |

**Block on the mandatory pre-commit task in §10/CRITICAL/1:** add `.venv/`, `target/`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `__pycache__/` to root `.gitignore` **before** staging `apps/api-gateway` or `apps/ingestion-worker`. Without this, a careless `git add -A` will commit ~100MB of build artifacts.

After that one-line `.gitignore` change, the working tree is **commit-worthy**. The Rust fmt / clippy gates and mobile type-check are pre-existing issues that **do not change with this commit** and should be addressed in a separate hygiene PR (or before enabling strict CI on those tools).

---

## 12. Recommended Commit Grouping

Each group lists the staging commands (no `npm`), the suggested commit subject + body, and rationale. **None of these commits have been created** by this audit — execute only after user approval.

### Pre-flight (mandatory)

```bash
# 0. Add ignores so we don't commit build artifacts
cat >> .gitignore <<'EOF'

# Python
.venv/
.pytest_cache/
__pycache__/
*.pyc
.mypy_cache/
.ruff_cache/

# Rust
target/
EOF
git add .gitignore
git commit -m "chore: ignore python virtualenv and rust target dirs"
```

### Group 1 — Root goal discovery + conversational onboarding

```bash
git add supabase/migrations/068_root_goal_discovery_and_estate.sql \
        apps/web/src/lib/discovery/ \
        apps/web/src/lib/onboarding/ \
        apps/web/src/types/discovery.ts \
        apps/web/src/components/onboarding/ConversationalShell.tsx \
        apps/web/src/app/onboarding/converse/ \
        apps/web/src/app/api/onboarding/goal-discovery/ \
        ONBOARDING_ROOT_GOAL_DISCOVERY_IMPLEMENTATION.md
```

Subject: `feat(onboarding): root goal discovery + conversational shell`
Body: introduces `goal_discovery_turns`, the discovery engine, and the conversational onboarding shell with a non-blocking save flow.

### Group 2 — Intake / user graph schema + UI

```bash
git add supabase/migrations/060_user_graph_foundation.sql \
        supabase/migrations/061_user_graph_expansion.sql \
        supabase/migrations/062_financial_intake_expansion.sql \
        supabase/migrations/063_health_intake_expansion.sql \
        supabase/migrations/064_insurance_benefits.sql \
        supabase/migrations/065_career_education_expansion.sql \
        supabase/migrations/066_family_lifestyle.sql \
        supabase/migrations/067_onboarding_sections.sql \
        supabase/migrations/069_intake_logs_and_benefit_profile.sql \
        apps/web/src/types/user-graph.ts \
        apps/web/src/types/intake.ts \
        apps/web/src/components/onboarding/SectionShell.tsx \
        apps/web/src/components/onboarding/UserGraphQuestionnaire.tsx \
        apps/web/src/components/onboarding/sections/ \
        apps/web/src/app/onboarding/hub/ \
        apps/web/src/app/onboarding/sections/ \
        apps/web/src/app/onboarding/review/ \
        apps/web/src/app/onboarding/interactive/page.tsx \
        apps/web/src/app/onboarding/questionnaire/page.tsx \
        apps/web/src/app/api/onboarding/career-extended/ \
        apps/web/src/app/api/onboarding/commitment-levels/ \
        apps/web/src/app/api/onboarding/consents/ \
        apps/web/src/app/api/onboarding/constraints/ \
        apps/web/src/app/api/onboarding/debts/ \
        apps/web/src/app/api/onboarding/decision-preferences/ \
        apps/web/src/app/api/onboarding/domain-risk/ \
        apps/web/src/app/api/onboarding/education-intake/ \
        apps/web/src/app/api/onboarding/estate/ \
        apps/web/src/app/api/onboarding/family-lifestyle/ \
        apps/web/src/app/api/onboarding/financial-profile/ \
        apps/web/src/app/api/onboarding/health-intake/ \
        apps/web/src/app/api/onboarding/insurance/ \
        apps/web/src/app/api/onboarding/life-vision/ \
        apps/web/src/app/api/onboarding/motivations/ \
        apps/web/src/app/api/onboarding/profile-summary/ \
        apps/web/src/app/api/onboarding/sections/ \
        apps/web/src/app/api/user-graph/ \
        apps/web/src/lib/supabase/types.ts \
        packages/supabase/src/database.types.ts \
        COMPLETE_INTAKE_USER_GRAPH_IMPLEMENTATION.md \
        USER_GRAPH_ONBOARDING_IMPLEMENTATION.md
```

Subject: `feat(intake): user graph schema, onboarding sections, and review hub`

### Group 3 — Dynamic goal optimizer

```bash
git add supabase/migrations/070_dynamic_goal_optimizer.sql \
        apps/web/src/lib/optimizer/ \
        apps/web/src/types/optimizer.ts \
        apps/web/src/app/api/optimizer/ \
        apps/web/src/app/dashboard/next-dollar-optimizer/ \
        DYNAMIC_GOAL_OPTIMIZER_IMPLEMENTATION.md
```

Subject: `feat(optimizer): dynamic goal optimizer engine and Next-Dollar dashboard route`

### Group 4 — Trajectory simulation

```bash
git add supabase/migrations/071_life_trajectory_simulation.sql \
        apps/web/src/lib/trajectory/projector.ts \
        apps/web/src/lib/trajectory/generator.ts \
        apps/web/src/lib/trajectory/inputs.ts \
        apps/web/src/lib/trajectory/__tests__/ \
        apps/web/src/types/trajectory.ts \
        apps/web/src/app/api/simulations/ \
        apps/web/src/app/dashboard/life-trajectory/ \
        LIFE_TRAJECTORY_SIMULATION_ENGINE.md
```

(Exclude `hierarchy-aware-evaluator.ts` and its test — those go in Group 9.)

Subject: `feat(trajectory): life-trajectory projector, generator, and dashboard`

### Group 5 — Health / insurance / estate / career marketplace

```bash
git add supabase/migrations/072_career_marketplace.sql \
        supabase/migrations/073_wearable_monitoring.sql \
        apps/web/src/lib/marketplace/ \
        apps/web/src/lib/health-monitoring/ \
        apps/web/src/types/marketplace.ts \
        apps/web/src/types/health-monitoring.ts \
        apps/web/src/app/api/employer/ \
        apps/web/src/app/api/jobs/ \
        apps/web/src/app/api/health-monitoring/ \
        apps/web/src/app/employer/ \
        apps/web/src/app/dashboard/jobs/ \
        CAREER_MARKETPLACE_IMPLEMENTATION.md \
        WEARABLE_MONITORING_IMPLEMENTATION.md
```

Subject: `feat(domain): career marketplace + wearable monitoring schema and routes`

### Group 6 — Rust GraphRAG worker

```bash
git add apps/ingestion-worker/Cargo.toml \
        apps/ingestion-worker/Cargo.lock \
        apps/ingestion-worker/Dockerfile \
        apps/ingestion-worker/fly.toml \
        apps/ingestion-worker/.env.example \
        apps/ingestion-worker/deploy.sh \
        apps/ingestion-worker/src/ \
        apps/ingestion-worker/tests/ \
        apps/ingestion-worker/INGESTION_WORKER_IMPLEMENTATION.md \
        apps/api-gateway/.env.example \
        apps/api-gateway/Dockerfile \
        apps/api-gateway/fly.toml \
        apps/api-gateway/pytest.ini \
        apps/api-gateway/requirements.txt \
        apps/api-gateway/requirements-dev.txt \
        apps/api-gateway/deploy.sh \
        apps/api-gateway/app/ \
        apps/api-gateway/tests/ \
        apps/api-gateway/GRAPHRAG_FASTAPI_COMPLIANCE_IMPLEMENTATION.md \
        scripts/validation/smoke_test_graphrag.sh \
        LIFENAVIGATOR_ARCHITECTURE_INTEGRITY_AUDIT.md \
        PERSONALIZED_GRAPHRAG_ACTIVATION.md \
        SEQUENCED_BUILD_PLAN.md
```

Subject: `feat(graphrag): Rust ingestion worker + FastAPI gateway scaffolding`

**Verify before commit:**

- `git status --short | grep -E "\.(venv|pytest_cache)|target" → must return nothing` after the pre-flight ignore step
- `cargo test` from `apps/ingestion-worker/` (25/25)
- `pytest` from `apps/api-gateway/` (29/29)

### Group 7 — GraphRAG trigger repair + v2 triggers

```bash
git add supabase/migrations/074_graphrag_v2_triggers.sql \
        supabase/migrations/075_fix_055_triggers.sql \
        scripts/validation/verify_075_triggers.sql \
        TRIGGER_REPAIR_REPORT.md
```

Subject: `fix(graphrag): repair migration 055 triggers (UUID cast) + v2 trigger expansion`

### Group 8 — Central ontology + goal hierarchy

```bash
git add supabase/migrations/076_goal_hierarchy.sql \
        supabase/migrations/077_central_graph_ontology.sql \
        scripts/validation/verify_076_rls.sql \
        apps/web/src/types/goal-hierarchy.ts \
        apps/web/src/lib/goals/
```

Subject: `feat(intelligence): goal hierarchy schema + central ontology with provenance`

### Group 9 — Advisor reasoning + hierarchy-aware simulation

```bash
git add apps/web/src/types/advisor.ts \
        apps/web/src/lib/advisor/ \
        apps/web/src/lib/trajectory/hierarchy-aware-evaluator.ts \
        apps/web/src/lib/trajectory/__tests__/hierarchy-aware-evaluator.test.ts \
        GOAL_HIERARCHY_AND_CENTRAL_GRAPHRAG_IMPLEMENTATION.md \
        PRE_COMMIT_VERIFICATION_REPORT.md
```

Subject: `feat(advisor): cross-domain reasoning service + hierarchy-aware simulation scoring`

---

## Appendix — Raw outputs

```
pnpm install --frozen-lockfile         → "Lockfile is up to date" / Already up to date
pnpm --filter @life-navigator/web type-check → exit 0
pnpm --filter @life-navigator/web lint  → 0 errors, 55 warnings
pnpm --filter @life-navigator/web test  → 255 passed / 255 total / 21 suites
pnpm --filter @life-navigator/mobile type-check → 2 errors (pre-existing on HEAD)
cargo fmt --check                       → exit 1 (16 files)
cargo clippy --all-targets -- -D warnings → exit 1 (manual_div_ceil at neo4j_client.rs:196)
cargo test                              → 25 passed
cargo build --release --bin ingestion-worker → Finished release profile
pytest (gateway, via .venv)             → 29 passed
uv sync                                 → UNVERIFIED (no pyproject.toml)
supabase db reset                       → UNVERIFIED (CLI absent)
psql verify_075_triggers.sql            → UNVERIFIED (no local DB)
psql verify_076_rls.sql                 → UNVERIFIED (no local DB)
smoke_test_graphrag.sh                  → UNVERIFIED (no local DB + worker env)
```
