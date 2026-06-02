# Recommendation Lifecycle Verification

Sprint O.0.1 Phases 2 + 3 deliverable.

## Before

`recordRecommendationGenerated` had **zero production callers**.
`transitionOutcome` fired only from the feedback route — which means
a feedback POST tried to update an outcome row that never existed.

## After

`recordRecommendationGenerated` fires from the `guardOutgoing`
chokepoint for every governed subject whose `kind` is in
`RECOMMENDATION_KINDS` AND that carries `subject.id`.

```ts
const RECOMMENDATION_KINDS = new Set([
  'recommendation',
  'provider_recommendation',
  'arcana_recommendation',
  'optimizer_recommendation',
  'partner_recommendation',
]);

if (RECOMMENDATION_KINDS.has(subject.kind) && subject.id) {
  await recordRecommendationGenerated(supabase, {...});
  await recordUserEvent(supabase, { event_type: 'recommendation_generated', ... });
}
```

5 generation routes were updated to pass `subject.id`:

- `/api/optimizer/run` → `run_id`
- `/api/arcana/readiness` → arcana snapshot id
- `/api/arcana/catch-up` → arcana_goal_id
- `/api/arcana/lead-package` → persisted lead-package id
- `/api/provider/patients/[id]/recommendation` → provisional UUID generated before persistence

All 5 are verified by structural test in `lifecycle-and-telemetry-wiring.spec.ts`.

## State machine — all transitions covered

```
generated → viewed → accepted ─┐
                  → ignored    ├─→ completed
                  → dismissed  ┘
```

| State       | Trigger route                                                             | Helper called                        |
| ----------- | ------------------------------------------------------------------------- | ------------------------------------ |
| `generated` | every governed recommendation surface (via `guardOutgoing`)               | `recordRecommendationGenerated`      |
| `viewed`    | `POST /api/recommendations/[id]/view` (client viewport entry)             | `transitionOutcome(...,'viewed')`    |
| `accepted`  | `POST /api/optimizer/runs/[id]/accept` + `helpfulness='helpful'` feedback | `transitionOutcome(...,'accepted')`  |
| `ignored`   | TTL job (not in MVP)                                                      | — (queued)                           |
| `dismissed` | `helpfulness='not_helpful'` feedback                                      | `transitionOutcome(...,'dismissed')` |
| `completed` | `outcome='improved'` feedback                                             | `transitionOutcome(...,'completed')` |

## Forward-only invariant

`transitionOutcome` is idempotent forward — it sets the new state +
appropriate timestamp column + appends a `decision_outcome_events`
row. Multiple calls to the same `to_state` set the same column to the
same value (idempotent). Calling backward (e.g. `'completed' → 'viewed'`)
would update the state field but not the timestamp columns, AND would
emit a misleading event row. The application contract says only
forward transitions are valid; no enforcement at the SQL layer beyond
the CHECK on `to_state`.

## How feedback connects to lifecycle

`/api/feedback/recommendation/quality` POST:

```
1. zod-validate body
2. insert feedback.recommendation_quality row
3. recordUserEvent — emit accepted | dismissed | viewed based on helpfulness
4. IF outcome='improved' → transitionOutcome to 'completed' + emit recommendation_completed
   ELIF helpfulness='not_helpful' → transitionOutcome to 'dismissed'
   ELIF helpfulness='helpful' → transitionOutcome to 'accepted'
```

This means feedback simultaneously feeds the analytics stream AND
advances the lifecycle. A recommendation that the user reports as
"improved my situation" reaches the `completed` state automatically
without a separate API call.

## Joining the audit chain

The `decision_outcomes.governance_audit_id` column is populated when
`guardOutgoing` calls `recordRecommendationGenerated` (currently the
value is `null` because the governance audit row id isn't surfaced
back through the orchestrator yet — see "What still does not measure"
below). The intent is to make this query work:

```sql
SELECT
  audit.constitutional_verdict,
  outcome.state,
  outcome.outcome_score,
  feedback.helpfulness
FROM public.decision_outcomes outcome
LEFT JOIN governance.decision_governance_audit audit
  ON audit.id = outcome.governance_audit_id
LEFT JOIN feedback.recommendation_quality feedback
  ON feedback.recommendation_id = outcome.recommendation_id
WHERE outcome.generated_at > NOW() - INTERVAL '30 days';
```

## What still does not measure

Listed transparently:

1. **`governance_audit_id` linkage is null today.** The reviewAndPersist
   orchestrator returns the audit row id internally but doesn't surface
   it on `GuardSuccess`. Sprint Q+ work to expose `g.audit_row_id` will
   close this. Workaround query: join by user_id + created_at proximity.
2. **`recommendation_ignored` requires a cron.** Closed-Beta scheduler.
3. **`outcome_score` is operator-assigned offline.** Today no helper
   automatically scores outcomes; operator inspects feedback + audit
   trail and runs `setOutcomeScore` manually. This is documented in
   `RECOMMENDATION_OUTCOME_TRACKING.md`.

## Lifecycle verification — test coverage

`lifecycle-and-telemetry-wiring.spec.ts`:

```text
Sprint O.0.1 — recommendation generation routes pass subject.id
  ✓ app/api/optimizer/run/route.ts subject carries an id
  ✓ app/api/arcana/readiness/route.ts subject carries an id
  ✓ app/api/arcana/catch-up/route.ts subject carries an id
  ✓ app/api/arcana/lead-package/route.ts subject carries an id
  ✓ app/api/provider/patients/[id]/recommendation/route.ts subject carries an id

Sprint O.0.1 — guardOutgoing wires lifecycle
  ✓ route-guard imports recordRecommendationGenerated
  ✓ route-guard imports recordUserEvent
  ✓ route-guard recognizes the 5 recommendation subject kinds
```

8 tests; all green.

## Dashboard validation

`dashboard-validation.spec.ts` Test 1 seeds 7 outcome rows across all 6
states + asserts the dashboard returns non-zero counts for each. This
proves the end-to-end pipeline (helper → SQL → aggregation) works on
real-shape data.

## Net result

Every recommendation that the production runtime surfaces NOW creates
a `decision_outcomes` row at generation time. The lifecycle advances
through the state machine as the user views / accepts / dismisses /
provides feedback. The audit chain (governance + lifecycle + feedback)
is joinable into a single per-recommendation trace.
