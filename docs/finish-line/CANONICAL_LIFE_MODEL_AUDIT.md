# Canonical Life Model Audit — Finish Line

**Scope:** Does every user-facing surface read from ONE canonical life model?
**Method:** Read-only. Every claim grounded in real code (file:line). No code changed.
**Date:** 2026-06-16

---

## Verdict (headline)

**Single source of truth: NO.**

The platform has a well-designed canonical life model in the `life` schema (exposed by
`life_discovery.py:snapshot()` → `my_life.py:my_life()`), and most narrative/risk/opportunity/
recommendation surfaces DO read from it. **But goals are fractured across four stores**, and the
dashboard hero (`ExecutiveSummary.tsx`) reads two of them side-by-side with no join. There is also a
**second, parallel goal-intelligence stack** (`public.goals.root_goal` + `goal_interpretations` +
optimizer/decision engine) that the core-api life model knows nothing about.

So: the _narrative/objective_ spine is canonical; the _goal_ layer is not.

---

## The four goal stores (the root of the fracture)

| Store                           | Defined                                                                                      | Shape                                                                                                                                                                                                                                                           | Written by                                                                             | Read by                                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `public.goals` (CRUD)           | `001_initial_schema.sql:82`; cols extended by `068_root_goal_discovery_and_estate.sql:18-35` | progress_percent, target_value, current_value, status CHECK(draft/active/paused/completed/archived), category CHECK(education/career/finance/health/personal), priority INT, **+ root_goal, stated_goal, root_goal_confidence_score, dominant_driver, urgency** | web onboarding + manual form (`api/goals/route.ts:createGoal`, many onboarding routes) | ExecutiveSummary, dashboard/goals, report_engine, legacy advisor/optimizer/decision stack, life_bridge (read-only, into life model)       |
| `life.candidate_goals`          | `20260611020000_life_candidate_goals.sql:4`                                                  | goal_text (user's own words), normalized_goal (dedupe), objective_key, domain, confidence, status                                                                                                                                                               | discovery chat (`relationship_manager.py:118 _persist_candidate_goals`)                | `snapshot().goal_portfolio` (`life_discovery.py:887-893`), `dominant_narrative`                                                           |
| `life.life_objectives`          | `154_life_discovery.sql:11`                                                                  | root_objective_key, surface_goal, why_chain, confidence, confirmed, origin, status                                                                                                                                                                              | `discover_goal` (`life_discovery.py:817`), discovery chat, bridge                      | `snapshot().objectives/primary_objective/candidate_objectives`, recommendations_os, decision_brain, scenario_compare, reports, life graph |
| `life.goals` (objective-linked) | `154_life_discovery.sql:17`                                                                  | objective_id, title, status='open'                                                                                                                                                                                                                              | `discover_goal` (`life_discovery.py:826`)                                              | **only** `personal_graph` (`life_discovery.py:1015`) → Life Graph nodes                                                                   |

`public.goals` and `life.goals` are **different tables that share a name** — a real footgun.
`public.goals` is the CRUD store; `life.goals` is a graph node linked to an objective.

---

## Inventory: every surface vs its source

| Surface                                           | Source table                                                          | Source API                                                                             | Consumer(s)                                                        | Canonical?                                                                        | Duplicate?                                          | Deprecated?                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Goals (CRUD list)**                             | `public.goals`                                                        | `GET /api/goals` (`api/goals/route.ts:36`) via `goalsService.listGoals`                | dashboard/goals page (`dashboard/goals/page.tsx:28`), goals/create | NO (separate store)                                                               | YES — not joined to candidate_goals/life_objectives | No, but not in the life model                                                |
| **Goal Portfolio**                                | `life.candidate_goals`                                                | `GET /v1/life/my-life` & `/v1/life/snapshot`                                           | snapshot, narrative, Life Brief                                    | **YES** (canonical)                                                               | partial — overlaps public.goals titles via bridge   | No                                                                           |
| **Objectives**                                    | `life.life_objectives`                                                | `/v1/life/snapshot`, `/v1/life/plan`                                                   | my_life, recommendations, decision_brain, reports, graph           | **YES** (canonical)                                                               | overlaps candidate_goals (objective vs goal)        | No                                                                           |
| **Narratives** (dominant_narrative + explanation) | `life.candidate_goals` + `life_vision.prompts.narrative`              | `/v1/life/my-life`, `/v1/life/snapshot`                                                | ExecutiveSummary, LifeIntelligence, Life Brief                     | **YES**                                                                           | No                                                  | No                                                                           |
| **Risks**                                         | `life.risks` (objective-linked) + Recommendation OS (grounded)        | `/v1/life/my-life`                                                                     | ExecutiveSummary, LifeIntelligence                                 | **YES** (gated, grounded-only `my_life.py:102-107`)                               | No                                                  | archetype risks intentionally NOT auto-created (`life_discovery.py:829-835`) |
| **Opportunities**                                 | `life.opportunities` + Recommendation OS                              | `/v1/life/my-life`                                                                     | same                                                               | **YES** (gated)                                                                   | No                                                  | same gating                                                                  |
| **Recommendations**                               | `recommendations` schema + `life_objectives` deps                     | `/v1/recommendations/*` (`recommendations_os.py:141,382`)                              | dashboard/recommendations, next_best_action                        | **YES**                                                                           | No                                                  | No                                                                           |
| **Reports**                                       | `life_objectives` + snapshot + `public.goals`                         | `report_engine.py:253` reads `public.goals`; rest from snapshot                        | reports/pdf                                                        | **MIXED** — pulls `public.goals` for "goals" section (`report_engine.py:251-258`) | YES (report goals ≠ portfolio)                      | No                                                                           |
| **Graph (Life Graph)**                            | `life_objectives` + `life.goals` + deps/risks/opps/cons + domain CRUD | `/v1/life/graph` (`personal_graph`)                                                    | /life-graph, /life-graph/explainable                               | **YES** (canonical, real-edges-only)                                              | uses `life.goals`, not portfolio                    | No                                                                           |
| **Dashboard (Executive Summary)**                 | **`life` (my-life) AND `public.goals`**                               | `/api/life/my-life` + `/api/goals?limit=6`                                             | ExecutiveSummary (`ExecutiveSummary.tsx:147-159`)                  | **NO — reads two stores**                                                         | **YES — the core defect**                           | No                                                                           |
| **Advisor (core-api hybrid)**                     | `life.candidate_goals` + `life_objectives`                            | discovery chat → advisor_context                                                       | advisor                                                            | **YES**                                                                           | No                                                  | No                                                                           |
| **Advisor (legacy web stack)**                    | `public.goals.root_goal` + `goal_interpretations`                     | `advisor-reasoning-service.ts:64,98`; `context-loader.ts:72`; `optimizer/engine.ts:80` | decision engine, optimizer                                         | **NO — separate stack**                                                           | **YES — parallel goal intelligence**                | candidate for deprecation                                                    |
| **Discovery**                                     | `life.candidate_goals` + `life_objectives`                            | `relationship_manager.py`                                                              | discovery chat                                                     | **YES**                                                                           | No                                                  | No                                                                           |

---

## Where the violations are

1. **Dashboard reads two unjoined goal stores.** `ExecutiveSummary.tsx:147-159` fetches
   `/api/life/my-life` (canonical narrative/objective) AND `/api/goals` (`public.goals` CRUD) in the
   same component. The "goal progress" tiles come from `public.goals`; the objective/narrative come
   from `life.*`. They are joined nowhere → the same goal can show twice with different data, or be
   visible in one place and invisible in the other.

2. **The bridge is one-way, lossy, and not on the read path.** `life_bridge.py:67-127` copies
   `public.goals.title` into `life_objectives` (as unconfirmed `origin='persona_bridge'` candidates),
   dropping progress/target/current_value/root_goal entirely. It never writes back to `public.goals`.
   And `sync()` runs only via `POST /v1/life/bridge` (`life.py:62`) or inside discovery chat
   (`relationship_manager.py:198`) — **not** when `my-life`/`snapshot` is read. So a user who creates a
   goal in the CRUD UI but never re-runs discovery has it absent from the life model.

3. **A whole second goal-intelligence stack exists in `public.goals`.** Columns
   `root_goal/stated_goal/root_goal_confidence_score/dominant_driver/urgency`
   (`068_root_goal_discovery_and_estate.sql:18-35`) feed `advisor-reasoning-service.ts`,
   `decision/context-loader.ts`, and `optimizer/engine.ts` — a goal-root-discovery system that
   parallels (and predates) the core-api `life_discovery` engine. `goalsService.toGoalRow` doesn't
   even whitelist these columns, so the CRUD UI can't populate them; they're written/read by the
   legacy stack only. Two engines answer "what is this user's real goal?" and they don't talk.

4. **`public.goals` vs `life.goals` name collision.** Both exist (`001:82` and `154:17`). Different
   schemas, different purposes, identical table name — high migration-error risk.

5. **Reports mix sources.** `report_engine.py:251-258` reads `public.goals` for the report's "goals"
   section while every other field comes from the canonical snapshot — so a PDF can list CRUD goals
   that contradict the Goal Portfolio shown on the dashboard.

---

## What IS canonical (the good news)

- Narrative, objectives, risks, opportunities, constraints, dependencies, recommendations, Life
  Brief, and the Life Graph all read from `life.*` via `snapshot()`/`my_life()`.
- Trust gating is real: archetype risks/opps are NOT auto-surfaced (`life_discovery.py:829-835`,
  `my_life.py:102-107`); generic labels are filtered (`GENERIC_RISK_OPP_LABELS`).
- The fracture is **localized to the goal layer**. Fixing goals converges the platform.

See `GOAL_SYSTEM_RECONCILIATION.md`, `GOAL_CONSUMER_MAP.md`, `GOAL_MIGRATION_PLAN.md`.
