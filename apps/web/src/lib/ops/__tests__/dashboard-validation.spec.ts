/**
 * @jest-environment node
 *
 * Sprint O.0.1 Phase 6 — synthetic-data dashboard validation.
 *
 * Seeds an in-memory supabase mock with synthetic rows across every
 * source table, runs `computeDashboardSnapshot`, and asserts that
 * each metric block shows non-zero, sensible values AND that
 * `data_freshness` carries the synthetic timestamps.
 */

import { computeDashboardSnapshot } from '../dashboard-queries';

// ---------------------------------------------------------------------------
// Synthetic data
// ---------------------------------------------------------------------------

const NOW = Date.now();
const HOURS = 60 * 60 * 1000;
const iso = (offset_h: number) => new Date(NOW - offset_h * HOURS).toISOString();

const FIXTURE: Record<string, unknown[]> = {
  // 4 distinct users across the last 24h.
  analytics_user_events: [
    { user_id: 'u1', occurred_at: iso(1) },
    { user_id: 'u1', occurred_at: iso(2) },
    { user_id: 'u2', occurred_at: iso(3) },
    { user_id: 'u3', occurred_at: iso(5) },
    { user_id: 'u4', occurred_at: iso(23) },
  ],
  decision_outcomes_v: [
    { state: 'generated', updated_at: iso(2), generated_at: iso(2) },
    { state: 'generated', updated_at: iso(4), generated_at: iso(4) },
    { state: 'viewed', updated_at: iso(3), generated_at: iso(5) },
    { state: 'accepted', updated_at: iso(2), generated_at: iso(6) },
    { state: 'completed', updated_at: iso(1), generated_at: iso(20) },
    { state: 'dismissed', updated_at: iso(8), generated_at: iso(9) },
    { state: 'ignored', updated_at: iso(30), generated_at: iso(50) },
  ],
  decision_outcome_events: [{ occurred_at: iso(2) }, { occurred_at: iso(1) }],
  decision_governance_audit: [
    { created_at: iso(2), constitutional_verdict: 'APPROVE', risk_level: 'LOW' },
    { created_at: iso(3), constitutional_verdict: 'APPROVE_WITH_MODIFICATION', risk_level: 'LOW' },
    {
      created_at: iso(4),
      constitutional_verdict: 'CONSTITUTIONAL_REDIRECTION',
      risk_level: 'HIGH',
    },
  ],
  ingestion_files: [{ created_at: iso(2) }, { created_at: iso(5) }],
  ingestion_extraction_telemetry: [
    { created_at: iso(2), status: 'succeeded' },
    { created_at: iso(3), status: 'succeeded' },
    { created_at: iso(4), status: 'failed' },
  ],
  ingestion_malware_scans: [{ created_at: iso(2), status: 'clean' }],
  ops_llm_usage_meter: [
    { created_at: iso(2), provider: 'gemini', cost_usd_micros: 500_000 },
    { created_at: iso(2), provider: 'openai', cost_usd_micros: 250_000 },
    { created_at: iso(3), provider: 'anthropic', cost_usd_micros: 100_000 },
  ],
  security_prompt_injection_events: [
    { created_at: iso(2), severity: 'HIGH' },
    { created_at: iso(3), severity: 'CRITICAL' },
  ],
};

// ---------------------------------------------------------------------------
// Supabase mock — supports the small surface dashboard-queries uses:
//   .from(table).select(cols, { count, head }) .eq().gte().in().order().limit()
// ---------------------------------------------------------------------------

function makeBuilder(rows: unknown[], opts: { count?: string; head?: boolean }) {
  const filters: Array<(r: Record<string, unknown>) => boolean> = [];
  let orderCol: string | null = null;
  let orderAsc = false;
  let limit: number | null = null;

  const builder: Record<string, unknown> = {};
  const apply = () => {
    let out = rows.slice();
    for (const f of filters) out = out.filter((r) => f(r as Record<string, unknown>));
    if (orderCol) {
      out.sort((a, b) => {
        const av = (a as Record<string, unknown>)[orderCol!];
        const bv = (b as Record<string, unknown>)[orderCol!];
        if (av === bv) return 0;
        return ((av as string) < (bv as string) ? -1 : 1) * (orderAsc ? 1 : -1);
      });
    }
    if (limit != null) out = out.slice(0, limit);
    return out;
  };
  builder.eq = (k: string, v: unknown) => {
    filters.push((r) => r[k] === v);
    return builder;
  };
  builder.gte = (k: string, v: unknown) => {
    filters.push((r) => (r[k] as string) >= (v as string));
    return builder;
  };
  builder.in = (k: string, vs: unknown[]) => {
    filters.push((r) => vs.includes(r[k]));
    return builder;
  };
  builder.order = (col: string, o: { ascending: boolean }) => {
    orderCol = col;
    orderAsc = o.ascending;
    return builder;
  };
  builder.limit = (n: number) => {
    limit = n;
    return builder;
  };
  builder.then = (onF: (v: { data: unknown; count?: number; error: null }) => unknown) => {
    const data = apply();
    if (opts.head && opts.count === 'exact') {
      return Promise.resolve({ count: data.length, data: null, error: null }).then(onF);
    }
    return Promise.resolve({ data, error: null }).then(onF);
  };
  return builder;
}

function makeSupabase(fixture: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const rows = fixture[table] ?? [];
      return {
        select(_cols: string, opts?: { count?: string; head?: boolean }) {
          if (opts?.count === 'exact' && opts?.head) {
            return makeBuilder(rows, opts);
          }
          return makeBuilder(rows, opts ?? {});
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dashboard validation with synthetic data', () => {
  test('produces non-zero metrics across all five blocks + freshness', async () => {
    const supabase = makeSupabase(FIXTURE);
    const snapshot = await computeDashboardSnapshot(supabase, 7);

    // Activity
    expect(snapshot.user_activity.dau).toBeGreaterThan(0);
    expect(snapshot.user_activity.wau).toBeGreaterThan(0);

    // Recommendation lifecycle
    expect(snapshot.recommendations.generated).toBeGreaterThan(0);
    expect(snapshot.recommendations.viewed).toBeGreaterThanOrEqual(1);
    expect(snapshot.recommendations.accepted).toBeGreaterThanOrEqual(1);
    expect(snapshot.recommendations.completed).toBeGreaterThanOrEqual(1);
    expect(snapshot.recommendations.dismissed).toBeGreaterThanOrEqual(1);

    // Governance
    expect(snapshot.governance.constitutional_reviews).toBeGreaterThan(0);
    expect(snapshot.governance.redirected).toBeGreaterThanOrEqual(1);
    expect(snapshot.governance.crisis_events).toBeGreaterThanOrEqual(1);
    expect(snapshot.governance.injection_critical).toBeGreaterThanOrEqual(1);
    expect(snapshot.governance.injection_high).toBeGreaterThanOrEqual(1);

    // Multimodal
    expect(snapshot.multimodal.uploads).toBeGreaterThan(0);
    expect(snapshot.multimodal.extractions_succeeded).toBeGreaterThan(0);
    expect(snapshot.multimodal.extractions_failed).toBeGreaterThanOrEqual(1);

    // Cost
    expect(snapshot.cost.gemini_usd).toBeCloseTo(0.5, 4);
    expect(snapshot.cost.openai_usd).toBeCloseTo(0.25, 4);
    expect(snapshot.cost.anthropic_usd).toBeCloseTo(0.1, 4);
    expect(snapshot.cost.per_dau_usd).toBeGreaterThan(0);

    // data_freshness — every source has a non-null timestamp
    expect(snapshot.data_freshness.telemetry).toBeTruthy();
    expect(snapshot.data_freshness.governance).toBeTruthy();
    expect(snapshot.data_freshness.recommendations).toBeTruthy();
    expect(snapshot.data_freshness.outcomes).toBeTruthy();
    expect(snapshot.data_freshness.multimodal).toBeTruthy();
    expect(snapshot.data_freshness.costs).toBeTruthy();
    expect(snapshot.data_freshness.injection).toBeTruthy();
  });

  test('with empty fixture, every metric is zero and freshness is null', async () => {
    const supabase = makeSupabase({});
    const snapshot = await computeDashboardSnapshot(supabase, 7);
    expect(snapshot.user_activity.dau).toBe(0);
    expect(snapshot.recommendations.generated).toBe(0);
    expect(snapshot.governance.constitutional_reviews).toBe(0);
    expect(snapshot.multimodal.uploads).toBe(0);
    expect(snapshot.cost.gemini_usd).toBe(0);
    expect(snapshot.data_freshness.telemetry).toBeNull();
    expect(snapshot.data_freshness.governance).toBeNull();
    expect(snapshot.data_freshness.recommendations).toBeNull();
    expect(snapshot.data_freshness.outcomes).toBeNull();
    expect(snapshot.data_freshness.multimodal).toBeNull();
    expect(snapshot.data_freshness.costs).toBeNull();
    expect(snapshot.data_freshness.injection).toBeNull();
  });

  test('partial fixture exposes which source is stale', async () => {
    // Only telemetry has data. Operators should see telemetry timestamp
    // present and every other freshness field as null.
    const supabase = makeSupabase({
      analytics_user_events: FIXTURE.analytics_user_events,
    });
    const snapshot = await computeDashboardSnapshot(supabase, 7);
    expect(snapshot.data_freshness.telemetry).toBeTruthy();
    expect(snapshot.data_freshness.governance).toBeNull();
    expect(snapshot.data_freshness.recommendations).toBeNull();
    expect(snapshot.data_freshness.outcomes).toBeNull();
    expect(snapshot.data_freshness.multimodal).toBeNull();
    expect(snapshot.data_freshness.costs).toBeNull();
    expect(snapshot.data_freshness.injection).toBeNull();
    // And telemetry-derived metrics non-zero, others zero.
    expect(snapshot.user_activity.dau).toBeGreaterThan(0);
    expect(snapshot.governance.constitutional_reviews).toBe(0);
  });
});
