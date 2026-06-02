/**
 * POST /api/provider/portal/recommendations
 *
 * Issues a new provider recommendation + returns the XAI bundle.
 *
 * Body: RecommendationDraft
 *
 * Engagement must be active. Engagement.can_issue_recommendations
 * must be TRUE. Body is validated by the recommendation-builder.
 */

import { NextRequest, NextResponse } from 'next/server';
import { issueRecommendation } from '@/lib/provider/recommendation-service';
import { buildXAIBundle, validateDraft } from '@/lib/provider/recommendation-builder-service';
import { loadEngagementGuard, loadPortalSession } from '@/lib/provider/portal-route-helpers';
import { reviewAndPersist } from '@/lib/constitutional/middleware';
import type { RecommendationDraft } from '@/types/provider-portal';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { session, error } = await loadPortalSession();
  if (error) return error;
  const draft = (await req.json().catch(() => ({}))) as RecommendationDraft;

  const v = validateDraft(draft);
  if (!v.ok)
    return NextResponse.json({ error: 'invalid_draft', errors: v.errors }, { status: 400 });

  const guard = await loadEngagementGuard(session!, draft.engagement_id);
  if (guard.reason || !guard.engagement) {
    return NextResponse.json(
      { error: 'engagement_not_writable', reason: guard.reason },
      { status: 403 }
    );
  }
  const eng = guard.engagement;
  if (!eng.allowed_domains.includes(draft.domain)) {
    return NextResponse.json({ error: 'domain_out_of_scope' }, { status: 403 });
  }

  // ===== Sprint T: Constitutional + Character gate =====
  // Migrated from Sprint L `validateAndPersist` to Sprint L2 + N.3
  // `reviewAndPersist`. Every provider recommendation now goes through
  // the same 13-step constitutional engine + character evaluator that
  // the user-facing surfaces use. Blocked recs are not inserted.
  const draft_text = `${draft.title}\n\n${draft.body}\n\n${draft.rationale ?? ''}`;
  const reviewResult = await reviewAndPersist({
    supabase: session!.supabase,
    user_id: draft.patient_user_id,
    draft_text,
    subject: {
      kind: 'provider_recommendation',
      text: draft_text,
      action: draft.title,
      citations: draft.citations,
      assumptions: draft.assumptions,
      risks: draft.risks,
      confidence: draft.expected_strength,
      tradeoffs: [],
      metadata: { emitter_agent_kind: 'provider', emitter_agent_name: 'provider.portal' },
      user_id: draft.patient_user_id,
    },
    now: new Date().toISOString(),
  });
  const decision = reviewResult.final_decision.governance;
  if (!decision.approved) {
    return NextResponse.json({ error: 'governance_blocked', decision }, { status: 422 });
  }

  // Persist via the Sprint I service (which writes provider_recommendations).
  const rec = await issueRecommendation(session!.supabase, {
    provider_id: session!.provider_id,
    patient_user_id: draft.patient_user_id,
    engagement_id: draft.engagement_id,
    domain: draft.domain,
    title: draft.title,
    body: draft.body,
    rationale: draft.rationale,
    related_goal_id: draft.related_goal_id ?? undefined,
    expected_horizon_months: draft.expected_horizon_months ?? undefined,
    expected_strength: draft.expected_strength ?? undefined,
    citations: draft.citations,
    metadata: {
      assumptions: draft.assumptions,
      risks: draft.risks,
    },
  });
  if (!rec) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });

  const xai = buildXAIBundle(draft, rec.id);

  return NextResponse.json({
    recommendation: rec,
    xai,
    governance: { verdict: decision.verdict, severity: decision.severity },
    warnings: v.warnings,
  });
}
