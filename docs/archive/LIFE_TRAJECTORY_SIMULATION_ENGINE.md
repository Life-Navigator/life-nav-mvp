# Life Trajectory Simulation Engine — Implementation Notes

This is Step 4 of the sequenced build plan (`SEQUENCED_BUILD_PLAN.md`).
Migration `071_life_trajectory_simulation.sql` was already in place
from Step 1; this round adds the deterministic projector, the canonical
5-path generator, four API routes, a chart-based dashboard page, jest
tests, SQL validation, and the implementation doc.

The engine answers: **"If I keep doing what I'm doing, where do I end
up? And if I shift strategy, what changes by month, by year, by 10
years?"** It is scenario projection, not prediction.

## What changed

### Types — `apps/web/src/types/trajectory.ts`

- `ScenarioLabel` — the five canonical paths (`current_behavior` /
  `conservative` / `balanced` / `aggressive_upside` / `goal_optimized`).
- `ProjectorState` — initial state the projector advances: income,
  expenses, balances (cash / taxable / retirement / HSA / home equity),
  per-debt detail (label, balance, APR, minimum), employer-match knobs,
  monthly contribution knobs, return / inflation / income-growth
  assumptions, health-cost assumptions.
- `ScenarioDecision` — discrete decisions scheduled at a specific
  month (pay_debt / invest_taxable / contribute_retirement /
  contribute_hsa / add_to_emergency_fund / add_to_down_payment /
  enroll_education / career_change / home_purchase / retire / other).
- `ProjectorOutput` — final headline numbers, per-month metric series,
  event log, frozen assumptions, engine_version stamp.

### Library — `apps/web/src/lib/trajectory/`

- **`projector.ts`** — month-by-month loop. Pure function (`project`).
  - Income + expenses drift monthly at the exact monthly-equivalent of
    the annual rate. Inflation lifts the expense line; income growth
    lifts take-home.
  - Debt: interest accrues, minimums apply, extra payment goes to the
    highest-APR balance (avalanche).
  - Employer match honored only while employed; respects
    `monthly_retirement_contribution` and
    `employer_match_limit_pct` of salary.
  - Investments compound monthly at the configured real return.
  - Scheduled decisions fire at their `at_month` and emit an event row.
  - Pending income uplifts from completed education are applied
    automatically.
  - Returns risks + upside_factors with simple heuristics for the UI.
- **`generator.ts`** — builds the five canonical paths from one base
  state. Each variant differs only on a small, documented set of
  knobs so output differences are attributable to strategy, not noise.
  - `current_behavior` — no change.
  - `conservative` — 50% surplus to debt, 30% emergency fund,
    20% retirement.
  - `balanced` — 30/30/25/15 split across debt, retirement, taxable,
    emergency.
  - `aggressive_upside` — 55% taxable + 35% retirement + 10% debt;
    slightly more optimistic return assumption (annotated as a risk).
  - `goal_optimized` — biases the split based on the user's stated
    goal. A "home" stated goal schedules a `home_purchase` decision at
    month 36 and pushes more to a down-payment fund. "Retire / FI"
    pushes more to retirement. "Debt / cards" goes 80% to debt.
- **`inputs.ts`** — `buildBaseStateForUser(supabase, userId, opts)`
  reads the user's `finance.user_financial_profile` + `finance.debts`
  - `career_profiles` + `insurance_plans` (annual premium + estimated
    OOP) and returns a `ProjectorState` with sensible defaults for
    anything missing. All defaults are surfaced in the projector's
    assumption block.

### API routes — `apps/web/src/app/api/simulations/`

| Path                | Methods | Behavior                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create/route.ts`   | POST    | Body: `{ title, horizon_years, versions?, stated_goal? }`. Creates a `life_scenarios` row + N `life_scenario_versions` (defaults to all 5 labels). Returns the new ids.                                                                                                                                                                                                      |
| `[id]/run/route.ts` | POST    | Loads base state, generates the strategy per version, projects, then upserts `life_scenario_outputs` + `life_scenario_metrics` (down-sampled to ≤120 points per metric to keep volume bounded) + `life_scenario_events` + `life_scenario_assumptions`. Flips each version to `completed`/`failed`. Snapshots the user's current trajectory into `life_trajectory_snapshots`. |
| `[id]/route.ts`     | GET     | Full read: scenario + versions + outputs + chartable metrics + comparisons. RLS filters by user.                                                                                                                                                                                                                                                                             |
| `compare/route.ts`  | POST    | Body: `{ scenario_id, version_a_id, version_b_id }`. Computes diffs (net worth, debt, income, emergency months, health-cost exposure, retirement-ready) and writes a `life_scenario_comparisons` row with a `favored_version_id`.                                                                                                                                            |

All routes use `createServerSupabaseClient()` — RLS is the only
permission boundary; `auth.uid()` is the only identity ever trusted.

### UI — `apps/web/src/app/dashboard/life-trajectory/page.tsx`

The user enters a title, horizon (years), and optional stated goal.
**"Project all 5 paths"** runs create → run → fetch in sequence. The
page then renders:

- **Recharts `LineChart`** — net worth over time, one colored line per
  version, with the year on the x-axis and dollars on the y-axis.
- **Five compact result cards** — final net worth, final debt,
  emergency-fund months, retirement-ready, and the engine's
  one-sentence rationale per version.
- **Compare two paths** — pick A and B from a dropdown; the result
  shows up in a list of comparisons under the chart.
- **Compliance banner** — every output is presented as scenario
  projection, never as guarantee or individualized investment advice.

### Tests — `apps/web/src/lib/trajectory/__tests__/projector.test.ts`

13 pure tests:

- **Determinism** — same state produces identical output; engine_version
  is stamped.
- **Shape** — emits `horizon_months + 1` metric points; `at_month` is
  monotonically increasing; debt decreases with extra payment; total
  debt at horizon is less than initial debt when paying $500/mo extra;
  investments grow when contributing + positive return; inflation
  greater than income growth shrinks late-horizon cash flow;
  `emergency_months` never goes negative.
- **Decisions** — `home_purchase` adds a mortgage and lifts total
  debt vs the no-decision baseline.
- **Generator** — produces a variant for every canonical label;
  `aggressive_upside` has higher taxable-investing knob than
  `conservative`; `goal_optimized` with a home stated goal schedules
  a `home_purchase` decision.

Total project test count: **214 passed, 0 failed across 17 suites**.

### SQL validation — `scripts/validation/071_life_trajectory_rls.sql`

Single-transaction script that ROLLBACKs at the end. Seeds two users,
writes a full scenario for user A across every trajectory table
(scenarios, versions, decisions, assumptions, outputs, metrics, events,
comparisons, trajectory_snapshots), then:

1. Switches to user A's authenticated role and asserts they can read
   every table.
2. Asserts cross-user INSERT (`user_id = user_b` while authenticated
   as A) is blocked.
3. Switches to user B and asserts they see zero of user A's rows.
4. Deletes the parent scenario as user A and asserts every child row
   (versions, outputs, metrics, decisions, assumptions, events,
   comparisons) cascade-deleted.
5. Prints `ALL ASSERTIONS PASSED for migration 071` on success.

Run:

```bash
psql "$DATABASE_URL" -f scripts/validation/071_life_trajectory_rls.sql
```

### Verification

- `tsc --noEmit -p tsconfig.json` → **clean (0 errors)**
- `eslint` over every new/modified file → **clean**
- `jest` → **214 passed, 0 failed**

## Compliance contract

Every projector run writes its assumption set into
`life_scenario_assumptions`:

| Assumption                       | Value                     | Rationale                                                                                                   |
| -------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `compounding`                    | `monthly`                 | Investments and inflation compound monthly. Returns are deterministic — Monte Carlo is a follow-up wrapper. |
| `expected_real_return_pct`       | typically `0.06`–`0.07`   | Long-run real return on taxable investments before fees. Conservative defaults are recommended.             |
| `expected_retirement_return_pct` | typically `0.06`          | Long-run return on the retirement portfolio.                                                                |
| `expected_inflation_pct`         | typically `0.025`         | Annual inflation lifts the expense line monthly.                                                            |
| `expected_income_growth_pct`     | typically `0.03`          | Annual income growth lifts take-home pay monthly until retirement.                                          |
| `debt_strategy`                  | `avalanche_with_minimums` | Minimum payments are honored; extra payment is applied to the highest-APR balance.                          |
| `retirement_readiness_threshold` | `25x_expenses`            | Common rule-of-thumb; users can replace with their own.                                                     |
| `planning_language_only`         | `true`                    | Scenario projection, not a guarantee or individualized investment advice.                                   |

The UI repeats this in plain language under the chart and the cards.

## How to deploy

1. Migration is already pushed
   (`supabase/migrations/071_life_trajectory_simulation.sql`).
2. Push the lib + API + UI as part of the normal Vercel deploy.
3. Smoke-test from `/dashboard/life-trajectory`:
   - Enter a title + horizon → Project all 5 paths.
   - Verify the chart shows 5 distinct lines.
   - Pick two versions → Compare → the comparison appears below the
     chart and a row lands in `life_scenario_comparisons`.
   - SQL spot-check:
     ```sql
     select label, status, ran_at from life_scenario_versions
      where scenario_id = '<id>' order by version_index;
     select count(*) from life_scenario_metrics
      where scenario_version_id = '<v>';
     ```

## Intentionally deferred

- **Monte Carlo wrapper** — the projector is deterministic. A
  follow-up can sample return distributions per month and run N
  Monte Carlo trials per version, persisting percentile bands instead
  of single lines. The schema already supports it via
  `life_scenario_metrics` (just add `metric_key='net_worth_p10'` etc.).
- **LLM-driven scenario narration** — the engine emits structured
  events; an LLM layer could narrate "you bought a house in month 36,
  which lifted your net worth from $X to $Y by month 60" into a
  story. The data is already there.
- **Goal-attribution loop** — when the user accepts a scenario as
  their plan, write a `user_decisions` row + a `user_actions` row
  (mirrors what the optimizer does). Wire into a `/accept` route in a
  follow-up.
- **GraphRAG triggers for life_scenario_outputs** — follow the
  `055_graphrag_expanded_triggers.sql` pattern.

## File map

```
apps/web/src/types/trajectory.ts                                            NEW
apps/web/src/lib/trajectory/projector.ts                                    NEW
apps/web/src/lib/trajectory/generator.ts                                    NEW
apps/web/src/lib/trajectory/inputs.ts                                       NEW
apps/web/src/lib/trajectory/__tests__/projector.test.ts                     NEW

apps/web/src/app/api/simulations/create/route.ts                            NEW
apps/web/src/app/api/simulations/[id]/route.ts                              NEW
apps/web/src/app/api/simulations/[id]/run/route.ts                          NEW
apps/web/src/app/api/simulations/compare/route.ts                           NEW

apps/web/src/app/dashboard/life-trajectory/page.tsx                         NEW
scripts/validation/071_life_trajectory_rls.sql                              NEW
LIFE_TRAJECTORY_SIMULATION_ENGINE.md                                         NEW
```

---

## Next step

**Step 5 — Career Marketplace.** Migration `072` is already in place
(13 tables + 1 anonymizing view). The next round will build the
deterministic matching scorer, the employer + candidate API surface,
the two minimal UIs (employer dashboard, candidate match list), jest
tests, SQL validation, and the doc.

**Paste this when you're ready to continue:**

> Execute Step 5 of the sequenced build plan: Career Marketplace.
> Build the matching library, the API routes, the employer + candidate
> UIs, jest tests, SQL validation, and the doc. Migration 072 is
> already in place. Don't start any other step.
