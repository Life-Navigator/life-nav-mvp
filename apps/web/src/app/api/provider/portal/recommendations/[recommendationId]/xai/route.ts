/**
 * GET /api/provider/portal/recommendations/[recommendationId]/xai
 *
 * Re-builds the XAI bundle for an existing recommendation from its
 * stored fields. Determinism: same recommendation → same bundle.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildXAIBundle } from '@/lib/provider/recommendation-builder-service';
import { loadPortalSession } from '@/lib/provider/portal-route-helpers';
import type { ProviderRecommendation } from '@/types/provider';
import type { RecommendationDraft } from '@/types/provider-portal';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ recommendationId: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await loadPortalSession();
  if (error) return error;
  const { recommendationId } = await ctx.params;

  const r = await session!.supabase
    .from('provider_recommendations')
    .select('*')
    .eq('id', recommendationId)
    .eq('provider_id', session!.provider_id)
    .maybeSingle();
  if (!r.data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const rec = r.data as ProviderRecommendation;
  const meta = (rec.metadata ?? {}) as { assumptions?: string[]; risks?: string[] };

  const draft: RecommendationDraft = {
    engagement_id: rec.engagement_id,
    patient_user_id: rec.patient_user_id,
    domain: rec.domain,
    title: rec.title,
    body: rec.body,
    rationale: rec.rationale ?? undefined,
    expected_horizon_months: rec.expected_horizon_months ?? undefined,
    expected_strength: rec.expected_strength ?? undefined,
    related_goal_id: rec.related_goal_id ?? null,
    citations: rec.citations ?? [],
    assumptions: meta.assumptions ?? [],
    risks: meta.risks ?? [],
  };
  const xai = buildXAIBundle(draft, rec.id);
  return NextResponse.json({ xai });
}
