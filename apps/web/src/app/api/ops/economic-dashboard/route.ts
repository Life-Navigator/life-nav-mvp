/**
 * GET /api/ops/economic-dashboard — Sprint O.0.2 Phase 11.
 *
 * Operator-only economic-governance snapshot. Gated by the same
 * feature-flag mechanism as the existing operator dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { computeEconomicSnapshot } from '@/lib/ops/economic-dashboard-queries';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return safeApiError({ code: 'upstream_unavailable' });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeApiError({ code: 'unauthorized' });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const flag = await sb
    .from('ops_feature_flags')
    .select('flag_key, enabled')
    .eq('flag_key', 'operator_dashboard.read')
    .maybeSingle();
  const allowed = flag?.data?.enabled === true;
  if (!allowed) {
    const override = await sb
      .from('ops_user_feature_flag_overrides')
      .select('enabled')
      .eq('flag_key', 'operator_dashboard.read')
      .eq('user_id', user.id)
      .maybeSingle();
    if (override?.data?.enabled !== true) {
      return safeApiError({ code: 'forbidden' });
    }
  }

  const snapshot = await computeEconomicSnapshot(sb);
  return NextResponse.json(snapshot);
}
