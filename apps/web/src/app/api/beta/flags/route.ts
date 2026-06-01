/**
 * GET /api/beta/flags
 *
 * Returns the resolved flag map for the calling user. Used by the UI
 * to conditionally render features. Falls back to flag.enabled when
 * no user is authenticated.
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { evaluateFlag } from '@/lib/ops/feature-flags';
import type { FeatureFlagRow, UserOverrideRow } from '@/lib/ops/feature-flags';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sb = supabase as any;

  const flagsRes = await sb.from('ops_feature_flags').select('*');
  const flags = (flagsRes.data ?? []) as FeatureFlagRow[];
  if (!user) {
    const map: Record<string, boolean> = {};
    for (const f of flags) map[f.slug] = f.enabled;
    return NextResponse.json({ flags: map, authenticated: false });
  }

  const [ovRes, cohRes] = await Promise.all([
    sb
      .from('ops_user_feature_flag_overrides')
      .select('flag_slug, enabled, expires_at')
      .eq('user_id', user.id),
    sb.from('ops_user_cohorts').select('cohort_slug').eq('user_id', user.id).is('left_at', null),
  ]);
  const overrides = new Map<string, UserOverrideRow>();
  for (const o of (ovRes.data ?? []) as UserOverrideRow[]) overrides.set(o.flag_slug, o);
  const cohorts = (cohRes.data ?? []).map((r: { cohort_slug: string }) => r.cohort_slug);

  const map: Record<string, { enabled: boolean; reason: string }> = {};
  for (const flag of flags) {
    const v = evaluateFlag({
      flag,
      user_id: user.id,
      user_cohorts: cohorts,
      user_override: overrides.get(flag.slug),
    });
    map[flag.slug] = v;
  }

  return NextResponse.json({ flags: map, authenticated: true, cohorts });
}
