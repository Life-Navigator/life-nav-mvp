# Dynamic Goal Optimizer — Implementation Notes

This is Step 3 of the sequenced build plan
(`SEQUENCED_BUILD_PLAN.md`). Migration `070_dynamic_goal_optimizer.sql`
was already in place from Step 1; this round adds the deterministic
scoring + engine, the API surface, the dashboard page, jest tests, SQL
validation, and the implementation doc.

The optimizer answers a different question than a budget tool. A budget
tells you where your money already goes. The optimizer says: **of the
disposable dollars left this month, where should they go to move your
_real_ goal forward the most?**

## What changed

### Types — `apps/web/src/types/optimizer.ts`

- `AllocationCategory` (13): `emergency_fund`, `high_interest_debt`,
  `low_interest_debt`, `retirement_match`, `retirement_contribution`,
  `hsa_contribution`, `taxable_investing`, `education_investment`,
  `career_development`, `insurance_gap_coverage`,
  `health_wellness_investment`, `home_down_payment_fund`,
  `cash_reserve`.
- `DecisionAxis` (10): mirrors the user_decision_preferences expanded
  set from migration 061.
- `OptimizerInputs` — the canonical snapshot the engine consumes:
  financial profile, debts, insurance, risk, decision preferences,
  career, education, goals, and a `monthly_surplus` to allocate.
- `OptimizerOutput` — stated goal, inferred true goal, confidence,
  per-category allocations (sum equals surplus), tradeoffs, assumptions,
  rationale, and the single next-best-action sentence.

### Scoring library — `apps/web/src/lib/optimizer/scoring.ts`

Per-category scorers, each scoring against 13 dimensions: `net_worth_impact`,
`risk_reduction`, `liquidity_improvement`, `goal_alignment`,
`timeline_urgency`, `tax_advantage`, `interest_rate_spread`,
`behavioral_stress_impact`, `prerequisite_value`,
`credit_readiness_impact`, `home_readiness_impact`,
`career_income_impact`, `health_cost_prevention_impact`.

Decision preferences are applied multiplicatively. For example,
`minimize_stress` boosts `emergency_fund` (×1.35),
`insurance_gap_coverage` (×1.2), `high_interest_debt` (×1.2);
`maximize_long_term_net_worth` boosts `retirement_match` (×1.4) +
`retirement_contribution` (×1.3) + `hsa_contribution` (×1.25) +
`taxable_investing` (×1.2).

The output is pure — `scoreAll(inputs) → CategoryScore[]`. No I/O, no
LLM. The engine in `engine.ts` is the only place that needs the
network.

### Engine — `apps/web/src/lib/optimizer/engine.ts`

Five exported functions:

- **`loadInputs(supabase, userId, surplus, opts)`** — Reads, under RLS:
  `finance.user_financial_profile`, `finance.debts`,
  `insurance_plans`, `user_domain_risk_tolerance`,
  `user_decision_preferences`, `career_profiles`,
  `education_intake`, and active `goals`. Returns the canonical
  `OptimizerInputs`.
- **`inferTrueGoal(inputs)`** — Deterministic surface→root mapping
  (e.g. "pay off my credit cards" → "Reduce financial fragility and
  free up monthly cash flow"). This is the natural LLM adapter point.
- **`scoreAll(inputs)`** — sorted-desc list of `CategoryScore`.
- **`buildAllocation(scores, surplus)`** — normalizes scored categories
  to the surplus using a hard-priority pass (emergency fund, high-APR
  debt, retirement match, insurance gap) then a proportional split,
  with whole-dollar rounding that drifts into `cash_reserve`. The sum
  of all `amount_usd` values equals the input surplus exactly.
- **`run(inputs)`** — top-level convenience that ties everything
  together and produces the full `OptimizerOutput`.

Stamps `engine_version: 'v1'` on every output for reproducibility.

### API routes — `apps/web/src/app/api/optimizer/`

| Path                        | Methods | Behavior                                                                                                                                                                                                          |
| --------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run/route.ts`              | POST    | Loads inputs, runs the engine, persists the run (`goal_interpretations` + `goal_optimizer_runs` + `_inputs` + `_assumptions` + `_allocations` + `_tradeoffs` + `_recommendations`). Returns `{ run_id, output }`. |
| `runs/[id]/route.ts`        | GET     | Returns the full run — header + interpretation + frozen inputs + assumptions + allocations + tradeoffs + recommendations. RLS does the user filter.                                                               |
| `runs/[id]/accept/route.ts` | POST    | Flips pending recommendations to `accepted`, creates a `user_decisions` row + a `user_actions` row so the Decision Engine has a record of the choice for later outcome attribution.                               |
| `runs/[id]/reject/route.ts` | POST    | Marks recommendations `rejected` and records a `user_decisions` row so the engine can learn from the rejection.                                                                                                   |

All routes use `createServerSupabaseClient()` — RLS is the only
permission boundary; `auth.uid()` is the only identity ever trusted.
No `userId` is read from the request body.

### UI — `apps/web/src/app/dashboard/next-dollar-optimizer/page.tsx`

The user enters a monthly surplus and (optionally) a stated goal.
Pressing **Run optimizer** calls the POST endpoint and renders:

- **Inferred goal card** — what they stated, what the engine thinks it
  really means, and a confidence percentage.
- **Recommended allocation** — sorted bars showing each category's
  dollar amount, percentage of surplus, and a short rationale.
- **Tradeoffs** — pairwise comparisons (e.g. match vs high-APR debt,
  HSA vs traditional retirement) with the engine's favored side.
- **Assumptions** — every engine assumption is surfaced so the user
  can see exactly what the recommendation depends on.
- **Next best action** — one prescriptive sentence, plus Accept / Not
  for me buttons that POST to the lifecycle routes.

A standing **compliance banner** makes clear the output is planning
guidance, not specific securities recommendations or individualized
investment advice.

### Tests — `apps/web/src/lib/optimizer/__tests__/engine.test.ts`

16 tests, all pure / no Supabase mocking required:

- **Determinism** — same input → same output every run.
- **Hard-priority routing** — high-APR debt wins when present;
  emergency fund wins when months=0; employer match gets routed when a
  match exists; insurance gap is filled when no medical plan is on
  file.
- **Allocation normalization** — sum equals surplus across $200,
  $500, $1,500, $12,345; no negatives; `share_pct` ∈ [0, 100]; surplus
  of 0 returns empty allocations.
- **Decision-preference weighting** — `minimize_stress` lifts
  emergency-fund allocation vs. the neutral baseline (in the
  uncapped score range); `maximize_long_term_net_worth` does not
  reduce retirement allocations when the match is available.
- **True-goal inference** — "pay off my credit cards" → cash-flow
  intent; "retire early" → portfolio coverage; "save for a house" →
  down-payment reach.
- **Tradeoffs + next best action** — the match-vs-debt tradeoff surfaces
  when both are scored; `nextBestAction` references the top dollar
  allocation.

Total project test count: **201 passed, 0 failed across 16 suites**.

### SQL validation — `scripts/validation/070_dynamic_goal_optimizer_rls.sql`

Single transactional script that ROLLBACKs at the end. Seeds two
users, writes a full end-to-end run for user A across every optimizer
table (interpretation + run + inputs + assumptions + allocations +
tradeoffs + recommendations + outcomes), then:

1. Switches to user A's authenticated role and asserts they can read
   every table.
2. Asserts user A can flip a pending recommendation to `accepted`.
3. Asserts cross-user INSERT (`user_id = user_b` while authenticated as
   A) is blocked.
4. Switches to user B and asserts they see zero of user A's rows.
5. Deletes the parent run as user A and asserts every child row
   (allocations, tradeoffs, recommendations, outcomes, assumptions,
   inputs) was cascade-deleted.
6. Prints `ALL ASSERTIONS PASSED for migration 070` on success.

Run:

```bash
psql "$DATABASE_URL" -f scripts/validation/070_dynamic_goal_optimizer_rls.sql
```

### Verification

- `tsc --noEmit -p tsconfig.json` → **clean (0 errors)**
- `eslint` over every new/modified file → **clean**
- `jest` → **201 passed, 0 failed**

## Compliance contract

The engine output is bounded by the assumptions it persists on every
run:

| Assumption                               | Value                        | Rationale                                                                                                                      |
| ---------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `planning_language_only`                 | `true`                       | The output is planning guidance, never a recommendation of specific securities, products, or individualized investment advice. |
| `expected_return_long_term_pct`          | `0.07`                       | Long-run real-return assumption used to compare paying down low-APR debt vs investing. Conservative.                           |
| `safe_apr_threshold_for_payoff_priority` | `0.10`                       | Debts at 10%+ APR get hard-priority treatment because the guaranteed return outpaces typical portfolio expectations.           |
| `emergency_fund_target_months`           | `6`                          | Six months of expenses is the "complete" target.                                                                               |
| `engine_input_source`                    | `supabase_user_owned_tables` | Every input was loaded via RLS from the user's own rows — no cross-user data is ever read.                                     |

The compliance banner on the dashboard repeats this in the user's
language. The optimizer never names specific securities, never
recommends specific products, and never frames its output as
individualized investment advice.

## How to deploy

1. Migration is already pushed
   (`supabase/migrations/070_dynamic_goal_optimizer.sql`).
2. Push the API + UI as part of the normal Vercel deploy.
3. Smoke-test from `/dashboard/next-dollar-optimizer`:
   - Set a surplus, run the optimizer.
   - Verify the allocations sum to the surplus.
   - Accept the plan, then check
     `select * from goal_optimizer_runs where user_id = auth.uid() order by created_at desc limit 1` —
     the run, allocations, recommendations, and a new `user_decisions`
     row should all be present.

## Intentionally deferred

- **LLM upgrade of `inferTrueGoal`** — the engine exposes a clean
  adapter point. Replacing it with a Gemini / Anthropic call doesn't
  change persistence or the UI.
- **Run history list / re-run on schedule** — `goal_optimizer_runs`
  already supports it; the UI shows only the latest. Add a
  `/dashboard/next-dollar-optimizer/history` page when needed.
- **Outcome attribution job** — `goal_optimizer_outcomes` is wired but
  empty. A worker that observes net-worth deltas in the 30 days
  after an accepted run will start filling it.
- **GraphRAG triggers for the new tables** — follow the pattern in
  `055_graphrag_expanded_triggers.sql`.

## File map

```
apps/web/src/types/optimizer.ts                                             NEW
apps/web/src/lib/optimizer/scoring.ts                                       NEW
apps/web/src/lib/optimizer/engine.ts                                        NEW
apps/web/src/lib/optimizer/__tests__/engine.test.ts                         NEW

apps/web/src/app/api/optimizer/run/route.ts                                 NEW
apps/web/src/app/api/optimizer/runs/[id]/route.ts                           NEW
apps/web/src/app/api/optimizer/runs/[id]/accept/route.ts                    NEW
apps/web/src/app/api/optimizer/runs/[id]/reject/route.ts                    NEW

apps/web/src/app/dashboard/next-dollar-optimizer/page.tsx                   NEW
scripts/validation/070_dynamic_goal_optimizer_rls.sql                       NEW
DYNAMIC_GOAL_OPTIMIZER_IMPLEMENTATION.md                                     NEW
```

---

## Next step

**Step 4 — Life Trajectory Simulation Engine.** Migration `071` is
already in place. The next round will build:

- `apps/web/src/lib/trajectory/projector.ts` — month-by-month projector
  (net worth, income, debt, savings, emergency-fund months, health-cost
  exposure).
- `apps/web/src/lib/trajectory/generator.ts` — builds the canonical 5
  paths (current behavior / conservative / balanced / aggressive /
  goal-optimized).
- API routes: `POST /api/simulations/create`, `POST /api/simulations/[id]/run`,
  `POST /api/simulations/compare`, `GET /api/simulations/[id]`.
- Minimal `/dashboard/life-trajectory` page.
- Tests for projector determinism + SQL validation for 071 + the
  implementation doc.

**Paste this when you're ready to continue:**

> Execute Step 4 of the sequenced build plan: Life Trajectory
> Simulation. Build the projector + generator, the four API routes,
> minimal UI, jest tests, SQL validation, and the doc. Migration 071
> is already in place. Don't start any other step.
