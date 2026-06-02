/**
 * GET /api/ops/dashboard?window_days=7 — Sprint O.0 Phase 8.
 *
 * Operator-only read-only snapshot of internal beta health. Returns
 * the structure documented in `INTERNAL_BETA_DASHBOARD.md`.
 *
 * Authorization: callers must (a) be authenticated AND (b) have the
 * `operator_dashboard.read` flag enabled in `ops.feature_flags` for
 * their cohort. This route is intentionally NOT public.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { computeDashboardSnapshot } from '@/lib/ops/dashboard-queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return safeApiError({ code: 'upstream_unavailable' });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeApiError({ code: 'unauthorized' });

  // Authorization: read the operator-dashboard flag for this user.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const flag = await sb
    .from('ops_feature_flags')
    .select('flag_key, enabled')
    .eq('flag_key', 'operator_dashboard.read')
    .maybeSingle();
  const allowed = flag?.data?.enabled === true;
  if (!allowed) {
    // Could be a per-user override; check ops_user_feature_flag_overrides.
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

  const url = request.nextUrl;
  const window_days_raw = url.searchParams.get('window_days');
  const window_days = Math.max(
    1,
    Math.min(90, Number.isFinite(Number(window_days_raw)) ? Number(window_days_raw) : 7)
  );

  const snapshot = await computeDashboardSnapshot(sb, window_days);
  return NextResponse.json(snapshot);
}
