/**
 * GET /api/platform/tenants/[id]/analytics?window_days=30 — Sprint S Phase 6.
 *
 * Aggregate engagement + outcome + ROI for the tenant. RLS gates the
 * underlying tables; the engine returns 0s when the caller cannot see
 * any rows.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { buildEnterpriseAnalyticsReport } from '@/lib/enterprise-projections/analytics';
import type { EngagementRow, CostRow, OutcomeRow } from '@/lib/enterprise-projections/analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return safeApiError({ code: 'upstream_unavailable' });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeApiError({ code: 'unauthorized' });

  const { id: tenant_id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(tenant_id)) return safeApiError({ code: 'bad_request' });

  const url = request.nextUrl;
  const window_days = Math.max(
    1,
    Math.min(180, Number.parseInt(url.searchParams.get('window_days') ?? '30', 10) || 30)
  );

  const since = new Date(Date.now() - window_days * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Engagement: analytics_user_events (RLS filters to tenant-member rows).
  const engRes = await sb
    .from('analytics_user_events')
    .select('user_id, occurred_at, event_type')
    .eq('tenant_id', tenant_id)
    .gte('occurred_at', since)
    .limit(50_000);
  const engagement_rows: EngagementRow[] = Array.isArray(engRes.data) ? engRes.data : [];

  // Cost: economic_cost_events.
  const costRes = await sb
    .from('economic_cost_events')
    .select('cost_usd_micros, created_at')
    .eq('tenant_id', tenant_id)
    .gte('created_at', since)
    .limit(50_000);
  const cost_rows: CostRow[] = Array.isArray(costRes.data) ? costRes.data : [];

  // Outcome: latest tenant_reports row for the window.
  const outRes = await sb
    .from('outcome_tenant_reports')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('window_days', window_days)
    .order('computed_at', { ascending: false })
    .limit(1);
  const outcome_row: OutcomeRow | null =
    Array.isArray(outRes.data) && outRes.data[0]
      ? {
          recommendations_total: outRes.data[0].recommendations_total ?? 0,
          acceptance_rate: outRes.data[0].acceptance_rate ?? 0,
          completion_rate: outRes.data[0].completion_rate ?? 0,
          avg_effectiveness: outRes.data[0].avg_effectiveness ?? 0,
          avg_dqi: outRes.data[0].avg_dqi ?? 0,
          avg_life_progress: outRes.data[0].avg_life_progress ?? 0,
          safety_compliance_rate: outRes.data[0].safety_compliance_rate ?? 0,
        }
      : null;

  const report = buildEnterpriseAnalyticsReport({
    tenant_id,
    window_days,
    engagement_rows,
    cost_rows,
    outcome_row,
  });

  return NextResponse.json({ report });
}
