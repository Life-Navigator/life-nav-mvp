# Goals / Scenario-Lab Input Sweep — Agent 4

Date: 2026-06-11
Area: app/goals/_, app/dashboard/scenario-lab, app/api/scenario-lab/_, app/api/goals/\*

## Surfaces

| Name                                    | Route                        | Endpoint                                                      | Table                                    | Status                                     |
| --------------------------------------- | ---------------------------- | ------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------ |
| Goal create                             | /goals/create                | POST /api/goals                                               | public.goals                             | PASS                                       |
| Goal edit / progress update             | /goals/create (timeline)     | PUT /api/goals/[id]                                           | public.goals                             | PASS                                       |
| Goal delete                             | /goals/create (timeline)     | DELETE /api/goals/[id]                                        | public.goals                             | PASS (already scoped)                      |
| Scenario create                         | /dashboard/scenario-lab      | POST /api/scenario-lab/scenarios                              | public.scenario_labs + scenario_versions | PASS (DB-validated; feature-gated in prod) |
| Scenario inputs / assumptions / what-if | /dashboard/scenario-lab/[id] | POST/GET/DELETE /api/scenario-lab/versions/[versionId]/inputs | public.scenario_inputs                   | PASS (DB-validated; feature-gated in prod) |
| Goal proxy (Core API)                   | (onboarding)                 | POST /api/life/goal                                           | life.life_objectives (Core API owns)     | DEPRECATED-for-direct-write / proxy-only   |

## Root causes

### Goals (always-on surface — was silently losing every goal)

The MyBlocks goal form (`app/goals/create/page.tsx` → `MyBlocksTimeline`) submits a full client-side
`Goal` object (`src/lib/goals/types.ts`) with camelCase keys and UI enum values the DB rejects:

- `priority: 'essential' | 'important' | 'nice_to_have'` — but `public.goals.priority` is **INT 1..5**.
- `status: 'not_started' | 'on_track' | 'at_risk' | 'deferred'` — violates the **CHECK** (`draft|active|paused|completed|archived`).
- `category: 'custom' | 'retirement' | 'purchase' | 'lifestyle' | ...` — violates the **CHECK** (`education|career|finance|health|personal`).
- `targetAmount / currentAmount / targetDate / startDate / progress` — wrong names; real columns are
  `target_value / current_value / target_date / started_at / progress_percent`.

The old `POST /api/goals` spread the raw payload straight into `.insert()`, so the write failed a CHECK
or type cast. The form only handled `response.ok` and **swallowed the error** (no toast) → fake success,
client-only goals that vanished on refresh.

### Scenario Lab (feature-gated, but the write paths were broken)

1. `POST /api/scenario-lab/scenarios` created the initial version with `name: 'Initial version'`, but
   `public.scenario_versions` has **`version_label`** and a **NOT NULL `inputs_hash`** (no default).
   The version insert returned PGRST204 → scenario creation rolled back / failed. (Proven: HTTP 400
   `Could not find the 'name' column`.)
2. `POST/GET/DELETE /api/scenario-lab/versions/[versionId]/inputs` used columns that **do not exist** on
   `public.scenario_inputs`: it wrote `version_id / field_name / field_value / field_type / source` and
   validated with `createInputSchema`. The real table (migration 005) has
   `scenario_version_id / input_key / input_value / input_type / source_type / unit`. Every input write
   would have failed with a column error. The matching validator (`scenarioInputDataSchema`) already
   existed but was unused.

## Fixes

- **New** `src/lib/services/goalsService.ts` — `toGoalRow()` mapper (mirrors familyService/educationService):
  alias map (camelCase → real columns), column **WHITELIST** (drops `domain`, `milestones`, `position`,
  `userId`, etc.), CHECK-safe maps for `category` / `status`, INT map for `priority` (essential→1, important→3,
  nice_to_have→5), `'' → null`, dates → `YYYY-MM-DD`, `progress_percent` clamped 0..100. Plus
  `createGoal` / `updateGoal` / `listGoals` that stamp `user_id` from the verified session and scope writes
  to `(id, user_id)`.
- `app/api/goals/route.ts` (POST) — validate only `title` (passthrough), then `createGoal(...)`; on DB
  error return `safeApiError({ code:'db_persistence_error', context:{ route, table } })`.
- `app/api/goals/[id]/route.ts` (PUT) — route through `updateGoal(...)` so edits/progress updates are
  aliased + whitelisted + ownership-scoped; explicit `db_persistence_error` on failure.
- `app/goals/create/page.tsx` — `handleGoalCreate` re-fetches from the DB after save (proves persistence +
  reload) and surfaces the server `message`/`error` (no blanket "Failed to save", no fake success);
  `handleGoalUpdate` surfaces server errors too.
- `app/api/scenario-lab/scenarios/route.ts` — initial version now uses `version_label` + `inputs_hash:'empty'`.
- `app/api/scenario-lab/versions/[versionId]/inputs/route.ts` — switched to `scenarioInputDataSchema` and
  the real columns (`scenario_version_id`, `input_key`, `input_value`, `input_type`, `source_type`, `unit`)
  for GET filter, batch upsert delete keys, insert, and DELETE.

## Validation evidence (DB layer, 2 users, prod Supabase)

Script created userA/userB via admin API, signed each in, wrote the EXACT mapper output via PostgREST
under the user session, proved RLS, verified with the service role, then cleaned up users + rows.

```
GOAL CREATE (userA, public.goals):                 HTTP 201
GOAL GET as userA (owner):                          HTTP 200 rows=1
GOAL GET as userB (other):                          HTTP 200 rows=0   <- RLS isolated
GOAL PATCH as userB (other):                        HTTP 200 rows=0   <- cannot touch userA's goal
GOAL PATCH as userA (owner):                        HTTP 200 rows=1
service-role read: category=finance status=draft priority=3 progress_percent=50  <- maps correct

SCENARIO scenario_labs INSERT (userA):              HTTP 201
SCENARIO scenario_versions INSERT (userA):          HTTP 201   (was 400 before fix)
SCENARIO scenario_inputs INSERT (userA):            HTTP 201   (wrong columns before fix)
SCENARIO inputs GET as userA:                       HTTP 200 rows=1
SCENARIO inputs GET as userB:                        HTTP 200 rows=0  <- RLS isolated
```

Pre-fix evidence captured during the sweep:

- `scenario_versions` insert with `name`: HTTP 400 `Could not find the 'name' column ... in the schema cache`.

`tsc --noEmit` clean for all changed files.

## Remaining risks / notes

- **Scenario Lab is feature-gated** behind `FEATURE_SCENARIO_LAB_ENABLED` (server) /
  `NEXT_PUBLIC_FEATURE_SCENARIO_LAB_ENABLED` (client). Neither is set in any env file, so the UI shows
  "Feature Not Available" and the routes 403 in prod. The write paths are now correct and DB-validated,
  but they are not user-reachable until the flag is enabled. Status reflects DB-validated-but-gated.
- Scenario Lab routes use the **service-role** client and scope by `user_id` from the JWT (not the user
  session). This is consistent with the existing module design (not in scope to refactor); RLS on the
  tables independently enforces isolation, which I verified directly under user tokens.
- `POST /api/life/goal` is a **proxy-only** route to the Core API (FastAPI/Fly), which owns
  `life.life_objectives`. It cannot be DB-validated from the web app and was not modified.
- The Goal `category` CHECK only allows `education|career|finance|health|personal`, so richer UI categories
  (retirement, purchase, lifestyle, protection) are collapsed onto that set by `CATEGORY_MAP`. If the
  product needs the finer taxonomy persisted, a migration to widen the CHECK (or a `subcategory` column)
  is the follow-up — out of scope for this save-path sweep.
