# Enterprise Outcome Reporting

Sprint O deliverable.

## Mission

Give enterprise tenants (Arcana clinics, employers, partners) a
defensible aggregate measure of platform impact — without exposing
any individual user's data.

This is the artifact that an enterprise customer points at when
asking the platform "what did you do for our users this quarter?"

## What ships

### Schema — `outcome.tenant_reports`

```sql
CREATE TABLE outcome.tenant_reports (
  id                       UUID PRIMARY KEY,
  tenant_id                UUID NOT NULL,
  window_days              INT NOT NULL DEFAULT 30,
  -- Aggregate metrics — no per-user identifiers
  active_users             INT NOT NULL DEFAULT 0,
  recommendations_total    INT NOT NULL DEFAULT 0,
  acceptance_rate          NUMERIC(4,3),
  completion_rate          NUMERIC(4,3),
  avg_effectiveness        NUMERIC(4,3),
  avg_dqi                  NUMERIC(4,3),
  avg_life_progress        NUMERIC(4,3),
  safety_compliance_rate   NUMERIC(4,3),
  metadata                 JSONB NOT NULL DEFAULT '{}',
  computed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, window_days, computed_at)
);
```

RLS: tenant-member SELECT via `platform.is_tenant_member`. Service-role
writes. Public view `public.outcome_tenant_reports`.

### Builder — `computeTenantReport`

Pure function:

```ts
computeTenantReport({
  tenant_id, window_days,
  recommendations,  // every rec the tenant's users received
  dqi_rows,         // per-user DQI snapshots in the window
  life_rows,        // per-user life-progress snapshots in the window
}) → TenantOutcomeReport
```

The function:

1. Counts distinct user_ids → `active_users`.
2. Filters every recommendation through the safety gate; tracks
   `safety_compliant` count.
3. **Acceptance and completion rates are safety-filtered.** Recs that
   failed governance / character / safety never count toward
   acceptance metrics, even if the lifecycle shows the user clicked
   through. This prevents an enterprise from looking good on
   acceptance while shipping unsafe content.
4. `safety_compliance_rate` exposes the gap — the enterprise sees
   how often their cohort was served compliant content.
5. Aggregates per-user DQI and life-progress means.
6. Emits zero per-user identifier — the privacy contract is
   asserted by a serialization test.

### Endpoint — `GET /api/platform/tenants/[id]/outcome-report?window_days=30`

```bash
curl -sS "https://app.example.com/api/platform/tenants/<uuid>/outcome-report?window_days=30" \
  -H "Cookie: <auth>"
```

Returns the latest report row for the tenant. RLS enforces that the
caller is a tenant member; non-members receive 404 (because RLS
filters the row out before the route can return it).

## Sample report

```json
{
  "report": {
    "tenant_id": "8a2e...",
    "window_days": 30,
    "active_users": 312,
    "recommendations_total": 2486,
    "acceptance_rate": 0.652,
    "completion_rate": 0.418,
    "avg_effectiveness": 0.671,
    "avg_dqi": 0.612,
    "avg_life_progress": 0.184,
    "safety_compliance_rate": 1.0,
    "computed_at": "2026-06-01T05:43:21.918Z"
  }
}
```

Interpretation for the enterprise:

- **312 active users** over the last 30 days.
- **2,486 recommendations** delivered.
- **65.2 % acceptance**: of those, **41.8 % were completed**.
- **avg effectiveness 0.67** on the [0, 1] scale.
- **avg DQI 0.61**: the cohort is using the platform well.
- **avg life-progress +0.18**: across all 9 flourishing axes, the
  cohort improved by an average of 0.18 (on a [-1, +1] scale).
- **100 % safety compliance**: every recommendation passed
  governance + character + safety.

## Privacy contract

The single-test enforcement:

```ts
test('serialized report contains no user_ids', () => {
  const r = computeTenantReport({...});
  const serialized = JSON.stringify(r);
  expect(serialized).not.toContain('private_user');
  expect(serialized).not.toContain('user_id');
});
```

The serialization test runs on a fixture that DELIBERATELY threads
a recognizable user_id into the input — and asserts the user_id is
absent from the output. A regression in privacy fails CI.

## What this gives the enterprise

- **Defensible aggregate metrics.** The numbers are computed from
  the platform's primary audit chain, not from a parallel reporting
  system that could drift.
- **Compliance evidence.** `safety_compliance_rate` is the
  contracted statement "we shipped governed content to your users";
  a value < 1.0 is a flag the platform should explain.
- **Effectiveness narrative.** `avg_effectiveness` joined with
  `avg_life_progress` allows the enterprise to say "the platform
  not only delivered recommendations our employees accepted, but
  the recommendations moved measured flourishing axes."
- **No PII exposure.** The enterprise gets aggregate. Drilling down
  to a specific user requires that user to be the caller (RLS
  owner-read on `decision_quality_index` etc).

## What this does NOT give the enterprise

- Per-user dashboards (those exist for the user only).
- Per-user effectiveness scores (those flow to the user).
- The contents of any specific recommendation.
- Causal proof. The report shows correlation between platform use
  and outcomes; whether the platform CAUSED the outcomes is a
  research question. The platform reports what it measured.

## Aggregation cadence

Today: snapshot-on-demand. A nightly job computes a fresh
`tenant_reports` row per active tenant per `window_days` value
(7 / 30 / 90 are typical). The endpoint returns the latest by
`computed_at`.

Future: per-tenant cron with materialized roll-ups when active-user
counts exceed several thousand per tenant.

## Auditability

Every metric in the report can be reconstructed from the underlying
tables. Operators inspecting a report row can verify it by running:

```sql
WITH recs AS (
  SELECT do.recommendation_id,
         do.user_id,
         do.state,
         dga.character_score_overall,
         dga.character_needs_regeneration,
         dga.character_dignity_violation,
         dga.character_family_table_passes,
         dga.character_trusted_advisor_passes,
         dga.character_flourishing_harming_axes,
         dga.constitutional_verdict,
         dga.risk_level,
         dga.approved AS governance_approved
  FROM public.decision_outcomes do
  JOIN public.profiles p ON p.id = do.user_id
  JOIN platform.tenant_users tu ON tu.user_id = p.id
  LEFT JOIN governance.decision_governance_audit dga ON dga.id = do.governance_audit_id
  WHERE tu.tenant_id = $1
    AND do.generated_at > NOW() - INTERVAL '30 days'
)
SELECT
  COUNT(DISTINCT user_id)                                    AS active_users,
  COUNT(*)                                                    AS recommendations_total,
  AVG((state IN ('accepted','completed'))::INT)               AS acceptance_rate_raw,
  AVG((state = 'completed')::INT)                             AS completion_rate_raw,
  AVG((NOT character_needs_regeneration
        AND NOT character_dignity_violation
        AND character_family_table_passes
        AND character_trusted_advisor_passes
        AND COALESCE(constitutional_verdict, '') IN ('APPROVE','APPROVE_WITH_MODIFICATION')
        AND COALESCE(risk_level, 'LOW') NOT IN ('HIGH','CRITICAL')
       )::INT)                                                AS safety_compliance_rate
FROM recs;
```

The report row's `safety_compliance_rate` and `recommendations_total`
should match these aggregates. If they don't, the snapshot is stale
or the writer is broken; the operator runbook documents the triage.

## Test coverage

```
$ npx jest src/lib/outcome-intelligence -t Tenant
PASS — 3 tests
```

Covers: aggregation correctness (active users, safety-filtered
acceptance), empty-window safe defaults, privacy contract (no
user_id in serialized output).

## Files

| File                                                                 | Purpose                        |
| -------------------------------------------------------------------- | ------------------------------ |
| `apps/web/src/lib/outcome-intelligence/enterprise-reporting.ts`      | builder                        |
| `apps/web/src/app/api/platform/tenants/[id]/outcome-report/route.ts` | endpoint                       |
| `supabase/migrations/102_outcome_intelligence.sql`                   | `outcome.tenant_reports` table |

## Operator playbook (when a tenant calls)

1. **"What was our acceptance rate?"** → `acceptance_rate` × 100 %.
2. **"How safe was the content we served?"** →
   `safety_compliance_rate` × 100 %. If < 1.0, investigate.
3. **"Did the platform move the needle?"** → `avg_life_progress`
   over time, plus `avg_dqi`.
4. **"Show me a single user."** → "We can't; your users are the
   only ones who can see their own data. We can aggregate for you;
   we don't surveil for you."
