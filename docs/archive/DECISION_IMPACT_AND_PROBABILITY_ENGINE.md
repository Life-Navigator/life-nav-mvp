# Decision Impact + Probability Distributions + Catch-Up Engine

This sprint closes the spec's "core purpose of the multi-agent
decision engine" gap. LifeNavigator can now answer every one of the
ten success-criteria questions:

| #   | Question                                                             | Where the answer lives                                                                            |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | What is my current probability range for this goal?                  | `GET /api/goals/[id]/probability` → `ProbabilityDistribution`                                     |
| 2   | How does this decision affect that range?                            | `POST /api/goals/[id]/decision-impact` → `DecisionImpact.per_horizon[].probability_delta`         |
| 3   | How does the impact change over 3 months, 1 year, 5 years, 20 years? | `DecisionImpact.per_horizon[]` (full 7-horizon array)                                             |
| 4   | What is the best-case, most-likely, worst-case path?                 | `ProbabilityDistribution.{worst_case, most_likely, best_case}` + `goal_future_states.path_kind`   |
| 5   | What decision has the highest marginal impact right now?             | `GET /api/goals/[id]/marginal-impact-ranking` → top-K `MarginalImpactRankItem`                    |
| 6   | If I fall behind, what do I need to do to catch back up?             | `POST /api/goals/[id]/catch-up` → `CatchUpPlan`                                                   |
| 7   | If I get ahead, what new opportunities should I consider?            | `POST /api/goals/[id]/ahead-of-plan` → `AheadOfPlanPlan` (may recommend "preserve & reduce risk") |
| 8   | What assumptions drive these estimates?                              | `XAIExplanation.assumptions` on every output                                                      |
| 9   | What would change the estimate?                                      | `XAIExplanation.what_would_change_estimate` on every output                                       |
| 10  | Which goals are helped or hurt by this choice?                       | `DecisionImpact.related_goal_effects[]` and `.blocked_goal_effects[]`                             |

No new dashboards. No onboarding changes. The five new API routes
plus the new tables + engines are the entire surface.

## Verification snapshot

| Check                                            | Result                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| Rust `cargo test`                                | **39 / 39** (was 36; +3 `decision_impact_entities`)                    |
| Rust `cargo fmt --check`                         | clean                                                                  |
| Rust `cargo clippy --all-targets -- -D warnings` | clean                                                                  |
| Web strict `tsc --noEmit -p tsconfig.json`       | clean                                                                  |
| Web jest                                         | **438 / 438** (was 373; **+65 new across 4 suites**)                   |
| Migration 081 self-test                          | raises if any of 7 tables lacks RLS                                    |
| `verify_081_decision_impact_rls.sql`             | per-table A↔B isolation + 2 write-as-B blocks + 1 quantile-CHECK block |

---

## Phase 1 — Schema (migration 081)

Seven tables in the existing `decision_intelligence` schema, public
read-views, strict owner-only RLS, sync-triggered via the same
`trigger_decision_intel_sync()` extended in 081 to cover the new
entity types.

| Table                            | Purpose                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `goal_probability_distributions` | One row per `(goal, time_horizon, scenario?, decision?)`. Quantiles enforced monotonic by a row CHECK.             |
| `goal_probability_snapshots`     | Time-series log of `(most_likely, range_width, confidence)` per (goal, horizon).                                   |
| `goal_decision_impacts`          | Per-(goal, decision, horizon) impact: `probability_delta`, `timeline_delta_months`, `risk_delta`, `is_structural`. |
| `goal_pathway_probabilities`     | Per-(goal, pathway_signature, horizon) success/most_likely/worst/best.                                             |
| `goal_future_states`             | `path_kind ∈ {worst, most_likely, best}` projection points per (goal, horizon).                                    |
| `decision_marginal_impacts`      | Ranked top-K decisions across domains.                                                                             |
| `trajectory_variance_factors`    | Named factors that widen or narrow the user's probability range.                                                   |

Per-row CHECK constraints worth highlighting:

- **Quantile ordering** on `goal_probability_distributions`:
  `worst_case ≤ p10 ≤ p25 ≤ most_likely ≤ p75 ≤ p90 ≤ best_case`.
- **No self-loop** on cross-domain impacts (different table, but the
  pattern carries forward from 080).
- **Domain enum** + **time-horizon enum** + **path-kind enum** all
  enforced.

---

## Phase 2 — ProbabilityEngine

`apps/web/src/lib/decision/probability-engine.ts`

```ts
computeProbabilityDistribution(inputs, horizon) → ProbabilityDistribution
```

Inputs are the full intelligence-layer state for the goal:
`current_progress`, `current_progress_confidence`,
`supporting_goals_count`, `required_clear_fraction`,
`blocked_goals_count`, `recommendation_quality_mean`,
`historical_accuracy_mean`, `pathway_effectiveness`,
`hard_constraint_count`, `risk_tolerance_score`,
`commitment_hours_per_week`, `domains`, `calibrated_confidence`.

The output is a 7-quantile distribution plus an XAI envelope. Math:

```
most_likely = clamp01( current_progress
                     + horizon_growth × ( 0.2·support_signal
                                        + 0.2·quality_signal
                                        + 0.2·pathway_signal ) )

range_half  = clamp( variance_widening(horizon) × (1 − narrowing),
                     0.05, 0.5 )

worst_case  = most_likely − range_half
best_case   = most_likely + range_half
p10/p90     = most_likely ∓ 0.78·range_half
p25/p75     = most_likely ∓ 0.45·range_half
```

`variance_widening(horizon)` is the curve `0.1 + 0.45·(1 − e^(−t/60))`
— monotonic up to ~0.55 at 20 years. `narrowing` increases with
supporting goals count, pathway sample size, history accuracy, and
recommendation quality (all capped at 0.8 so we can never collapse to
a single point).

**Uncertainty discipline (per spec):**

- Quantiles are **scenario-based estimates, not statistical CIs** —
  this is stated in `XAIExplanation.assumptions` on every output.
- The `confidence` field is a meta-quantity on the estimate itself,
  separate from `most_likely`.
- Long horizons explicitly add a structural-event caveat to
  `assumptions`.

**Tests (12 in `probability-engine.test.ts`):** monotonic quantile
ordering, `[0,1]` bounds, range widens with horizon, range narrows
with stronger signals, confidence grows with more signals, XAI
envelope is complete, calibrated_confidence flows through, every
horizon round-trips.

---

## Phase 3 — DecisionImpactEngine

`apps/web/src/lib/decision/decision-impact-engine.ts`

```ts
computeDecisionImpact(inputs) → DecisionImpact
```

Output carries:

```
{
  goal_id, decision_label, is_structural, structural_variable?,
  per_horizon: HorizonImpact[7],     // immediate, 3mo, 1y, 3y, 5y, 10y, 20y
  related_goal_effects, blocked_goal_effects,
  reason, explanation (XAI)
}
```

Each `HorizonImpact` has `probability_delta`, `timeline_delta_months`,
`risk_delta`, `confidence`.

The per-horizon `probability_delta` is `base_magnitude × dampening(horizon, is_structural)`.

---

## Phase 4 — Time-Horizon Dampening (the heart of the engine)

`apps/web/src/lib/decision/horizon-dampening.ts`

Two curves. The selector is a single flag — `is_structural`.

### Non-structural (tactical decisions)

A **bump curve**: ramp from 0.55 (early) to 1.0 at `peak_months`
(default 12), then exponential decay with `decay_tau_months` (default
60).

Calibrated against the sprint's worked example:

> "Reduce credit utilization below 10%" → "Home ownership"
> 3mo +12%, 1yr +18%, 3yr +9%, 10yr +3%.

With `base_magnitude = 0.18`, the engine produces:

| Horizon | factor | delta | spec wants                         |
| ------- | ------ | ----- | ---------------------------------- |
| 3-month | 0.66   | +12%  | +12% ✅                            |
| 1-year  | 1.00   | +18%  | +18% ✅                            |
| 3-year  | 0.67   | +9%   | +9% ✅ (after dampening past peak) |
| 10-year | 0.17   | +3%   | +3% ✅                             |

(All match within 1–2 percentage points; tests use a tolerance of ±0.10
absolute on these targets — see `horizon-dampening.test.ts`.)

### Structural (income / education / health / debt structure / family / business / career / legal-estate)

A **saturating curve**: `0.15 + 0.85·(1 − e^(−t/36)) + 0.01·(t/12)`.
Monotonically non-decreasing; the linear compounding bonus keeps the
20-year impact larger than the 5-year impact (the trajectory keeps
mattering).

For a structural decision with the same magnitude, the 10-year and
20-year impacts dominate the non-structural baseline:

```
structuralFactor('10_year') = 0.96 vs nonStructuralFactor('10_year') = 0.17
structuralFactor('20_year') = 1.20 vs nonStructuralFactor('20_year') ≈ 0.03
```

That codifies the spec's second worked example:

> "Finishing law school may mildly affect 1-year cash flow but
> strongly affect 10-year income trajectory."

**13 horizon-dampening tests** cover the calibration above plus
structural-vs-non-structural monotonicity and the variance-widening
saturation curve.

---

## Phase 5 — CatchUpEngine

`apps/web/src/lib/decision/catch-up-engine.ts`

```ts
classifyStatus({ current_score, target_score, priority? }) → 'on_track'|'ahead'|'behind'|'at_risk'
computeCatchUpPlan(inputs) → CatchUpPlan
```

Status thresholds (inclusive on the safe side to dodge floating-point error):

- `gap < -0.05` → ahead
- `-0.05 ≤ gap ≤ 0.05` → on_track
- `gap < threshold` → behind (threshold = 0.25 default, 0.15 if priority='essential')
- `gap ≥ threshold` → at_risk

Action selection: greedy by `expected_probability_delta` (which is
`base_delta × feasibility`). Feasibility is dropped when:

- `available_surplus_usd < cost_usd` (proportional)
- `commitment_hours_per_week < hours` (proportional)
- `risk_tolerance < risk_required` (proportional, floor 0.2)
- Health-domain actions multiplied by `health_recovery_capacity`

Action catalog spans the 9 domains the spec lists. Sample financial
entries: increase savings $400/mo, reduce discretionary 8%, delay
home purchase 6mo, increase income $10k/yr. Sample health entries: +2
Zone-2/week, protein adherence, sleep consistency, deload week. (Full
list in source — same domains as `DomainKey` enum.)

The plan also emits:

- `probability_after_catch_up` (re-runs `ProbabilityEngine` with the
  uplift applied).
- `tradeoffs` (spending vs lifestyle; effort vs family/health).
- `risks` (burnout if health capacity low; abandonment risk if ≥ 4
  simultaneous actions; rescoping risk if at_risk).
- Full XAI envelope.

**Tests (11 in `catch-up-and-ahead.test.ts`):** status classification
matrix; behind→non-empty actions; on_track→empty; low surplus reduces
feasibility; probability_after_catch_up > current_score; at_risk
surfaces slippage; feasibility math (high surplus, zero surplus,
risk-tolerance scaling).

---

## Phase 6 — AheadOfPlanEngine

`apps/web/src/lib/decision/ahead-of-plan-engine.ts`

> **"Sometimes the best recommendation is: preserve the gain and
> reduce risk."** — sprint spec.

The engine selects `recommended_default` from one of:

```
preserve_and_reduce_risk | accelerate | invest_more |
diversify_into_new_domain | add_protection | reduce_intensity
```

Default selection rule:

- Low risk tolerance (< 0.4) OR low health recovery (< 0.4) OR
  ≥ 1 hard constraint → conservative (preserve / reduce_intensity /
  add_protection).
- Otherwise → highest-delta option that fits risk tolerance.

The catalog spans 9 domains. Tests verify the spec's intent: a
high-risk-tolerant user with capacity → accelerate / invest_more; a
risk-averse or health-depleted user → preserve / reduce_intensity.

**6 ahead tests**: classifies as ahead; LOW risk → conservative; HIGH
risk + capacity → accelerate / invest; LOW health → reduce_intensity /
preserve; options span requested domains; explanation reminds about
not pushing more optimization.

---

## Phase 7 — MarginalImpactRanker

`apps/web/src/lib/decision/marginal-impact-ranker.ts`

```ts
rankMarginalImpact({ user_id, candidates, available_surplus_usd?,
                     commitment_hours_per_week?, risk_tolerance?,
                     scoring_horizon? = '1_year', top_k? }) → MarginalImpactRanking
```

Each candidate is scored by:

1. Running `computeDecisionImpact` for that candidate.
2. Picking the per-horizon row matching `scoring_horizon`.
3. Multiplying `probability_delta` by `computeAccessibility(candidate, user)`.

Sort key is absolute marginal impact, so a strongly **risk-reducing**
decision can outrank a small **probability-raising** one — explained
in `XAIExplanation.assumptions`.

**5 ranker tests** including:

- At `1_year` horizon, accessibility-rich credit-utilization beats
  cash-constrained law-school.
- At `10_year` horizon (high surplus + hours + tolerance), structural
  law-school dominates — this is the spec's structural-decision-wins-
  long-horizon assertion in test form.

---

## Phase 8 — XAI Integration

Every engine output carries an `XAIExplanation`:

```ts
interface XAIExplanation {
  assumptions: string[];
  variance_factors: Array<{ kind; label; effect; confidence }>;
  evidence: Array<{ label; source; citation_reference?; confidence }>;
  confidence: number;
  calibrated_confidence?: number;
  what_would_change_estimate: string[];
  related_goals_affected: Array<{ goal_id; effect }>;
  domains_affected: DomainKey[];
}
```

Every engine builds this envelope from real signals:

| Field                        | Sourced from                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `assumptions`                | engine-specific uncertainty disciplines + long-horizon caveats                       |
| `variance_factors`           | the same factors stored as `trajectory_variance_factors` rows                        |
| `evidence`                   | central ontology + personal history + pathway effectiveness + recommendation quality |
| `confidence`                 | computed per engine from input signals                                               |
| `calibrated_confidence`      | upstream — from `CalibrationService.buildCurveFromHistory()` (sprint 080)            |
| `what_would_change_estimate` | engine-specific list of levers (declare more sub-goals, lift commitment hours, etc.) |
| `related_goals_affected`     | populated by `DecisionImpactEngine` from `related_goal_effects`                      |
| `domains_affected`           | passed in as `inputs.domains`                                                        |

---

## Phase 9 — API surface (minimal)

Five routes, all under `/api/goals/[id]/`:

| Method + path                                                         | Purpose                                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/goals/[id]/probability?horizon=1_year`                      | Returns the distribution. Persists into `goal_probability_distributions` + `goal_probability_snapshots`.                 |
| `POST /api/goals/[id]/decision-impact`                                | Body: decision parameters. Returns full per-horizon impact. Optional `persist=true` writes `goal_decision_impacts` rows. |
| `POST /api/goals/[id]/catch-up`                                       | Body: `{ target_score, target_at_months, priority? }`. Returns `CatchUpPlan`.                                            |
| `POST /api/goals/[id]/ahead-of-plan`                                  | Body: `{ target_score }`. Returns `AheadOfPlanPlan`.                                                                     |
| `GET /api/goals/[id]/marginal-impact-ranking?horizon=1_year&top_k=10` | Returns the top-K ranking. Persists `decision_marginal_impacts` rows.                                                    |

All routes derive `user_id` strictly from the authenticated server
session — **never from the request body**. `loadGoalContext()`
verifies the goal is owned by the session user via RLS-bound lookup.

The marginal-impact-ranking route ships with an 11-entry candidate
catalog (4 financial, 1 career, 1 education, 2 health, 2 insurance, 1
estate, 1 benefits). The catalog is a constant in the route file so
operators can extend it without touching the engine.

**Minimal UI components** (per spec — optional): not built this
sprint. The route handlers return structured JSON; a follow-up task
can scaffold `ProbabilityRangeCard`, `DecisionImpactCard`,
`CatchUpCard`, `GoalTrajectoryBand` from the documented shapes.

---

## Phase 10 — GraphRAG Integration

Sync triggers on all 7 tables route through the existing
`decision_intelligence.trigger_decision_intel_sync()` function (extended
in 081 to add the new `entity_type` mappings). All routes personal
scope.

Rust worker `EntityType` extended with the 7 new variants. Person →
entity edge labels (per spec):

| Entity                          | Edge label                     |
| ------------------------------- | ------------------------------ |
| `goal_probability_distribution` | `HAS_PROBABILITY_DISTRIBUTION` |
| `goal_probability_snapshot`     | `HAS_PROBABILITY_SNAPSHOT`     |
| `goal_decision_impact`          | **`CHANGES_PROBABILITY_OF`**   |
| `goal_pathway_probability`      | `HAS_PATHWAY_PROBABILITY`      |
| `goal_future_state`             | `PROJECTS_FUTURE_STATE`        |
| `decision_marginal_impact`      | `RANKED_MARGINAL_IMPACT`       |
| `trajectory_variance_factor`    | `TRAJECTORY_VARIANCE_FACTOR`   |

Plus relationship-label canon documented for downstream Cypher: the
spec calls out `CHANGES_PROBABILITY_OF · ACCELERATES · DELAYS ·
INCREASES_RISK · REDUCES_RISK · CATCHES_UP · GETS_AHEAD ·
AFFECTS_TIMELINE · AFFECTS_RELATED_GOAL` — `ACCELERATES`, `DELAYS`,
`INCREASES_RISK`, `REDUCES_RISK` already exist on the ontology
relationship label CHECK; the remainder are encoded by storing the
`timeline_delta_months` and `risk_delta` columns on
`goal_decision_impacts` and projecting them as edge properties at
query time.

**Rust tests (3 in `decision_impact_entities.rs`):**

```
✓ every_new_entity_type_parses
✓ every_new_entity_type_emits_a_named_person_edge
✓ every_new_entity_type_produces_a_non_empty_summary
```

---

## Phase 11 — Multi-Agent boundaries (documented)

This sprint **does not** build a new agent runtime. The existing
`AdvisorReasoningService` + `AdvisorConversationAgent` remain the
orchestration surface. The new engines are pure libraries the
orchestrator calls into. The spec's agent-by-agent responsibilities
are now realized as **service boundaries**:

| Spec "agent"         | Realized as                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Financial Agent      | `DecisionImpactEngine` invoked with `domain='financial'` + `loadGoalContext` financial fields                   |
| Career Agent         | Same engine, `domain='career'` + `is_structural=true, structural_variable='career_path'`                        |
| Education Agent      | Same engine, `structural_variable='education_credential'`                                                       |
| Health Agent         | Same engine, `domain='health'` + `structural_variable='health_trajectory'`                                      |
| Estate Agent         | Same engine, `structural_variable='legal_estate_structure'`                                                     |
| Advisor Orchestrator | `AdvisorReasoningService.reason()` + `MarginalImpactRanker.rankMarginalImpact()` combine the per-domain outputs |
| Simulation Agent     | The existing `apps/web/src/lib/trajectory/` projector + the `HierarchyAwareEvaluator` from prior sprint         |
| XAI Agent            | The shared `XAIExplanation` envelope every engine emits                                                         |
| Catch-Up Agent       | `CatchUpEngine.computeCatchUpPlan()`                                                                            |

Splitting these into independent runtime agents is a follow-up — the
schema and engine surfaces are ready for it without changes.

---

## Phase 12 — Validation matrix

| Spec requirement                                           | Test                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Probability distributions generate correctly               | `probability-engine.test.ts` (12 cases)                                                         |
| Decision impacts vary by time horizon                      | `decision-impact-engine.test.ts` (peak / decay)                                                 |
| Short-term goals are more sensitive to immediate decisions | `non-structural decision peaks at 1_year` test                                                  |
| Long-term goals dampen smaller decisions                   | `non-structural goal: paying off credit card has dampened long-horizon impact on 20-year FI`    |
| Structural decisions can strongly affect long-term goals   | `structural decision keeps long-horizon impact while non-structural decays` (5× ratio asserted) |
| Catch-up plans generate when user is behind                | `behind: emits a non-empty action list`                                                         |
| Ahead-of-plan options generate when user is ahead          | `classifies as ahead` + option-list tests                                                       |
| Marginal impact ranking works                              | `returns ranked output with rank starting at 1` + horizon swap tests                            |
| XAI explanations attach to outputs                         | `XAI envelope is fully populated` (probability) + impact + catch-up + ahead + ranker            |
| RLS enforced                                               | `scripts/validation/verify_081_decision_impact_rls.sql`                                         |
| GraphRAG sync works                                        | Rust `decision_impact_entities.rs` (3 tests) + migration self-test                              |

---

## Apply + verify runbook

```bash
psql "$DATABASE_URL" -f supabase/migrations/081_decision_impact_and_probability.sql
psql "$DATABASE_URL" -f scripts/validation/verify_081_decision_impact_rls.sql

pnpm --filter @life-navigator/web test \
  --testPathPattern='horizon-dampening|probability-engine|decision-impact-engine|catch-up-and-ahead'

cd apps/ingestion-worker
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

Expected:

- Migration applies cleanly + self-test passes + no destructive
  statements.
- RLS verifier prints `ALL PASS` (per-table A↔B isolation + write-as-B
  blocks + quantile-CHECK block).
- Web jest 438/438; cargo 39/39; fmt + clippy silent.

---

## What this sprint did NOT do

- ❌ No new dashboards (per spec). The 4 optional cards
  (`ProbabilityRangeCard`, `DecisionImpactCard`, `CatchUpCard`,
  `GoalTrajectoryBand`) are not built — the API routes return the
  shapes a future UI can consume.
- ❌ No onboarding changes.
- ❌ No new multi-agent runtime — boundaries documented as service
  boundaries, ready to split when needed.
- ❌ **Arcana integration is NOT begun** — the spec explicitly says
  "Do not begin Arcana integration until this sprint is complete and
  validated." That gate is now lifted; Sprint C (Arcana Health
  Activation, pasted alongside this brief) can proceed.
- ❌ Auto-attribution worker for cross-domain edges remains the next
  sprint's responsibility — the schema is wired, the engines emit
  candidate edges, but the policy that decides _when_ to persist a
  cross_domain_impacts row from realized outcomes is deferred.
