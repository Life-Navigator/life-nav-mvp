# Outcome Attribution Engine

Sprint O deliverable.

## Mission

Answer the question: **which recommendation produced which goal
progress?**

This is the load-bearing question for "the platform can prove which
recommendations improve lives". Without attribution, the platform
can show effectiveness only correlatively. With attribution, it can
point at a specific recommendation, a specific goal, a specific
delta, and an explicit confidence.

## Method (deterministic, no LLM)

For each pair (recommendation R, snapshot S):

1. **Goal must match.** Either `R.goal_id === S.goal_id` OR
   `S.recommendation_id === R.id` (an explicit pointer left by the
   recommendation flow).
2. **Time order must be correct.** S must be recorded AFTER
   R's decision_time (the moment the user accepted or completed it,
   or — failing those — when they viewed it).
3. **Within window.** The lag between R.decision_time and
   S.recorded_at must be ≤ `MAX_LAG_DAYS` (default 90).
4. **Compute delta.** Baseline = the most recent snapshot for the
   goal STRICTLY BEFORE R.decision_time (or a synthetic 0-baseline
   if none). delta = S.progress_pct − baseline.progress_pct (clamped
   to [-1, 1]).
5. **Confidence with decay.** A linear decay over the lag window:
   - Explicit pointer (`S.recommendation_id === R.id`): base 0.7 +
     0.2 boost, scaled by `(1 − lag_days/MAX_LAG_DAYS)`.
   - Implicit (goal_id match): base 0.45, scaled by
     `(1 − lag_days/MAX_LAG_DAYS)`.

Multiple snapshots within the window produce multiple links — each
snapshot's delta is measured against the prior snapshot (rolling
baseline) so a sequence of milestones each get their own attribution.

## Safety contract

Non-compliant recommendations produce zero attribution links, no
matter how cleanly their timing matches the goal. The safety gate
runs FIRST.

```ts
if (!checkSafety(r.context).is_safety_compliant) continue;
```

The intent: a recommendation that violated governance or character
cannot produce "positive outcome attribution" that the optimizer
might later use to justify similar recommendations. Outcome
optimization is denied the data point.

## Output

```ts
interface AttributionLink {
  recommendation_id: string;
  user_id: string;
  goal_id?: string;
  delta: number; // [-1, 1]
  attribution_confidence: number; // [0, 1]
  flourishing_axis?: FlourishingAxis;
  lag_days: number;
}
```

Persisted to `outcome.attribution_links`. RLS owner-read.

## Worked examples

### Example 1: explicit-pointer success

```
Rec:      rec_save_3mo (accepted T=2026-05-10)
Goal:     goal_emergency_fund
Baseline: 2026-05-05, progress_pct = 0.10
Snapshot: 2026-06-15 (lag 36 days), progress_pct = 0.60
          recommendation_id = rec_save_3mo (explicit pointer)

delta            = 0.60 − 0.10 = 0.50
lag_factor       = 1 − 36/90    = 0.60
confidence       = 0.7·0.60 + 0.2 = 0.62
```

The link is created with delta +0.50, confidence 0.62.

### Example 2: implicit goal_id match

```
Rec:      rec_walk_15min  (completed T=2026-04-01)
Goal:     goal_daily_activity
Baseline: 2026-03-25, progress_pct = 0.20
Snapshot: 2026-04-30 (lag 29 days), progress_pct = 0.55

delta            = 0.55 − 0.20 = 0.35
lag_factor       = 1 − 29/90    = 0.68
confidence       = 0.45·0.68    = 0.306
```

The link is created with delta +0.35, confidence 0.31. Lower
confidence than the explicit-pointer case — this could also have
been caused by something the platform didn't recommend (a friend's
suggestion, a new routine).

### Example 3: sequential milestones

```
Rec:        rec_pay_off_card  (accepted T=2026-01-15)
Snapshots:
  2026-01-01  progress = 0.00 (baseline)
  2026-02-15  progress = 0.20 (lag 31)
  2026-03-15  progress = 0.50 (lag 59)
  2026-04-15  progress = 1.00 (lag 90)

Links:
  1) delta 0.20, lag 31, confidence ≈ 0.45·0.66 = 0.30
  2) delta 0.30, lag 59, confidence ≈ 0.45·0.34 = 0.15
  3) delta 0.50, lag 90, confidence ≈ 0.45·0.00 = 0.00
```

Three links are produced — the recommendation's attributed effect
decays as time passes. The aggregate delta is +1.00 across the
sequence; the recommendation is the prime mover for the goal.

### Example 4: out-of-window — no link

```
Rec:      rec_old (accepted T=2025-06-01)
Snapshot: 2025-12-01 (lag ~183 days)

Outside MAX_LAG_DAYS (90). No link.
```

A late snapshot is NOT attributed to a long-ago recommendation. The
recommendation's "outcome window" has expired.

## Aggregation

```sql
-- Top recommendations by aggregate attributed delta over 90 days
SELECT
  al.recommendation_id,
  al.flourishing_axis,
  COUNT(*)                            AS links,
  SUM(al.delta)                       AS aggregate_delta,
  AVG(al.attribution_confidence)      AS avg_confidence,
  SUM(al.delta * al.attribution_confidence) AS confidence_weighted_delta
FROM outcome.attribution_links al
WHERE al.user_id = $1
  AND al.attributed_at > NOW() - INTERVAL '90 days'
GROUP BY al.recommendation_id, al.flourishing_axis
HAVING SUM(al.delta * al.attribution_confidence) > 0
ORDER BY confidence_weighted_delta DESC
LIMIT 25;
```

The `confidence_weighted_delta` column is the load-bearing metric
for "which rec actually improved this user's life?"

## Known limits

- **Single-rec attribution.** A snapshot is attributed to the
  most-recent matching rec; concurrent recommendations on the same
  goal share via separate links, but the engine does not split a
  single observed delta across multiple recs. Future work: shared
  attribution via Shapley values.
- **Correlation, not causation.** Even with explicit pointers, the
  engine cannot prove the recommendation CAUSED the change. It can
  prove the recommendation PRECEDED a change of the right shape
  within a plausible window. Causal inference is a Sprint Q+ task.
- **Negative deltas.** A snapshot recording REGRESSION attributes a
  negative delta back to the most recent matching rec. This is
  intentional: the engine has no preference for positive outcomes;
  it reports what happened.
- **Lag distribution is uniform.** The decay is linear over
  MAX_LAG_DAYS. Different goal categories have different "natural"
  outcome timeframes (a workout plan resolves in weeks; a career
  transition resolves in months). Adjusting MAX_LAG_DAYS per
  category is queued for the next sprint.

## Test coverage

```
$ npx jest src/lib/outcome-intelligence/__tests__/outcome-intelligence.spec.ts -t Attribution
PASS — 5 tests
```

Covers: no goal → no link, post-decision snapshot → positive
delta, beyond MAX_LAG_DAYS → no link, explicit pointer boosts
confidence, non-compliant rec excluded from attribution.

Plus the end-to-end test: a completed safe rec produces positive
attribution → effectiveness > 0.6 → DQI > 0.5 → life progress > 0.

## Files

- `apps/web/src/lib/outcome-intelligence/attribution-engine.ts` —
  the engine.
- `supabase/migrations/102_outcome_intelligence.sql` — the
  `attribution_links` table.
- `outcome.attribution_links` — append-only audit; one row per
  attribution event; tied to `recommendation_id` for joins back to
  the audit chain.

## What this engine enables

- The user dashboard can answer "this rec changed my life on these
  axes by this much."
- The operator dashboard can rank recommendations by
  confidence-weighted delta across the cohort.
- The enterprise report can prove platform value via aggregate
  attributed delta to flourishing axes, without leaking per-user
  data.
- Future optimizers can train on attributed outcomes, NOT on raw
  acceptance — which protects against the platform optimizing for
  short-term engagement at the cost of long-term outcomes.
