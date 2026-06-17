# Goal System Reconciliation — KEEP / MERGE / DEPRECATE / DELETE

**Date:** 2026-06-16. Read-only audit; this is a recommendation, not an implementation.

## The stores at a glance

| Store                         | Role today                                                            | What's good                                                                                            | What's wrong                                                                                       |
| ----------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **A. `public.goals`**         | manual CRUD goals + progress + legacy root-goal cols                  | has the one thing the life model lacks: **trackable progress** (progress_percent/target/current_value) | not joined to the life model; doubles as a legacy root-goal store; name collides with `life.goals` |
| **B. `life.candidate_goals`** | discovery goals in the user's own words; powers narrative + portfolio | canonical, evidence-grounded, dedup'd                                                                  | no progress tracking; no manual create from UI                                                     |
| **C. `life.life_objectives`** | root objectives (the "why behind the why")                            | canonical objective spine; drives recs/graph/reports                                                   | not where day-to-day goals live                                                                    |
| **D. `life.goals`**           | one surface-goal node per objective, for the graph                    | renders Goal nodes on Life Graph                                                                       | redundant with B; confusing name; tiny role                                                        |
| legacy satellites             | goal_interpretations, goal_hierarchies, optimizer/decision tables     | power optimizer/decision-impact features                                                               | parallel intelligence the life model ignores                                                       |

---

## Recommended canonical goal model

**One canonical goal record = `life.candidate_goals` (the portfolio) joined to a progress facet.**

- **B (`life.candidate_goals`) is the canonical goal list.** It is already what `goal_portfolio`,
  the narrative, the Life Brief, and the advisor read. It is grounded in the user's own words and
  dedup'd. Keep it as the spine.
- **C (`life.life_objectives`) stays as the OBJECTIVE layer** (the deeper "why"). Goals link UP to
  objectives via `objective_key`. Do not merge B and C — they're different altitudes and both are
  consumed canonically.
- **The missing piece is progress.** Today only `public.goals` has progress_percent/target/current.
  The convergence target is: **B carries the goal; progress lives in a single progress facet** (either
  add progress columns to `life.candidate_goals`, or an adapter that maps a `public.goals` row to its
  matching candidate goal — see migration plan, prefer the adapter pre-pilot).

---

## Per-store decision

### A. `public.goals` — **KEEP (demote to write-through edge), then re-point reads**

- **Keep the table** short-term: it's the only progress store and the CRUD UI + onboarding write to
  it across 10+ routes (`GOAL_CONSUMER_MAP.md` §A). Deleting it pre-pilot is high-risk.
- **Demote its role:** it should become a _manual-entry / progress edge_, not a competing source of
  truth. Every CRUD write should also project into the life model (extend the existing one-way bridge,
  or write candidate_goals directly from `goals/route.ts`).
- **Re-point the dashboard read** (`ExecutiveSummary.tsx:151`) off `/api/goals` and onto the
  portfolio (with progress), so the hero shows ONE list.
- **Legacy root_goal columns** (`068:18-35`) and the optimizer/decision stack: **DEPRECATE** — see
  below.

### B. `life.candidate_goals` — **KEEP (make canonical)**

- This is the convergence target. Add the ability to (a) carry progress, and (b) be created/edited by
  the user (today only discovery chat writes it).

### C. `life.life_objectives` — **KEEP (unchanged)**

- Canonical objective layer. No change needed; goals reference it.

### D. `life.goals` — **MERGE into B / DELETE eventually**

- Its only consumer is `personal_graph` (`life_discovery.py:1015`) for Graph "Goal" nodes. The graph
  can render goal nodes from `candidate_goals` instead. **MERGE** (re-point the graph), then **DELETE**
  in a later gated migration. Also rename to remove the `public.goals` collision if kept.

### Legacy goal-intelligence (`goal_interpretations`, root_goal cols, optimizer/decision tables) — **DEPRECATE (post-pilot DELETE)**

- `advisor-reasoning-service.ts`, `decision/context-loader.ts`, `optimizer/engine.ts` run a parallel
  root-goal discovery that duplicates `life_discovery`. For the pilot, **freeze** it (don't extend) and
  decide whether the optimizer/decision features ship at all. If they ship, they should read the life
  model, not `public.goals.root_goal`. **Do not delete pre-pilot** — these power live decision/optimizer
  endpoints; deletion needs a feature decision.

---

## Per-consumer decision

| Consumer                                | Today reads                        | Decision                                | Rationale                                                            |
| --------------------------------------- | ---------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| Goal Portfolio                          | B                                  | **KEEP**                                | already canonical                                                    |
| Executive Summary (dashboard hero)      | A + life                           | **RE-POINT to portfolio+progress**      | the headline defect: two unjoined stores                             |
| dashboard/goals page                    | A                                  | **RE-POINT to portfolio+progress**      | one goal list everywhere                                             |
| Recommendations                         | C                                  | **KEEP**                                | canonical                                                            |
| Reports (PDF)                           | A (goals section) + snapshot       | **RE-POINT goals section to portfolio** | `report_engine.py:251-258` must not contradict dashboard             |
| Graph                                   | C + D                              | **MERGE D→B**                           | drop the redundant `life.goals`                                      |
| Dashboard (my_life sections)            | life (canonical)                   | **KEEP**                                | fine                                                                 |
| Life Brief                              | snapshot (B+C)                     | **KEEP**                                | fine                                                                 |
| Advisor (core-api)                      | B + C                              | **KEEP**                                | fine                                                                 |
| Advisor/optimizer/decision (legacy web) | A.root_goal + goal_interpretations | **DEPRECATE/FREEZE**                    | parallel engine; post-pilot decision                                 |
| Discovery                               | B + C                              | **KEEP**                                | canonical writer                                                     |
| Onboarding goal writers (5 routes)      | write A                            | **WRITE-THROUGH to life model**         | so onboarding goals reach the portfolio without a manual bridge call |

---

## Net target state

```
User states a goal (discovery chat | CRUD form | onboarding)
        │  (all paths write-through)
        ▼
life.candidate_goals  ── objective_key ──►  life.life_objectives
        │  (+ progress facet)
        ▼
snapshot().goal_portfolio  ──►  ONE list read by: dashboard hero, goals page,
                                 reports, graph, Life Brief, advisor
```

`public.goals` survives short-term as a manual-entry/progress edge that projects into
`candidate_goals`; the legacy root-goal/optimizer stack is frozen pending a feature decision.
