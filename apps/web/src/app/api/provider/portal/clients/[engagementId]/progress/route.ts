/**
 * GET /api/provider/portal/clients/[engagementId]/progress
 *
 * Progress monitoring view (Phase 5).
 */

import { NextRequest, NextResponse } from 'next/server';
import { assembleProgressMonitoring } from '@/lib/provider/progress-monitoring-service';
import { loadEngagementGuard, loadPortalSession } from '@/lib/provider/portal-route-helpers';
import type { BiometricObservation, LabResult } from '@/types/arcana';
import type { ProviderDomain } from '@/types/provider';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ engagementId: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await loadPortalSession();
  if (error) return error;
  const { engagementId } = await ctx.params;
  const guard = await loadEngagementGuard(session!, engagementId);
  if (guard.reason || !guard.engagement) {
    return NextResponse.json(
      { error: 'engagement_not_writable', reason: guard.reason },
      { status: 403 }
    );
  }
  const eng = guard.engagement;

  const [obsRes, labRes, probRes] = await Promise.all([
    session!.supabase
      .from('biometric_observations')
      .select('*')
      .eq('user_id', eng.patient_user_id)
      .order('collected_at', { ascending: false })
      .limit(400),
    session!.supabase
      .from('lab_results')
      .select('*')
      .eq('user_id', eng.patient_user_id)
      .order('collection_date', { ascending: false })
      .limit(200),
    session!.supabase
      .from('goal_probability_distribution')
      .select('most_likely_prob, computed_at')
      .eq('user_id', eng.patient_user_id)
      .order('computed_at', { ascending: false })
      .limit(2),
  ]);

  const obs = (obsRes.data ?? []) as BiometricObservation[];
  const labs = (labRes.data ?? []) as LabResult[];
  const probs = (probRes.data ?? []) as Array<{ most_likely_prob: number; computed_at: string }>;
  const cur = probs[0]?.most_likely_prob;
  const prior = probs[1]?.most_likely_prob;

  const view = assembleProgressMonitoring({
    engagement_id: engagementId,
    patient_user_id: eng.patient_user_id,
    scope_domains: eng.allowed_domains as ProviderDomain[],
    observations: obs,
    labs,
    adherence: {}, // loader hook for future adherence pipeline
    probability_current: typeof cur === 'number' ? cur : null,
    probability_prior: typeof prior === 'number' ? prior : null,
    goals_summary: [],
    now: new Date().toISOString(),
  });
  return NextResponse.json({ progress: view });
}
