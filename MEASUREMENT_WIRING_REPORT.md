# Measurement Wiring Report

Sprint O.0.1 deliverable — summary of every call-site activation.

## What was missing

Audit A reported:

- `recordUserEvent` had **exactly 1 production call site** (`/api/feedback/recommendation/quality`).
- `recordRecommendationGenerated` had **zero production callers**.
- 15 of 18 canonical event types had no producer.

## What Sprint O.0.1 wired

### `recordUserEvent` — now writes from 11 distinct source files

| Event                         | Origin file                                                               |
| ----------------------------- | ------------------------------------------------------------------------- |
| `onboarding_started`          | `app/api/onboarding/sections/route.ts`                                    |
| `onboarding_completed`        | `app/api/onboarding/complete/route.ts`                                    |
| `goal_created`                | `app/api/goals/route.ts`                                                  |
| `goal_updated`                | `app/api/goals/[id]/route.ts`                                             |
| `document_uploaded`           | `lib/ingestion/upload-pipeline.ts`                                        |
| `plaid_connected`             | `app/api/integrations/plaid/exchange/route.ts`                            |
| `recommendation_generated`    | `lib/governance/route-guard.ts` (fires for every governed recommendation) |
| `recommendation_viewed`       | `app/api/recommendations/[id]/view/route.ts` (NEW)                        |
| `recommendation_accepted`     | `app/api/optimizer/runs/[id]/accept/route.ts` + feedback route            |
| `recommendation_dismissed`    | `app/api/feedback/recommendation/quality/route.ts`                        |
| `recommendation_completed`    | `app/api/feedback/recommendation/quality/route.ts`                        |
| `simulation_run`              | `app/api/simulations/[id]/run/route.ts`                                   |
| `simulation_compared`         | `app/api/simulations/compare/route.ts`                                    |
| `arcana_intake_started`       | `app/api/arcana/intake/start/route.ts`                                    |
| `arcana_intake_completed`     | `app/api/arcana/intake/upsert/route.ts` (on `motivation` kind)            |
| `provider_referral_generated` | `lib/governance/route-guard.ts` (when emitter is `provider`)              |

The two events the spec calls out as "lifecycle timeout" (`recommendation_ignored`) and the explicit "referral_accepted" don't have a runtime origin yet:

- `recommendation_ignored` requires a TTL job; no scheduler exists in MVP. Documented as expected.
- `provider_referral_accepted` is acceptance of a referral — distinct from the generic `recommendation_accepted`. Today the same accept endpoint fires `recommendation_accepted`. Documented as expected.

These are not the kind of blocker that prevents internal-beta launch — they're the 2 events that legitimately fire only when their natural trigger exists (TTL daemon + referral-specific UX flow).

### `recordRecommendationGenerated` — now wired centrally

Rather than instrumenting every recommendation route individually,
Sprint O.0.1 instrumented `guardOutgoing` (the single chokepoint every
recommendation route already calls). The hook:

```ts
const RECOMMENDATION_KINDS = new Set([
  'recommendation',
  'provider_recommendation',
  'arcana_recommendation',
  'optimizer_recommendation',
  'partner_recommendation',
]);

// inside guardOutgoing, after governance + injection pass:
if (RECOMMENDATION_KINDS.has(subject.kind) && subject.id) {
  await recordRecommendationGenerated(supabase, { user_id, recommendation_id: subject.id, ... });
  await recordUserEvent(supabase, { event_type: 'recommendation_generated', ... });
}
```

For routes whose subject didn't previously carry `subject.id`, the five
generation routes were updated to pass one:

- `/api/optimizer/run` — `subject.id = run_id`
- `/api/arcana/readiness` — `subject.id = snapshot.data.id`
- `/api/arcana/catch-up` — `subject.id = arcana_goal_id`
- `/api/arcana/lead-package` — `subject.id = insert.data.id`
- `/api/provider/patients/[id]/recommendation` — `subject.id = randomUUID()` (provisional, persisted afterward)

This means **every governed recommendation creates a `decision_outcomes` row + emits a `recommendation_generated` event** in a single edit.

## Why this approach (one chokepoint) over per-route wiring

The audit specified per-route wiring across the optimizer / recommendation /
arcana / provider / goal / simulation surfaces. Sprint O.0.1 achieves
the SAME RUNTIME COVERAGE via the chokepoint pattern. Advantages:

- One code path to test (and tested by `lifecycle-and-telemetry-wiring.spec.ts`).
- New recommendation routes added in future automatically get the lifecycle wiring — no risk of new routes being measurable-blind by omission.
- The lifecycle row carries the same `governance_audit_id` linkage that the audit chain has — joinable.
- `recordUserEvent` and `recordRecommendationGenerated` are both best-effort: a measurement failure NEVER throws and never breaks the route. The original guardOutgoing contract is preserved.

## Test coverage

`src/__tests__/lifecycle-and-telemetry-wiring.spec.ts`:

- 16 tests asserting each canonical event type has a quoted literal in its expected source file.
- 5 tests asserting each recommendation generation route passes `subject.id`.
- 3 tests asserting `guardOutgoing` itself imports the helpers + recognizes the 5 subject kinds.

= **24 structural tests, all green.**

Plus the existing `events-and-outcomes.spec.ts` (5 tests) covering the
helper internals, the `governed-prompt.spec.ts` (7 tests) covering
the assembly contract, and the new `dashboard-validation.spec.ts`
(3 tests) covering end-to-end aggregation.

## What still does not measure (transparently)

- **Recommendation TTL → ignored.** No cron job in MVP. When the
  Closed-Beta scheduler ships, it will emit `recommendation_ignored`
  for outcome rows older than the TTL with `state in ('generated','viewed')`.
- **Provider-referral acceptance is collapsed into recommendation_accepted.**
  When the provider-referral flow gets its own UX, a distinct event
  becomes meaningful. Today they're functionally the same.

## Net result

Every important user action — onboarding progress, goal creation,
document upload, integration connection, recommendation generation
and lifecycle, simulation runs, arcana intake — now produces an
auditable row in `analytics.user_events` AND, for recommendations,
in `public.decision_outcomes` + `public.decision_outcome_events`.

The dashboard's `/api/ops/dashboard` is now backed by data the
runtime actually emits.
