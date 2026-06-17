# Goal Migration Plan — converge on one goal model, safely

**Date:** 2026-06-16. Read-only audit output. **This is a plan, not an implementation.**
**HARD RULE respected:** no new features. Every step is reconciliation of existing stores.

**Guiding principle:** prefer a **join/adapter over a destructive migration**. The fastest, safest
fix is to make the dashboard read ONE list — without moving any data — by joining the two stores in
the read path. DB schema changes are gated and reversible, and pushed to "after pilot" wherever
possible.

---

## Stage 0 — Read-only convergence (NO DB change) — **DO BEFORE PILOT**

The headline defect (dashboard reads two unjoined goal stores) can be closed with **zero migration**.

**0a. Make `/v1/life/my-life` (or snapshot) carry progress-bearing goals.**

- In `my_life.py:my_life()` (after `snapshot()` at `my_life.py:82`), join the canonical
  `goal_portfolio` (from `candidate_goals`) with progress data from `public.goals` **by normalized
  title match** (the same `normalized_goal` key discovery already uses, `relationship_manager.py:121`).
- Emit one `goals` array: `{goal, domain, status, progress_percent, target_value, current_value}` —
  portfolio entries enriched with progress where a `public.goals` row matches; CRUD-only goals
  appended so nothing disappears.
- This is pure surfacing (the `my_life` docstring already says "no new intelligence; composes what
  exists"). No new feature.

**0b. Re-point the dashboard hero and goals page.**

- `ExecutiveSummary.tsx:147-159`: drop the second `fetch('/api/goals')`; read goals from the
  `my-life` payload's new `goals` array.
- `dashboard/goals/page.tsx:28`: same.
- Result: ONE goal list everywhere, deduped, with progress. The double-show / invisible-goal defect
  is gone.

**0c. Re-point the report goals section.**

- `report_engine.py:251-258`: build the report "goals" from the same joined list instead of raw
  `public.goals`, so the PDF can't contradict the dashboard.

- **Risk:** low — read-only, additive payload field. Title-match join can miss reworded goals (they
  still appear, just without progress — honest, not wrong).
- **Rollback:** revert the FE fetch + the `my_life` join; nothing persisted.

---

## Stage 1 — Write-through so new goals reach the model (NO destructive change) — **BEFORE PILOT**

Today CRUD/onboarding goals only reach the life model if someone calls `POST /v1/life/bridge` or runs
discovery (`relationship_manager.py:198`). Close that gap.

**1a. Auto-bridge on read (cheapest):** in `my_life()`/`snapshot()`, opportunistically call the
existing `LifeBridgeService.sync()` when `bridge.signature()` (`life_bridge.py:65`) shows new
onboarding data. Idempotent (uuid5-keyed), already written to be safe. No new infra.

- **Risk:** medium — adds a write to a read path + latency. Mitigate by gating behind the cheap
  `signature()` check and a feature flag; only sync when the fingerprint changed.
- **Rollback:** flag off → reverts to explicit bridge.

**1b. (Alternative/also) write-through from the CRUD route:** when `goals/route.ts` POST succeeds,
also project the goal into `candidate_goals` (mirror `_persist_candidate_goals`,
`relationship_manager.py:118`). Keeps the read path clean.

- **Note:** the bridge is currently lossy (title only, `life_bridge.py:84-90`). When bridging, also
  carry domain/status so the portfolio entry is complete. This is a fix to existing code, not a new
  feature.

---

## Stage 2 — Schema convergence (GATED + REVERSIBLE migration) — **AFTER PILOT**

Only once Stage 0/1 prove out. Goal: progress lives in the canonical store so the title-match join is
no longer needed.

**2a. Add progress columns to `life.candidate_goals`** (additive, reversible):
`progress_percent INT`, `target_value NUMERIC`, `current_value NUMERIC`, `target_date DATE`,
`source TEXT`. Backfill from `public.goals` via the same title match used in Stage 0.

- **Gate:** ship behind a flag; keep reading via the Stage-0 join until backfill is verified.
- **Rollback:** columns are nullable + additive → `DROP COLUMN` is clean; reads fall back to the join.

**2b. Repoint the Life Graph off `life.goals` (D) onto `candidate_goals` (B).**

- `personal_graph` (`life_discovery.py:1015,1025`): render "Goal" nodes from `candidate_goals`.
- Stop writing `life.goals` in `discover_goal` (`life_discovery.py:826`).

**2c. Deprecate `life.goals` (D).** After 2b, no consumer remains. Mark deprecated; `DROP TABLE` in a
later gated migration (and resolve the `public.goals` name collision).

- **Risk:** medium (graph rendering). **Rollback:** keep `life.goals` writes until the graph repoint
  is verified in prod; drop is a separate, reversible step.

---

## Stage 3 — Retire the legacy goal-intelligence stack — **AFTER PILOT, FEATURE DECISION FIRST**

`public.goals.root_goal/stated_goal/...` (`068:18-35`) + `goal_interpretations` +
`advisor-reasoning-service.ts` / `decision/context-loader.ts` / `optimizer/engine.ts`.

- **Do NOT touch pre-pilot** — these power live optimizer/decision endpoints.
- **Decision needed:** do the optimizer/decision-impact features ship in the pilot?
  - If **no** → freeze; plan deletion of the columns + tables post-pilot.
  - If **yes** → re-point them to read the life model's objective/portfolio instead of
    `public.goals.root_goal` (larger effort; schedule separately).
- **Risk:** high (live features). **Rollback:** these are reads of existing columns; freezing is
  zero-risk; any repoint ships behind a flag.

---

## Before-pilot vs after-pilot split

| Stage | What                                                        | When       | Destructive?                  |
| ----- | ----------------------------------------------------------- | ---------- | ----------------------------- |
| 0     | Join in read path; one goal list on dashboard/goals/reports | **Before** | No                            |
| 1     | Write-through so onboarding/CRUD goals reach the model      | **Before** | No                            |
| 2a    | Add progress cols to candidate_goals + backfill             | After      | Additive (reversible)         |
| 2b/2c | Repoint graph off `life.goals`; deprecate/drop D            | After      | Gated drop                    |
| 3     | Retire/repoint legacy root-goal + optimizer/decision stack  | After      | Gated; needs feature decision |

---

## Risk & rollback summary

- **Stages 0–1 carry no data-loss risk** (read-side join + idempotent existing bridge). They fix the
  user-visible defect before the pilot without a migration.
- **All DB changes (Stage 2+) are additive-first and flag-gated**; drops are deferred to separate,
  reversible migrations after the join/repoint is proven in prod.
- **The legacy stack (Stage 3) is frozen, not deleted, pre-pilot** — deletion is gated on a product
  decision about optimizer/decision features.
- **No new infra** is introduced anywhere; every step reuses existing services
  (`LifeBridgeService`, `_persist_candidate_goals`, `snapshot`/`my_life`).
