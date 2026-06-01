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
import { validateAndPersist } from '@/lib/governance/middleware';
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

  // ===== Sprint L: Governance gate =====
  // Every recommendation must pass through the Decision Governance
  // Engine before it reaches the user. We validate the draft and
  // persist the audit row; if blocked, we do NOT insert the rec.
  const { decision } = await validateAndPersist({
    subject: {
      kind: 'provider_recommendation',
      text: `${draft.title}\n\n${draft.body}\n\n${draft.rationale ?? ''}`,
      action: draft.title,
      citations: draft.citations,
      assumptions: draft.assumptions,
      risks: draft.risks,
      confidence: draft.expected_strength,
      tradeoffs: [],
      metadata: {},
      user_id: draft.patient_user_id,
    },
    emitter: {
      agent_kind: 'provider',
      agent_name: 'provider.portal',
      user_id: session!.user_id,
    },
    supabase: session!.supabase,
    now: new Date().toISOString(),
  });
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
