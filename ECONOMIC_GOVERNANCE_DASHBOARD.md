# Economic Governance Dashboard

Sprint O.0.2 deliverable.

## Endpoint

```
GET /api/ops/economic-dashboard
```

- Authentication: required (Supabase session).
- Authorization: same operator-flag gate as `/api/ops/dashboard`.
- No window parameter — the snapshot covers the current month-to-date
  plus a 7-day window for activity.

## Response shape

```ts
interface EconomicSnapshot {
  generated_at: string;

  spend: {
    mtd_usd: number;
    today_usd: number;
    projected_month_end_usd: number;
    monthly_cap_usd: number;
    remaining_usd: number;
  };

  users: {
    active_7d: number;
    top_cost_7d: Array<{ user_id: string; cost_usd: number }>;
  };

  features: Array<{ feature: string; cost_usd: number }>;
  providers: Array<{ provider: string; cost_usd: number }>;

  uploads: {
    files_7d: number;
    bytes_7d: number;
    bytes_mtd: number;
  };

  budgets: {
    platform_status: string; // NORMAL | INFORMATIONAL | ALERT | HIGH_ALERT | EMERGENCY | HARD_STOP
    users_in_warning: number;
    users_in_throttled: number;
    users_in_blocked: number;
  };

  active_throttles: number;
  active_blocks: number;

  data_freshness: {
    usage_events: string | null;
    platform_budget: string | null;
    abuse_events: string | null;
  };
}
```

## Display intent (operator UX)

Sprint O.0.2 ships the data endpoint only. A rendering layer
is queued for the next sprint. Operators consume the JSON via:

```bash
curl -sS "https://app.example.com/api/ops/economic-dashboard" \
  -H "Cookie: <auth>" \
  | jq '{
      spend: .spend,
      platform_status: .budgets.platform_status,
      top_users: .users.top_cost_7d,
      active: { throttles: .active_throttles, blocks: .active_blocks }
    }'
```

A representative response:

```json
{
  "spend": {
    "mtd_usd": 28.41,
    "today_usd": 1.87,
    "projected_month_end_usd": 56.1,
    "monthly_cap_usd": 500,
    "remaining_usd": 471.59
  },
  "platform_status": "NORMAL",
  "top_users": [
    { "user_id": "8e4f...", "cost_usd": 4.82 },
    { "user_id": "21bc...", "cost_usd": 3.55 }
  ],
  "active": { "throttles": 0, "blocks": 0 }
}
```

## Alert rules (operator configures)

| Trigger                                                  | Action                              |
| -------------------------------------------------------- | ----------------------------------- |
| `budgets.platform_status === 'EMERGENCY'`                | Page on-call                        |
| `budgets.platform_status === 'HARD_STOP'`                | Page on-call + halt new sign-ups    |
| `spend.projected_month_end_usd > 0.85 * monthly_cap_usd` | Slack notification                  |
| `active_blocks > 0`                                      | Slack notification (review user)    |
| `active_throttles > 5`                                   | Slack notification (broad pattern?) |
| `data_freshness.usage_events older than 1 hour`          | Page on-call (meter is broken)      |

These are documented for the operator. Sprint O.0.2 does NOT
auto-provision the alerts into a monitoring stack — that's the
operator's preflight step (see `INTERNAL_BETA_LAUNCH_RUNBOOK.md`).

## Projection methodology

`spend.projected_month_end_usd` is a linear projection:

```
avg_daily = mtd_usd / day_of_month
projected = mtd_usd + avg_daily * days_remaining_in_month
```

Deliberate simplicity. The projection is:

- Accurate when daily activity is roughly constant.
- Slightly low at the start of the month (cold start, low denominator).
- Slightly high at end-of-month (no decay).

For a more sophisticated projection (weekend bias, ramp curves) the
operator can query `economic.usage_events` directly with whatever
SQL window they prefer.

## Data freshness

Same pattern as the regular operator dashboard (Sprint O.0.1):

- `data_freshness.usage_events = null` → no usage events written in
  the window. Either nobody's calling providers (cold start) or the
  meter is broken.
- `data_freshness.platform_budget = null` → singleton row never
  updated. Initial deploy or migration not applied.
- `data_freshness.abuse_events = null` → no abuse detected, OR the
  detector isn't running.

## Resilience

Same per-block try/catch pattern as the regular dashboard. A partial
failure (e.g. a fresh database where `economic.usage_events` has no
rows yet) does not zero the whole snapshot.

## Tests

`apps/web/src/lib/ops/__tests__/economic-dashboard-queries.spec.ts`
ships 2 tests:

- Empty fixture returns the shape with zeros + default monthly cap +
  null freshness fields.
- Populated fixture aggregates spend, top users (sorted), top features
  (sorted), provider breakdown, user-budget statuses, breaker states.

## Adding a new metric

If a future sprint needs `tenant_breakdown` or `avg_cost_per_session`,
the workflow is:

1. Add the field to `EconomicSnapshot` type in
   `lib/ops/economic-dashboard-queries.ts`.
2. Add the aggregation try/catch block in `computeEconomicSnapshot`.
3. Initialize the field to a safe default in the snapshot literal.
4. Add a test that asserts the field is populated when its source
   data is present.

## What this dashboard does NOT show

Listed transparently:

- **Per-tenant breakdowns.** Snapshot is platform-wide. When the
  platform onboards its first paying tenant, the dashboard should
  carry per-tenant rollups.
- **Historical drilldown.** This is a NOW snapshot — current month
  plus current week. For historical investigation, query
  `economic.usage_events` directly.
- **Vendor invoice reconciliation.** The numbers are based on
  published rates × measured units. Actual vendor invoices may
  differ for various reasons. Reconciliation is a Closed-Beta task.
