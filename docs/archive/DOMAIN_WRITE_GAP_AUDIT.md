# DOMAIN_WRITE_GAP_AUDIT.md — Phase 3

## The real root cause (verified in code)

There are **three disconnected data layers**, not two:

1. **`life.facts`** — what every approved Advisor action writes (via `IngestionService.submit_life_fact`, schema-locked to `life`). Surfacing + advisor-citation only.
2. **Domain _write_ tables** — what the existing manual-entry endpoints target (`finance.assets`, `finance.asset_loans`, `health.health_goals`, …).
3. **Domain _read / summary / readiness_ tables** — what `LifeReadinessEngine.assess()` and the domain `summary()` methods actually read (`finance.financial_accounts`, `finance.transactions`, `health.sleep_logs/activity_logs/vitals`, `family.dependents`, `career.career_profiles/compensation_records`, `education.education_records`).

**The trap:** prior notes (READINESS_DELTA.md) said "the 5 write paths all already exist as endpoints." That is only half true. The endpoints exist, **but the two actions whose endpoints exist write to tables the readiness engine does not read.** So "just route the action to the existing endpoint" does **not** move readiness for them.

### Evidence

- `apps/lifenavigator-core-api/app/domains/finance.py:136-187` — `summary()` computes net worth from `financial_accounts` only (`assets_total - account_debt`, both classified from `financial_accounts`, lines 154-157). `asset_loans` is read (line 147) into `debts` but **never used** in net worth; `finance.assets` is **not read at all**.
- `apps/lifenavigator-core-api/app/domains/finance.py:596-610` — `manual_asset()` inserts into `finance.assets`; `manual_liability()` inserts into `finance.asset_loans`. **Neither writes `financial_accounts`** → no net-worth / finance-readiness movement.
- `apps/lifenavigator-core-api/app/domains/health.py:75-110` — `summary()` reads `sleep_logs`, `activity_logs`, `vitals`; the missing-data penalty is keyed on `sleep_logs`/`activity_logs`. It does **not** read `health_goals`.
- `apps/lifenavigator-core-api/app/routers/health_domain.py:86` — `POST /v1/health/goal` writes `health.health_goals` → a table the health summary ignores. (Note: `POST /v1/health/check-in:96` writes `sleep_logs`, which _is_ read — but that's a behavioral log, not a goal.)
- `apps/lifenavigator-core-api/app/services/readiness.py:58-101,134` — per-domain progress = `100 − 25·high_priority_recs − 12·missing_fields − 45·(no_data)`. Readiness moves only when a row lands in a table the `summary()` reads (reducing the missing/no-data penalty or the rec count).

## Per-action matrix

| Action                | Facts written today (`life.facts`)                           | Readiness-read table needed                             | Existing write endpoint                                                       | Does that endpoint hit the readiness-read table? | Would readiness move?                  | Build risk                                                                       |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- | -------------------------------------------------------------------------------- |
| **Promotion**         | `promotion.{title, base_salary, annual_bonus, equity_grant}` | `career.career_profiles`, `career.compensation_records` | ❌ none (career router read-only)                                             | n/a                                              | Only after a **new** endpoint          | Med — schema for compensation_records; career summary logic                      |
| **New Child**         | `family.{expecting_child, child_due_date, child_name}`       | `family.dependents`                                     | ❌ none (family router read-only)                                             | n/a                                              | Only after a **new** endpoint          | **Low** — dependents is a simple owner-scoped insert; readiness already reads it |
| **Home Purchase**     | `home.{purchase_price, down_payment, mortgage_balance}`      | `finance.financial_accounts` (net worth)                | ⚠️ `POST /v1/finance/manual-asset`→`assets`, `manual-liability`→`asset_loans` | **NO** — wrong tables                            | No (without also fixing the read path) | High — net-worth double-count risk (see finance.py:151-153 warning)              |
| **Degree Enrollment** | `education.{enrollment, tuition, program_duration}`          | `education.education_records`                           | ⚠️ generic `write()` in service (no route)                                    | If wired to `education_records`: yes             | Only after a **new** route             | Med — generic write exists, needs route + field mapping                          |
| **Health Goal**       | `health.{goal, goal_target_date}`                            | `health.sleep_logs/activity_logs/vitals`                | ⚠️ `POST /v1/health/goal`→`health_goals`                                      | **NO** — summary ignores `health_goals`          | No (a goal isn't a log)                | High — would require fabricating activity logs or changing the scorer            |

## Per-action detail

### Promotion

- **Exact tables:** `career.career_profiles` (current_title, employer, base_salary), `career.compensation_records` (effective_date, base, bonus, equity).
- **Existing route:** none — `career_domain.py` is read-only.
- **Required fields:** title→`career_profiles.current_title`; base_salary→`compensation_records.base_salary`; annual_bonus→`compensation_records.bonus`; equity_grant→`compensation_records.equity_value`.
- **RLS:** `career` schema is owner-scoped (116-RLS pattern); insert must set `user_id` from JWT (mirror `finance.create_goal:590`).
- **Endpoint exists?** No — must build `POST /v1/career/compensation`.
- **MCP/IngestionService?** No — IngestionService is schema-locked to `life`. Use a domain service write (like `manual_asset`), not ingestion.
- **Risk:** Medium.

### New Child

- **Exact table:** `family.dependents` (name, relationship='child', dob/due_date).
- **Existing route:** none — `family_domain.py` is read-only.
- **Required fields:** child_name→`name`; child_due_date→`dob`/`expected_date`; relationship constant.
- **RLS:** owner-scoped insert, `user_id` from JWT.
- **Endpoint exists?** No — must build `POST /v1/family/dependent`.
- **MCP/IngestionService?** No (life-locked). Domain service write.
- **Risk:** **Low** — simplest aligned action; readiness family domain already reads `dependents`.

### Home Purchase

- **Exact tables (for movement):** `finance.financial_accounts` (a `mortgage`/liability account + the property as an asset account) — NOT `finance.assets`/`asset_loans`, which the summary ignores.
- **Existing route:** `POST /v1/finance/manual-asset` and `/manual-liability` exist but write the wrong tables for readiness.
- **Required fields:** purchase_price→asset account balance; mortgage_balance→liability account balance; down_payment→cash delta (optional).
- **RLS:** owner-scoped; `user_id` from JWT (existing writes already do this).
- **Endpoint exists?** Partially (wrong target). To move net worth you must either (a) write `financial_accounts`, or (b) change `summary()` to also fold in `finance.assets`/`asset_loans` — which risks **double-counting** (the code comment at finance.py:151-153 was added specifically to stop net-worth inflation).
- **MCP/IngestionService?** No (life-locked).
- **Risk:** **High** — correctness risk on net worth.

### Degree Enrollment

- **Exact table:** `education.education_records` (institution, program, start_date, status='enrolled').
- **Existing route:** none dedicated; `education` service has a generic `write()` (domains/education.py:~298) usable for the EDUCATION schema.
- **Required fields:** enrollment→program/institution; tuition→`annual_cost`; program_duration→`expected_end`.
- **RLS:** owner-scoped insert, `user_id` from JWT.
- **Endpoint exists?** Partial — service write exists, no route.
- **MCP/IngestionService?** No (life-locked). Use the education service `write()`.
- **Risk:** Medium.

### Health Goal

- **Exact tables:** readiness reads `sleep_logs`/`activity_logs`/`vitals`; a **goal** maps to `health.health_goals`, which the summary does not read.
- **Existing route:** `POST /v1/health/goal` → `health_goals` (exists, but readiness-inert).
- **Required fields:** goal→`health_goals.description`; goal_target_date→`target_date`.
- **RLS:** owner-scoped insert, `user_id` from JWT.
- **Endpoint exists?** Yes — but it does not move readiness.
- **MCP/IngestionService?** No (life-locked).
- **Risk:** **High** for "real readiness delta" — you cannot honestly move the health score from a goal; the score is behavioral (logs). Faking a log would violate the no-mock-data rule.

## Bottom line

The brief's intuition ("Promotion + Health Goal are easiest/most demo-friendly for real readiness") is **inverted by the code**:

- The two actions with existing endpoints (**Home Purchase, Health Goal**) write to tables the readiness engine **doesn't read** → no honest delta.
- The action whose target table is **already read by readiness and is a trivial insert** is **New Child → `family.dependents`**. Promotion and Degree are next (career/education readiness read those tables) but each needs a new write route.
