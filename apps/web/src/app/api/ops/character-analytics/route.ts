/**
 * GET /api/ops/character-analytics?window_days=7 — Sprint Q Phase 6.
 *
 * Operator-only snapshot of character-review behaviour over a window.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { computeCharacterAnalyticsSnapshot } from '@/lib/ops/character-analytics-queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

  const url = request.nextUrl;
  const raw = url.searchParams.get('window_days');
  const window_days = Math.max(1, Math.min(90, Number.isFinite(Number(raw)) ? Number(raw) : 7));

  const snapshot = await computeCharacterAnalyticsSnapshot(sb, window_days);
  return NextResponse.json(snapshot);
}
