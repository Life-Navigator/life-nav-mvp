# Wearable Monitoring & Non-Diagnostic Alert Engine — Implementation Notes

This is Step 2 of the sequenced build plan (`SEQUENCED_BUILD_PLAN.md`).
Migration `073_wearable_monitoring.sql` was already in place from Step 1;
this round adds the engine, API surface, tests, and documentation.

## What changed

### Library — `apps/web/src/lib/health-monitoring/`

- **`copy.ts`** — vetted non-diagnostic copy bank keyed by
  `(rule_key, severity)`. Every entry has been reviewed for:
  no diagnostic phrasing, no dosage/treatment instructions, no
  guaranteed outcomes. The `DISALLOWED_PHRASES` list (e.g. `"you have"`,
  `"diagnosed with"`, `"disease"`, `"disorder"`, `"will cure"`,
  `"nothing to worry about"`) is **enforced by jest**, so a future edit
  cannot accidentally introduce diagnostic language.
- **`alert-engine.ts`** — pure deterministic evaluator. Six built-in rules:
  - `rhr_up_sleep_down` — resting heart rate trending up vs baseline
    while sleep is trending down.
  - `bp_trend_worsening` — ≥50% of recent readings above 140/90.
  - `weight_sudden_drop` — meaningful drop vs prior window.
  - `recovery_score_collapse` — N consecutive low-recovery days.
  - `concerning_combo` — composite of fatigue + recovery + sleep + stress
    (+ HRV/RHR when available).
  - `lab_out_of_range` — any flagged-`high`/`critical` lab result.
    Each rule is a pure function over typed inputs. The orchestrator
    applies the **user severity floor** and **per-rule cooldown** before
    returning surviving alerts.
- **`runner.ts`** — the API-layer wrapper. Loads the user's last 60 days
  of `daily_wellbeing`, `vitals_log`, `body_measurements`, `lab_results`
  plus their prefs + alert-rule config + the last 200 fired events
  (so cooldown can be enforced), runs the engine, and INSERTs surviving
  alerts into `health_meta.health_alert_events`. Returns a clean
  `{ ok, feature_locked, alerts_persisted, alerts }` shape so the API
  surface stays uniform whether the health gate is on or off today.

### API routes — `apps/web/src/app/api/health-monitoring/`

| Path                      | Methods  | Behavior                                                                                                                                                                                                                                                                   |
| ------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manual-entry/route.ts`   | POST     | Discriminated-union body: `daily_wellbeing` / `vitals` / `body_measurement` / `lab_result`. Writes to the right `health_meta.*` table (upsert by `user_id,observed_on` for wellbeing), then runs the engine.                                                               |
| `wearable-event/route.ts` | POST     | Webhook normalizer. Writes raw to `wearable_metrics`, mirrors to the canonical engine tables (`resting_heart_rate`/`hrv`/`blood_pressure`/`glucose`/`spo2`/`body_temp` → `vitals_log`; `weight` → `body_measurements`; `sleep` → `daily_wellbeing`), then runs the engine. |
| `alerts/route.ts`         | GET      | Lists alerts. `?status=pending\|acknowledged\|dismissed\|all`. Defaults to `pending`. RLS does the user filter.                                                                                                                                                            |
| `alerts/[id]/route.ts`    | PATCH    | Body `{ action: 'acknowledge' \| 'dismiss' \| 'share_with_physician' }` — stamps the appropriate timestamp.                                                                                                                                                                |
| `preferences/route.ts`    | GET, PUT | User prefs: alerts on/off, quiet hours (`HH:MM`), minimum severity to notify, physician email.                                                                                                                                                                             |

All routes use `createServerSupabaseClient()` — RLS does the permission
work. `auth.uid()` is the only identity ever trusted.

### Feature-locked behavior

`public.is_health_enabled()` still returns `false` until the health
feature is officially launched (see migration 038). Until then,
owner-context reads/writes return a feature-locked error; the routes
collapse these to a clean
`{ success: true, feature_locked: true }` response so the UI can render
a friendly banner without seeing raw RLS errors.

The SQL validation script flips the gate to `true` for the duration of
its transaction (then `ROLLBACK`s) to actually exercise the policies.

### Tests

`apps/web/src/lib/health-monitoring/__tests__/`:

- **`copy.test.ts`** (4 tests) — every (`rule_key`, `severity`) entry
  mentions a "physician/doctor/provider" next step, none contains a
  disallowed diagnostic phrase, the disallowed-phrase list is non-empty,
  and `containsDisallowed` correctly flags an obvious diagnostic phrase.
- **`alert-engine.test.ts`** (12 tests) — one or more cases per rule:
  - `rhr_up_sleep_down` fires when both signals move together; does NOT
    fire when only RHR rises.
  - `bp_trend_worsening` fires when ≥50% of recent readings are elevated.
  - `weight_sudden_drop` fires on a ≥2.5 kg drop vs baseline.
  - `recovery_score_collapse` fires on 3 consecutive low-recovery days;
    does NOT fire on mixed days.
  - `lab_out_of_range` fires on `critical` flag (urgent severity), does
    NOT fire on `normal`.
  - Gating: severity floor suppresses sub-threshold alerts; cooldown
    suppresses repeated alerts; inactive rules are skipped.
  - Determinism: same input → same output.

Total: **16 passed, 0 failed**.

### SQL validation — `scripts/validation/073_wearable_monitoring_rls.sql`

Single-transaction script that:

1. Flips `is_health_enabled()` to TRUE for the transaction (ROLLBACK
   restores the original definition).
2. Seeds two users (A, B).
3. Inserts preferences + 6 alert rules + one alert event for User A
   under service-role context.
4. Switches to User A's authenticated role and asserts they can read
   their preferences, see 6 active rules, see 1 pending event, and
   successfully acknowledge it.
5. Asserts cross-user INSERT (`user_id = user_b`) is blocked by RLS.
6. Switches to User B and asserts they see zero of A's rows.
7. Asserts User B can insert their own minimum-fields preferences row.

Run:

```bash
psql "$DATABASE_URL" -f scripts/validation/073_wearable_monitoring_rls.sql
```

A successful run prints `ALL ASSERTIONS PASSED for migration 073`.

## How to deploy

1. Migration is already pushed (`supabase/migrations/073_wearable_monitoring.sql`).
2. When you flip `public.is_health_enabled()` to `true`, the entire
   surface starts working for owner reads/writes immediately — no
   additional plumbing required.
3. Webhook the wearable providers (Apple Health / Google Health Connect /
   Oura / Whoop / Garmin / Fitbit) at
   `POST /api/health-monitoring/wearable-event` with the schema
   described in the route.
4. The route runs the engine on every write; alerts surface at
   `GET /api/health-monitoring/alerts`.

## Compliance contract

- The engine never writes a diagnosis. All copy goes through
  `copyFor(rule, severity)`, and the copy bank is jest-tested against a
  disallowed-phrase list.
- Recommended next step always points to the user's physician.
- Severity floor + cooldown prevent spam; the user is in control of
  both.
- The trigger metrics that produced each alert are persisted into the
  event row so the user (or their physician) can see the raw evidence.

## File map

```
apps/web/src/lib/health-monitoring/
  alert-engine.ts                                                          NEW
  copy.ts                                                                  NEW
  runner.ts                                                                NEW
  __tests__/alert-engine.test.ts                                           NEW
  __tests__/copy.test.ts                                                   NEW

apps/web/src/app/api/health-monitoring/
  manual-entry/route.ts                                                    NEW
  wearable-event/route.ts                                                  NEW
  alerts/route.ts                                                          NEW
  alerts/[id]/route.ts                                                     NEW
  preferences/route.ts                                                     NEW

apps/web/src/types/health-monitoring.ts                                    NEW
scripts/validation/073_wearable_monitoring_rls.sql                         NEW
WEARABLE_MONITORING_IMPLEMENTATION.md                                       NEW
```

## Intentionally deferred

- **UI surface** — a dedicated `/dashboard/health-monitoring` page that
  shows pending alerts and lets the user manage rules / preferences is
  the natural follow-up. The API surface is complete.
- **Provider OAuth glue** — `wearable_event` accepts a normalized event;
  the actual OAuth handshake + Apple Health / Google Health Connect /
  Oura / Whoop / Garmin / Fitbit webhook plumbing is a separate
  integration project that drops onto this route as-is.
- **GraphRAG sync triggers** for `health_alert_events` — wire in a
  follow-up migration following the `055_graphrag_expanded_triggers.sql`
  pattern.
- **Engine extension points** — the engine is pure and LLM-agnostic. A
  follow-up can layer LLM-driven explanation generation on top of the
  trigger metrics without touching the rule evaluation logic.

---

## Next step

**Step 3 — Dynamic Goal Optimizer.** Migration `070` is already in place.
The next round will build:

- `apps/web/src/lib/optimizer/{types,scoring,engine}.ts`
- API routes: `POST /api/optimizer/run`, `GET /api/optimizer/runs/[id]`,
  `POST /api/optimizer/runs/[id]/accept` / `reject`
- UI: `/dashboard/next-dollar-optimizer`
- Jest tests for the deterministic scorer
- SQL validation for 070
- `DYNAMIC_GOAL_OPTIMIZER_IMPLEMENTATION.md`

**Paste this when you're ready to continue:**

> Execute Step 3 of the sequenced build plan: Dynamic Goal Optimizer.
> Build the scoring + engine library, the API routes, the
> `/dashboard/next-dollar-optimizer` UI, jest tests, SQL validation,
> and the implementation doc. Migration 070 is already in place.
> Don't start any other step.
