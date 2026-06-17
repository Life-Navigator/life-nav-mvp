# Goal Consumer Map — every read/write of every goal store

**Purpose:** so nothing is missed in a migration. Read-only audit, file:line grounded.
**Date:** 2026-06-16

Four goal stores:

- **A. `public.goals`** — CRUD (`001_initial_schema.sql:82`; extended `068:18-35`, `070`, `076`, `080`, `081`)
- **B. `life.candidate_goals`** — discovery goals (`20260611020000_life_candidate_goals.sql:4`)
- **C. `life.life_objectives`** — root objectives (`154_life_discovery.sql:11`)
- **D. `life.goals`** — objective-linked graph nodes (`154_life_discovery.sql:17`) _(name collides with A)_

Related satellite tables (legacy goal-intelligence): `public.goal_interpretations`,
`public.goal_discovery_turns`, `public.goal_hierarchies/dependencies/conflicts/priorities/...`
(`076`), goal-progress/probability/decision-impact tables (`080`, `081`).

---

## A. `public.goals` — CRUD store

### Writes

| File:line                                                         | Op            | Notes                                                                              |
| ----------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------- |
| `apps/web/src/lib/services/goalsService.ts:200`                   | insert        | `createGoal` (whitelisted cols via `toGoalRow`)                                    |
| `apps/web/src/lib/services/goalsService.ts:214`                   | update        | `updateGoal`                                                                       |
| `apps/web/src/app/api/goals/route.ts:82` (POST)                   | insert        | via createGoal                                                                     |
| `apps/web/src/app/api/goals/[id]/route.ts:89` (PUT)               | update        | via updateGoal                                                                     |
| `apps/web/src/app/api/onboarding/route.ts:131`                    | insert        | onboarding goals (writes target_value/priority/status — raw, not via goalsService) |
| `apps/web/src/app/api/onboarding/career-goals/route.ts:32`        | insert        |                                                                                    |
| `apps/web/src/app/api/onboarding/financial-goals/route.ts:34`     | insert        |                                                                                    |
| `apps/web/src/app/api/onboarding/education-goals/route.ts:32`     | insert        |                                                                                    |
| `apps/web/src/app/api/onboarding/health-goals/route.ts:34`        | insert        |                                                                                    |
| `apps/web/src/app/api/onboarding/goal-discovery/route.ts:126,133` | update/insert | writes root_goal/stated_goal (legacy stack)                                        |

### Reads

| File:line                                                     | Consumer                          | Columns used                                                    |
| ------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------- |
| `apps/web/src/app/api/goals/route.ts:36` (GET)                | dashboard/goals, ExecutiveSummary | `*`                                                             |
| `apps/web/src/app/api/goals/[id]/route.ts:20`                 | single goal                       | `*`                                                             |
| `apps/web/src/components/dashboard/ExecutiveSummary.tsx:151`  | **dashboard hero**                | progress_percent, target/current_value, status                  |
| `apps/web/src/app/dashboard/goals/page.tsx:28`                | goals page                        | progress_percent, target_date, priority, status                 |
| `apps/web/src/app/goals/create/page.tsx:42`                   | create/edit form                  | `*`                                                             |
| `apps/web/src/app/api/dashboard/tasks/route.ts:17`            | dashboard tasks                   |                                                                 |
| `apps/web/src/app/api/user/profile/stats/route.ts:19,25`      | profile stats counts              |                                                                 |
| `apps/web/src/app/api/user/export/route.ts:27`                | data export                       | `*`                                                             |
| `apps/web/src/app/api/onboarding/complete/route.ts:44`        | onboarding completion check       |                                                                 |
| `apps/web/src/app/api/onboarding/profile-summary/route.ts:51` | onboarding summary                |                                                                 |
| `apps/lifenavigator-core-api/.../report_engine.py:253`        | **PDF report "goals" section**    | title, status, progress_percent, category, target/current_value |
| `apps/lifenavigator-core-api/.../life_bridge.py:62`           | bridge → life model               | **title ONLY** (lossy)                                          |

### Reads (legacy goal-intelligence stack — uses root_goal/stated_goal cols)

| File:line                                                                           | Consumer                        |
| ----------------------------------------------------------------------------------- | ------------------------------- |
| `apps/web/src/lib/advisor/advisor-reasoning-service.ts:64,98`                       | root-goal discovery for advisor |
| `apps/web/src/lib/advisor/advisor-reasoning-service.ts:80` (`goal_interpretations`) |                                 |
| `apps/web/src/lib/decision/context-loader.ts:72`                                    | decision engine goal context    |
| `apps/web/src/lib/optimizer/engine.ts:80`                                           | optimizer goal inputs           |
| `apps/web/src/app/api/optimizer/run/route.ts:61` (`goal_interpretations`)           | optimizer                       |

---

## B. `life.candidate_goals` — discovery goals (canonical portfolio)

### Writes

| File:line                                                     | Op                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/lifenavigator-core-api/.../relationship_manager.py:118` | upsert (`_persist_candidate_goals`, on_conflict user_id,normalized_goal) |

### Reads

| File:line                                                             | Consumer                                           |
| --------------------------------------------------------------------- | -------------------------------------------------- |
| `apps/lifenavigator-core-api/.../life_discovery.py:887`               | `snapshot().goal_portfolio` + `dominant_narrative` |
| `apps/lifenavigator-core-api/.../relationship_manager.py:136`         | discovery confirmation (`_load_candidate_goals`)   |
| `apps/lifenavigator-core-api/.../relationship_manager.py:219,243,354` | narrative framing in chat                          |
| `apps/lifenavigator-core-api/.../discovery_coverage.py:49`            | coverage metrics                                   |

---

## C. `life.life_objectives` — root objectives (canonical objective)

### Writes

| File:line                                                     | Op                 |
| ------------------------------------------------------------- | ------------------ |
| `apps/lifenavigator-core-api/.../life_discovery.py:814`       | update (supersede) |
| `apps/lifenavigator-core-api/.../life_discovery.py:817`       | upsert (objective) |
| `apps/lifenavigator-core-api/.../relationship_manager.py:307` | update             |

### Reads

| File:line                                                            | Consumer                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------- |
| `apps/lifenavigator-core-api/.../life_discovery.py:870,962,989,1012` | snapshot, objectives_plan, discovery_health, personal_graph |
| `apps/lifenavigator-core-api/.../recommendations_os.py:141,382`      | recommendation generation                                   |
| `apps/lifenavigator-core-api/.../my_life.py:219`                     | recent intelligence feed                                    |
| `apps/lifenavigator-core-api/.../decision_brain.py:126`              | decision context                                            |
| `apps/lifenavigator-core-api/.../scenario_compare.py:175`            | scenario compare                                            |
| `apps/lifenavigator-core-api/.../report_engine.py` (via snapshot)    | reports                                                     |
| `apps/lifenavigator-core-api/.../discovery_coverage.py:45`           | coverage                                                    |

---

## D. `life.goals` — objective-linked graph node _(name collides with public.goals)_

### Writes

| File:line                                               | Op                                           |
| ------------------------------------------------------- | -------------------------------------------- |
| `apps/lifenavigator-core-api/.../life_discovery.py:826` | upsert (one surface-goal node per objective) |

### Reads

| File:line                                                | Consumer                                        |
| -------------------------------------------------------- | ----------------------------------------------- |
| `apps/lifenavigator-core-api/.../life_discovery.py:1015` | `personal_graph` → Life Graph "Goal" nodes ONLY |

---

## Bridge invocation (A → C/B, one-way)

| File:line                                                     | Trigger                                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `apps/lifenavigator-core-api/app/routers/life.py:62`          | `POST /v1/life/bridge` (explicit only)                                                          |
| `apps/lifenavigator-core-api/.../relationship_manager.py:198` | inside discovery chat turn                                                                      |
| `apps/lifenavigator-core-api/.../life_bridge.py:67-90`        | reads `public.goals` + persona, calls `discover_goal(confirmed=False, origin='persona_bridge')` |

**Not invoked on `GET /v1/life/my-life` or `/snapshot`** → CRUD goals are not guaranteed reflected
into the life model on dashboard load.
