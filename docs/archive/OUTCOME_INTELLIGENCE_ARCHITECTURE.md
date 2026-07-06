# Outcome Intelligence Architecture

Sprint O deliverable.

## Mission

Transform LifeNavigator from a recommendation engine into an
**outcome improvement engine**. The platform must be able to prove
which recommendations improve lives.

## Position in the stack

```
Sprint L          regex governance
Sprint L2         constitutional governance + crisis + future preservation
Sprint N.2        injection defense + multimodal scan
Sprint N.3        character layer (8 dimensions, family table, trusted advisor)
Sprint O.0+O.0.1  measurement: events + outcomes + feedback + character analytics
Sprint O          outcome intelligence — proves which recs improved lives
```

Outcome intelligence COMPOSES with every layer above. It NEVER overrides them.

## Hard safety contract

```
Outcome optimization may NEVER override:
  Constitutional Governance
  Character Layer
  Safety Layer
  Future Preservation
```

Implemented as a single chokepoint in
`lib/outcome-intelligence/safety-gate.ts`. A recommendation is
"safety compliant" iff:

1. `governance_approved === true`
2. `constitutional_verdict ∈ {APPROVE, APPROVE_WITH_MODIFICATION}`
3. `character_needs_regeneration === false`
4. `character_dignity_violation === false`
5. `character_family_table_passes === true`
6. `character_trusted_advisor_passes === true`
7. `character_flourishing_harming_axes` does NOT contain `health` /
   `safety` / `financial`
8. `risk_level ∈ {LOW, MODERATE}` (HIGH / CRITICAL is a crisis state
   where optimization defers entirely)

Every score-producing helper either accepts only safety-compliant
inputs OR forces non-compliant rows to a 0 score with
`is_safety_compliant: false`. Optimizers consuming these signals
cannot push for unsafe outcomes by construction.

## Component map

```
┌─────────────────────────────────────────────────────────────────┐
│                  Outcome Intelligence                          │
│                                                                │
│  ┌──────────────┐  ┌────────────────────┐  ┌────────────────┐  │
│  │ SafetyGate   │  │ EffectivenessScore │  │ DecisionQuality│  │
│  │ filter       │  │ per-recommendation │  │ Index          │  │
│  │ unsafe recs  │  │ composite [0,1]    │  │ per-user [0,1] │  │
│  └──────────────┘  └────────────────────┘  └────────────────┘  │
│                                                                │
│  ┌──────────────┐  ┌────────────────────┐  ┌────────────────┐  │
│  │ Attribution  │  │ GoalAchievement    │  │ LifeProgress   │  │
│  │ Engine       │  │ milestones +       │  │ Engine         │  │
│  │ rec → goal Δ │  │ summarize          │  │ 9 axes + trend │  │
│  └──────────────┘  └────────────────────┘  └────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ EnterpriseReporting                                      │  │
│  │ per-tenant aggregate, NO per-user identifiers            │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Data flow

```
recommendation generated  →  guardOutgoing → decision_governance_audit
                              (governance + character + injection captured)
                                  ↓
                          recordRecommendationGenerated
                                  ↓
                          decision_outcomes (state=generated, governance_audit_id)
                                  ↓
[viewed / accepted / dismissed / completed events arrive]
                                  ↓
                          transitionOutcome → state machine + history
                                  ↓
[user provides feedback (helpful/clear/trust/outcome)]
                                  ↓
                          feedback.recommendation_quality
                                  ↓
[goal progress changes — periodic snapshots]
                                  ↓
                          outcome.goal_progress_snapshots
                                  ↓
        ┌─────────────────────────────────────────────┐
        ▼                                             ▼
  AttributionEngine                              SafetyGate
  links rec → goal-progress                      filter unsafe contexts
        ▼                                             ▼
  outcome.attribution_links                  EffectivenessScore (per rec)
                                                      ▼
                                              outcome.recommendation_effectiveness
                                                      ▼
                                              DecisionQualityIndex (per user/window)
                                                      ▼
                                              outcome.decision_quality_index
                                                      ▼
                                              LifeProgress (9 axes, trend)
                                                      ▼
                                              outcome.life_progress_snapshots
                                                      ▼
                                              EnterpriseReporting (per tenant)
                                                      ▼
                                              outcome.tenant_reports
```

## Files shipped

| Module                 | File                                                              |
| ---------------------- | ----------------------------------------------------------------- |
| Types + thresholds     | `apps/web/src/lib/outcome-intelligence/types.ts`                  |
| Safety gate            | `apps/web/src/lib/outcome-intelligence/safety-gate.ts`            |
| Effectiveness score    | `apps/web/src/lib/outcome-intelligence/effectiveness-score.ts`    |
| Decision Quality Index | `apps/web/src/lib/outcome-intelligence/decision-quality-index.ts` |
| Attribution engine     | `apps/web/src/lib/outcome-intelligence/attribution-engine.ts`     |
| Goal achievement       | `apps/web/src/lib/outcome-intelligence/goal-achievement.ts`       |
| Life progress          | `apps/web/src/lib/outcome-intelligence/life-progress.ts`          |
| Enterprise reporting   | `apps/web/src/lib/outcome-intelligence/enterprise-reporting.ts`   |
| Module entry           | `apps/web/src/lib/outcome-intelligence/index.ts`                  |

| Schema                             | File                                               |
| ---------------------------------- | -------------------------------------------------- |
| 6 tables + RLS + views + self-test | `supabase/migrations/102_outcome_intelligence.sql` |

| API                                             | File                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `GET /api/outcomes/me?window_days=30`           | `apps/web/src/app/api/outcomes/me/route.ts`                          |
| `GET /api/platform/tenants/[id]/outcome-report` | `apps/web/src/app/api/platform/tenants/[id]/outcome-report/route.ts` |

| Tests                   | File                                     |
| ----------------------- | ---------------------------------------- |
| Module tests (40 tests) | `__tests__/outcome-intelligence.spec.ts` |

## Persistence model

Six tables under the new `outcome` schema:

| Table                          | Cardinality                       | Purpose                                                      |
| ------------------------------ | --------------------------------- | ------------------------------------------------------------ |
| `recommendation_effectiveness` | 1 per recommendation              | Composite + sub-scores; carries `is_safety_compliant` flag   |
| `decision_quality_index`       | 1 per (user, window, computed_at) | Per-user composite over a window                             |
| `attribution_links`            | 0..N per recommendation           | Explicit rec → goal progress link with confidence + lag_days |
| `goal_progress_snapshots`      | 1+ per (user, goal_id)            | Timeline of milestones / completions / reversals             |
| `life_progress_snapshots`      | 1 per (user, window)              | 9-axis trajectory + trend                                    |
| `tenant_reports`               | 1 per (tenant, window)            | Aggregate-only, no per-user identifiers                      |

RLS owner-read on user-scoped tables; tenant-member SELECT on the
tenant report (via `platform.is_tenant_member`). Service-role writes
everywhere.

## How the platform "proves" effectiveness

To answer "did recommendation R improve user U's life?" the system
produces:

```sql
SELECT
  re.recommendation_id,
  re.effectiveness_score,
  re.attribution_links_count,
  array_agg(al.flourishing_axis) FILTER (WHERE al.flourishing_axis IS NOT NULL) AS axes_moved,
  SUM(al.delta) AS aggregate_delta,
  AVG(al.attribution_confidence) AS avg_confidence
FROM outcome.recommendation_effectiveness re
LEFT JOIN outcome.attribution_links al ON al.recommendation_id = re.recommendation_id
WHERE re.user_id = $1
  AND re.is_safety_compliant = TRUE
  AND re.computed_at > NOW() - INTERVAL '90 days'
GROUP BY re.recommendation_id, re.effectiveness_score, re.attribution_links_count
ORDER BY re.effectiveness_score DESC
LIMIT 25;
```

Result: a ranked list of recommendations with measured aggregate
delta to specific flourishing axes and an attribution confidence. The
operator can sort by effectiveness OR by total goal progress lifted
OR by axis affected.

## Test coverage

```
$ npx jest src/lib/outcome-intelligence --no-coverage
PASS — 40 tests in 1 suite
```

Coverage includes:

- Safety gate composition over all 8 disqualifying contexts.
- Effectiveness sub-scores (acceptance, speed, outcome, reversal,
  attribution, character).
- DQI sub-rates and the `computeDqiSafe` safety filter.
- Attribution window enforcement (`MAX_LAG_DAYS`) + confidence
  decay + explicit-pointer boost.
- Goal achievement snapshot kinds (baseline / milestone / reversal /
  completion) + summary peaks + achievement rate.
- Life progress aggregation across attribution + character +
  goal snapshots + trend computation against prior.
- Tenant report aggregation + privacy contract (no user_id in
  serialized output).
- End-to-end: a completed safe rec produces positive attribution →
  effectiveness > 0.6 → DQI > 0.5 → life progress > 0.

## What this layer does NOT do

- It does not GENERATE recommendations. The generator (optimizer
  routes, arcana, provider) lives upstream.
- It does not REWRITE responses. The character layer (Sprint N.3)
  does that.
- It does not call LLMs. Every score is deterministic + auditable.
- It does not blindly maximize accepted-rate. Acceptance is one of
  six DQI inputs; reversal is subtracted; character is required.

## Roadmap (not in scope)

- Cohort outcome comparisons (treatment vs control).
- Causal inference beyond temporal attribution (instrumental
  variables, propensity-matched comparisons).
- Real-time recompute on every recommendation event (today: snapshot
  on demand).
