# Goal Read-Path Inventory

**Date:** 2026-06-17 · Read-path only — no migration, no write change, no delete.

## The four goal stores

| Store                  | Purpose                                                                 | Key fields                                                                                            | Freshness      | Consumers (before)                                                                 | Quality                       | Canonical priority                | Dup risk                        |
| ---------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------- | ----------------------------- | --------------------------------- | ------------------------------- |
| `life.life_objectives` | Root objectives w/ why-chain; carries `confirmed`/`origin`/`confidence` | id, title, surface_goal, confirmed, origin, confidence, themes, root_objective_key                    | discovery-time | `snapshot()` → Life Brief, narrative, recommendations                              | High (candidate-protected)    | **1** (confirmed) / 4 (candidate) | merges w/ candidate + public    |
| `life.goals`           | Objective-linked goal nodes                                             | id, objective_id, title, domain, status, target_date                                                  | discovery-time | graph                                                                              | Medium                        | 2 (confirmed) / 3                 | name collides w/ `public.goals` |
| `public.goals`         | User CRUD + the ONLY store with quantitative **progress**               | id, title, category, status, progress_percent, target/current_value, (+068 root_goal/dominant_driver) | user-edited    | dashboard `ExecutiveSummary` via `/api/goals`; report `_advisor_executive_section` | Mixed (user + persona-seeded) | 3 (user) / 5 (persona)            | duplicates life objectives      |
| `life.candidate_goals` | Discovery portfolio — user's own words                                  | goal_text, normalized_goal, domain, confidence, status                                                | per-turn       | `snapshot().goal_portfolio` → narrative, Life Brief                                | High                          | 3 (confirmed) / 4                 | duplicates objectives           |

## The defect (confirmed by the Finish Line audit)

The dashboard `ExecutiveSummary.tsx` fetched **both** `/api/life/my-life` (life model) **and** `/api/goals`
(`public.goals` CRUD) and rendered them with no join — so the same goal could appear twice with different
data, or appear in one place and be invisible in the other. The report read `public.goals` directly
(persona-seeded goals shown as "tracked", Report Truth **D2**). There was no single user-visible goal model.

## The fix (this sprint)

A **read-path join** — `CanonicalGoalsService.canonical_goals(ctx)` — produces one deduped, source-prioritized,
candidate-protected goal view from all four stores at read time. Consumers (dashboard, report, `/v1/life/goals`)
now read it. No store was migrated, written, or deleted. See `CANONICAL_GOAL_VIEW.md`.
