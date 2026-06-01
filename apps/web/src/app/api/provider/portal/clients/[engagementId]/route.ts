/**
 * GET /api/provider/portal/clients/[engagementId]
 *
 * Client workspace view (Phase 3). Loads goals, recommendations,
 * and stats. Engagement is verified active.
 */

import { NextRequest, NextResponse } from 'next/server';
import { assembleClientWorkspace } from '@/lib/provider/client-workspace-service';
import { loadEngagementGuard, loadPortalSession } from '@/lib/provider/portal-route-helpers';
import type { ClientWorkspaceGoalProgress } from '@/types/provider-portal';
import type { ProviderDomain, ProviderRecommendation } from '@/types/provider';

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

  // Goals scoped to allowed_domains.
  const goalsRes = await session!.supabase
    .from('arcana_goals')
    .select('id, title, domain, goal_kind, current_value, target_value, target_date')
    .eq('user_id', eng.patient_user_id);
  const arcanaGoals = (goalsRes.data ?? []) as Array<{
    id: string;
    title: string;
    domain: string;
    current_value?: number;
    target_value?: number;
  }>;

  const probRes = await session!.supabase
    .from('goal_probability_distribution')
    .select('goal_id, most_likely_prob, computed_at')
    .eq('user_id', eng.patient_user_id)
    .order('computed_at', { ascending: false });
  const probByGoal = new Map<string, Array<{ most_likely_prob: number; computed_at: string }>>();
  for (const r of (probRes.data ?? []) as Array<{
    goal_id: string;
    most_likely_prob: number;
    computed_at: string;
  }>) {
    if (!probByGoal.has(r.goal_id)) probByGoal.set(r.goal_id, []);
    probByGoal.get(r.goal_id)!.push(r);
  }

  const goals: ClientWorkspaceGoalProgress[] = arcanaGoals
    .filter((g) => eng.allowed_domains.includes(g.domain as ProviderDomain))
    .map((g) => {
      const probs = probByGoal.get(g.id) ?? [];
      const cur = probs[0]?.most_likely_prob;
      const prior = probs[1]?.most_likely_prob;
      return {
        goal_id: g.id,
        goal_title: g.title,
        domain: g.domain as ProviderDomain,
        current_progress:
          typeof g.current_value === 'number' && typeof g.target_value === 'number'
            ? Number((g.current_value / g.target_value).toFixed(4))
            : null,
        target_progress: 1,
        probability_now: typeof cur === 'number' ? cur : null,
        probability_prior: typeof prior === 'number' ? prior : null,
        probability_delta:
          typeof cur === 'number' && typeof prior === 'number'
            ? Number((cur - prior).toFixed(4))
            : null,
        catch_up_status: null,
        last_observation_at: probs[0]?.computed_at ?? null,
      };
    });

  const recRes = await session!.supabase
    .from('provider_recommendations')
    .select('*')
    .eq('engagement_id', engagementId);
  const recommendations = (recRes.data ?? []) as ProviderRecommendation[];

  // Patient initials — pulled from the most recent lead package.
  const lpRes = await session!.supabase
    .from('lead_packages')
    .select('payload')
    .eq('user_id', eng.patient_user_id)
    .eq('recipient_provider_id', session!.provider_id)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const initials =
    (lpRes.data?.payload as { patient_summary?: { name_initials?: string } } | undefined)
      ?.patient_summary?.name_initials ?? '—';

  const view = assembleClientWorkspace({
    engagement_id: engagementId,
    patient_user_id: eng.patient_user_id,
    patient_initials: initials,
    scope_domains: eng.allowed_domains as ProviderDomain[],
    goals,
    recommendations,
    now: new Date().toISOString(),
  });
  return NextResponse.json({ workspace: view });
}
