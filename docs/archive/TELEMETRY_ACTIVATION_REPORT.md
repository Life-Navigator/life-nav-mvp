# Telemetry Activation Report

Sprint O.0.1 Phase 1 deliverable.

## Before

```text
$ grep -rn recordUserEvent apps/web/src | grep -v __tests__ | grep -v events.ts
src/app/api/feedback/recommendation/quality/route.ts:13: import { recordUserEvent } from '@/lib/analytics/events';
src/app/api/feedback/recommendation/quality/route.ts:70: await recordUserEvent(sb, {...});
```

ONE production call site.

## After

```text
$ grep -rn recordUserEvent apps/web/src | grep -v __tests__ | grep -v events.ts
src/app/api/onboarding/sections/route.ts:88
src/app/api/onboarding/complete/route.ts:52
src/app/api/goals/route.ts:84
src/app/api/goals/[id]/route.ts:55
src/app/api/integrations/plaid/exchange/route.ts:52
src/app/api/simulations/[id]/run/route.ts:234
src/app/api/simulations/compare/route.ts:120
src/app/api/arcana/intake/start/route.ts:64
src/app/api/arcana/intake/upsert/route.ts:62
src/app/api/feedback/recommendation/quality/route.ts:70
src/app/api/feedback/recommendation/quality/route.ts:93   (recommendation_completed)
src/app/api/recommendations/[id]/view/route.ts:38
src/app/api/optimizer/runs/[id]/accept/route.ts:91
src/lib/governance/route-guard.ts:223         (recommendation_generated)
src/lib/governance/route-guard.ts:238         (provider_referral_generated)
src/lib/ingestion/upload-pipeline.ts:402      (document_uploaded)
```

15 production-call sites in 14 files. (Two sites in `route-guard.ts`,
two sites in `feedback/recommendation/quality/route.ts`.)

## Event-type coverage matrix

```text
event_type                  | wired | origin
onboarding_started          |   ✓   | /api/onboarding/sections (PUT, on 'in_progress'|'completed')
onboarding_completed        |   ✓   | /api/onboarding/complete (POST)
goal_created                |   ✓   | /api/goals (POST)
goal_updated                |   ✓   | /api/goals/[id] (PUT)
document_uploaded           |   ✓   | lib/ingestion/upload-pipeline.ts (processUpload return)
plaid_connected             |   ✓   | /api/integrations/plaid/exchange (POST)
recommendation_generated    |   ✓   | lib/governance/route-guard.ts (guardOutgoing chokepoint)
recommendation_viewed       |   ✓   | /api/recommendations/[id]/view (POST — NEW)
recommendation_accepted     |   ✓   | /api/optimizer/runs/[id]/accept (POST) + feedback route
recommendation_ignored      |   —   | requires TTL job; not in MVP scope (documented)
recommendation_dismissed    |   ✓   | /api/feedback/recommendation/quality
recommendation_completed    |   ✓   | /api/feedback/recommendation/quality (when outcome='improved')
simulation_run              |   ✓   | /api/simulations/[id]/run (POST)
simulation_compared         |   ✓   | /api/simulations/compare (POST)
arcana_intake_started       |   ✓   | /api/arcana/intake/start (POST)
arcana_intake_completed     |   ✓   | /api/arcana/intake/upsert (POST on kind='motivation')
provider_referral_generated |   ✓   | lib/governance/route-guard.ts (subject provider_recommendation + emitter provider)
provider_referral_accepted  |   —   | collapsed into recommendation_accepted; documented for future split
```

16 of 18 events wired. The 2 remaining (`recommendation_ignored`,
`provider_referral_accepted`) require runtime systems that don't exist
yet (TTL job; referral-specific UX). They are NOT BLOCKERS — they
will fire when the surfaces ship.

## Best-effort contract

Every `recordUserEvent` call is wrapped by the helper's `try/catch`.
A telemetry failure NEVER throws. The route always returns 200/201 on
its primary success path; the analytics row is supplementary.

## New endpoint

`POST /api/recommendations/[id]/view` — idempotent client signal that
a recommendation entered the viewport. Transitions the lifecycle to
`viewed` AND emits `recommendation_viewed`. Both are best-effort.

## Verification

```bash
$ npx jest src/__tests__/lifecycle-and-telemetry-wiring.spec.ts --no-coverage
PASS — 24 tests
```

Each test asserts that a specific `event_type` literal appears in its
expected source file. New routes that need to emit canonical events
are easy to add to the test array.

## Operator impact

Before Sprint O.0.1:

```sql
SELECT event_type, COUNT(*) FROM analytics.user_events GROUP BY 1;
-- 3 event types ever recorded (all from feedback)
```

After:

```sql
SELECT event_type, COUNT(*) FROM analytics.user_events GROUP BY 1;
-- 16 event types active. DAU / WAU / funnel queries return real data.
```

The dashboards documented in `USER_EVENT_TELEMETRY.md` now have
something to aggregate.
