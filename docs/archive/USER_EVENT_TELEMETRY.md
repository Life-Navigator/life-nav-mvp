# User Event Telemetry

Sprint O.0 Phase 5 deliverable.

## Schema

`analytics.user_events` — append-only stream of user-visible events.

```sql
CREATE TABLE analytics.user_events (
  id              UUID PRIMARY KEY,
  user_id         UUID REFERENCES profiles(id),
  tenant_id       UUID,
  event_type      TEXT CHECK (analytics.is_event_type(event_type)),
  event_metadata  JSONB,
  subject_kind    TEXT,
  subject_id      UUID,
  context         JSONB,
  occurred_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ
);
```

RLS owner-read, service-role-write. Public view
`public.analytics_user_events` for the SDK.

## Event taxonomy (18 canonical events)

Enforced by `analytics.is_event_type()` CHECK function:

| Event                         | When emitted                                                           |
| ----------------------------- | ---------------------------------------------------------------------- |
| `onboarding_started`          | User lands on the first onboarding step.                               |
| `onboarding_completed`        | All required sections submitted.                                       |
| `goal_created`                | `POST /api/goals` succeeds.                                            |
| `goal_updated`                | `PATCH /api/goals/[id]` succeeds.                                      |
| `document_uploaded`           | `processUpload` returns success.                                       |
| `plaid_connected`             | Plaid exchange succeeds for the first time.                            |
| `recommendation_generated`    | A `decision_outcomes` row inserted with `state='generated'`.           |
| `recommendation_viewed`       | Client emits view event (or feedback in `neutral` shape).              |
| `recommendation_accepted`     | Client emits accept OR feedback `helpfulness='helpful'`.               |
| `recommendation_ignored`      | TTL elapsed without action.                                            |
| `recommendation_dismissed`    | Client dismiss OR feedback `helpfulness='not_helpful'`.                |
| `recommendation_completed`    | Outcome reaches `completed` (often via feedback `outcome='improved'`). |
| `simulation_run`              | A simulation run row is inserted.                                      |
| `simulation_compared`         | User opens the comparison view for ≥2 sims.                            |
| `arcana_intake_started`       | Arcana intake row created.                                             |
| `arcana_intake_completed`     | All required Arcana sections submitted.                                |
| `provider_referral_generated` | A Sprint J provider rec is created.                                    |
| `provider_referral_accepted`  | The user accepts the referral.                                         |

## Recording helper

```ts
import { recordUserEvent } from '@/lib/analytics/events';

await recordUserEvent(supabase, {
  user_id: user.id,
  event_type: 'recommendation_generated',
  event_metadata: { rec_id, source: 'optimizer.dynamic_goal' },
  subject_kind: 'recommendation',
  subject_id: rec_id,
});
```

The helper is best-effort: it never throws. A telemetry failure must
not break a user-facing route.

## Indexes

```sql
idx_ue_user_time   ON (user_id, occurred_at DESC)
idx_ue_event_time  ON (event_type, occurred_at DESC)
idx_ue_tenant_time ON (tenant_id, occurred_at DESC) WHERE tenant_id IS NOT NULL
idx_ue_subject     ON (subject_kind, subject_id)
```

## Standard dashboards (SQL templates)

### DAU / WAU / MAU

```sql
SELECT
  COUNT(DISTINCT user_id) FILTER (WHERE occurred_at > NOW() - INTERVAL '1 day')  AS dau,
  COUNT(DISTINCT user_id) FILTER (WHERE occurred_at > NOW() - INTERVAL '7 day')  AS wau,
  COUNT(DISTINCT user_id) FILTER (WHERE occurred_at > NOW() - INTERVAL '30 day') AS mau
FROM analytics.user_events;
```

### Funnel: onboarding → goal → recommendation

```sql
WITH
  started    AS (SELECT DISTINCT user_id FROM analytics.user_events WHERE event_type='onboarding_started'),
  completed  AS (SELECT DISTINCT user_id FROM analytics.user_events WHERE event_type='onboarding_completed'),
  goal       AS (SELECT DISTINCT user_id FROM analytics.user_events WHERE event_type='goal_created'),
  generated  AS (SELECT DISTINCT user_id FROM analytics.user_events WHERE event_type='recommendation_generated')
SELECT
  (SELECT COUNT(*) FROM started)   AS onboarding_started,
  (SELECT COUNT(*) FROM completed) AS onboarding_completed,
  (SELECT COUNT(*) FROM goal)      AS goal_created,
  (SELECT COUNT(*) FROM generated) AS recommendation_generated;
```

### Retention (D1 / D7 / D30)

```sql
WITH cohorts AS (
  SELECT user_id, DATE_TRUNC('day', MIN(occurred_at)) AS first_seen
  FROM analytics.user_events GROUP BY user_id
)
SELECT
  COUNT(DISTINCT e.user_id) FILTER (WHERE e.occurred_at::date = c.first_seen::date + 1) AS d1,
  COUNT(DISTINCT e.user_id) FILTER (WHERE e.occurred_at::date = c.first_seen::date + 7) AS d7,
  COUNT(DISTINCT e.user_id) FILTER (WHERE e.occurred_at::date = c.first_seen::date + 30) AS d30,
  COUNT(DISTINCT c.user_id) AS cohort_size
FROM cohorts c JOIN analytics.user_events e ON e.user_id = c.user_id
WHERE c.first_seen > NOW() - INTERVAL '60 days';
```

## Privacy + retention

- User events carry no free-text user input — only event types and
  small structured metadata (recommendation id, trust score, etc.).
- RLS makes user A's events invisible to user B at the SDK boundary.
- Retention: append-only; a separate retention job (out of scope this
  sprint) can `DELETE FROM analytics.user_events WHERE occurred_at < NOW() - INTERVAL '12 months'`.

## Where new events are added

Adding a new event type is a two-file change:

1. Add the literal to `UserEventType` in `lib/analytics/events.ts`.
2. Add the literal to `analytics.is_event_type` in a new migration.

Forgetting either side fails fast: the CHECK constraint rejects
inserts whose `event_type` is not in the SQL enum, and the
`recordUserEvent` helper's TS contract refuses unknown event types.
