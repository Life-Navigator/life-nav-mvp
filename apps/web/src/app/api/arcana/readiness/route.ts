/**
 * POST /api/arcana/readiness
 *
 * Computes (and persists) a readiness score from the user's intake state.
 *
 * Body (optional overrides):
 *   { free_weekly_hours?, available_surplus_usd?, historical_adherence? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { computeReadiness } from '@/lib/arcana/readiness-engine';
import type {
  ArcanaCapability,
  ArcanaConstraint,
  ArcanaMotivation,
  ArcanaProfile,
} from '@/types/arcana';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    free_weekly_hours?: number;
    available_surplus_usd?: number;
    historical_adherence?: number;
  };

  const sb = supabase as any;
  const [profRes, capRes, conRes, motRes] = await Promise.all([
    sb.from('arcana_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    sb.from('arcana_capabilities').select('*').eq('user_id', user.id),
    sb.from('arcana_constraints').select('*').eq('user_id', user.id).eq('is_active', true),
    sb.from('arcana_motivations').select('*').eq('user_id', user.id),
  ]);
  if (profRes.error || !profRes.data) {
    return NextResponse.json({ error: 'arcana profile not initialized' }, { status: 409 });
  }

  const readiness = computeReadiness({
    profile: profRes.data as ArcanaProfile,
    capabilities: (capRes.data ?? []) as ArcanaCapability[],
    constraints: (conRes.data ?? []) as ArcanaConstraint[],
    motivations: (motRes.data ?? []) as ArcanaMotivation[],
    free_weekly_hours: body.free_weekly_hours,
    available_surplus_usd: body.available_surplus_usd,
    historical_adherence: body.historical_adherence,
    now: new Date().toISOString(),
  });

  // Persist a snapshot row + refresh the cached score on the profile.
  const snapshot = await sb
    .from('arcana_readiness')
    .insert({
      user_id: user.id,
      profile_id: profRes.data.id,
      computed_at: readiness.computed_at,
      overall_score: readiness.overall_score,
      motivation_score: readiness.motivation_score,
      capability_score: readiness.capability_score,
      capacity_score: readiness.capacity_score,
      consistency_score: readiness.consistency_score,
      drivers: readiness.drivers,
      risks: readiness.risks,
      recommended_membership: readiness.recommended_membership,
      metadata: readiness.metadata,
    })
    .select('*')
    .single();

  await sb
    .from('arcana_profiles')
    .update({
      readiness_score: readiness.overall_score,
      readiness_factors: readiness.drivers,
    })
    .eq('user_id', user.id);

  return NextResponse.json({
    readiness,
    snapshot: snapshot.data,
  });
}
