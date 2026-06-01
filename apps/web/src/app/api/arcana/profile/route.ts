/**
 * GET /api/arcana/profile
 *
 * Returns the user's arcana profile, plus denormalized counts for the
 * intake-related child tables. Owner-scoped via RLS.
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabase as any;
  const [profRes, goalsRes, conRes, capRes, motRes, readRes, memRes] = await Promise.all([
    sb.from('arcana_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    sb
      .from('arcana_goals')
      .select('id, goal_kind, domain, title, target_date')
      .eq('user_id', user.id),
    sb
      .from('arcana_constraints')
      .select('id, constraint_kind, severity, is_active')
      .eq('user_id', user.id),
    sb
      .from('arcana_capabilities')
      .select('id, capability_kind, proficiency')
      .eq('user_id', user.id),
    sb.from('arcana_motivations').select('id, driver, intensity').eq('user_id', user.id),
    sb
      .from('arcana_readiness')
      .select('overall_score, recommended_membership, computed_at')
      .eq('user_id', user.id)
      .order('computed_at', { ascending: false })
      .limit(1),
    sb.from('memberships').select('tier, status, started_at').eq('user_id', user.id).maybeSingle(),
  ]);

  return NextResponse.json({
    profile: profRes.data ?? null,
    goals: goalsRes.data ?? [],
    constraints: conRes.data ?? [],
    capabilities: capRes.data ?? [],
    motivations: motRes.data ?? [],
    most_recent_readiness: readRes.data?.[0] ?? null,
    membership: memRes.data ?? null,
  });
}
