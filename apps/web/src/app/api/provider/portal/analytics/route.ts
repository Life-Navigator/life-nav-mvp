/**
 * GET /api/provider/portal/analytics?period=weekly|monthly|quarterly
 *
 * Effectiveness aggregate (Phase 6).
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildEffectiveness } from '@/lib/provider/portal-analytics-service';
import { loadPortalSession } from '@/lib/provider/portal-route-helpers';
import type { ProviderOutcome, ProviderRecommendation } from '@/types/provider';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { session, error } = await loadPortalSession();
  if (error) return error;
  const period = (new URL(req.url).searchParams.get('period') ?? 'monthly') as
    | 'weekly'
    | 'monthly'
    | 'quarterly';

  const recRes = await session!.supabase
    .from('provider_recommendations')
    .select('*')
    .eq('provider_id', session!.provider_id);
  const outRes = await session!.supabase
    .from('provider_outcomes')
    .select('*')
    .eq('provider_id', session!.provider_id);

  const recs = (recRes.data ?? []) as ProviderRecommendation[];
  const outs = (outRes.data ?? []) as ProviderOutcome[];

  // Period start = first day of current month (deterministic enough).
  const now = new Date();
  const period_start = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;

  const eff = buildEffectiveness({
    provider_id: session!.provider_id,
    period,
    period_start,
    recommendations: recs,
    outcomes: outs,
  });
  return NextResponse.json({ analytics: eff });
}
