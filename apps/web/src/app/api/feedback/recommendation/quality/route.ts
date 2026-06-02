/**
 * POST /api/feedback/recommendation/quality — Sprint O.0 Phase 7.
 *
 * Structured feedback (helpfulness / explanation_clarity / trust / outcome).
 * Writes to feedback.recommendation_quality + transitions the decision
 * outcome state machine + emits a user-event for the operator dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { recordUserEvent } from '@/lib/analytics/events';
import { transitionOutcome } from '@/lib/outcomes/decision-outcomes';

export const dynamic = 'force-dynamic';

const schema = z.object({
  recommendation_id: z.string().uuid(),
  decision_outcome_id: z.string().uuid().optional(),
  governance_audit_id: z.string().uuid().optional(),
  helpfulness: z.enum(['helpful', 'neutral', 'not_helpful']),
  explanation_clarity: z.enum(['clear', 'confusing']),
  trust: z.enum(['trust', 'neutral', 'distrust']),
  outcome: z.enum(['improved', 'no_change', 'worse', 'unknown']).optional().default('unknown'),
  free_text: z.string().max(4000).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return safeApiError({ code: 'upstream_unavailable' });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeApiError({ code: 'unauthorized' });

  const body = await request.json().catch(() => null);
  if (!body) return safeApiError({ code: 'bad_request' });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return safeApiError({
      code: 'validation_failed',
      internal: parsed.error.message,
    });
  }
  const f = parsed.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const ins = await sb
    .from('feedback_recommendation_quality')
    .insert({
      user_id: user.id,
      recommendation_id: f.recommendation_id,
      decision_outcome_id: f.decision_outcome_id ?? null,
      governance_audit_id: f.governance_audit_id ?? null,
      helpfulness: f.helpfulness,
      explanation_clarity: f.explanation_clarity,
      trust: f.trust,
      outcome: f.outcome,
      free_text: f.free_text ?? null,
    })
    .select('id')
    .single();
  if (ins.error || !ins.data) {
    return safeApiError({ code: 'db_persistence_error', internal: ins.error });
  }

  await recordUserEvent(sb, {
    user_id: user.id,
    event_type:
      f.helpfulness === 'helpful'
        ? 'recommendation_accepted'
        : f.helpfulness === 'not_helpful'
          ? 'recommendation_dismissed'
          : 'recommendation_viewed',
    event_metadata: {
      recommendation_id: f.recommendation_id,
      trust: f.trust,
      outcome: f.outcome,
    },
    subject_kind: 'recommendation',
    subject_id: f.recommendation_id,
  });

  if (f.outcome === 'improved') {
    await transitionOutcome(
      sb,
      { user_id: user.id, recommendation_id: f.recommendation_id },
      'completed',
      { trigger: 'feedback' }
    );
    await recordUserEvent(sb, {
      user_id: user.id,
      event_type: 'recommendation_completed',
      event_metadata: {
        recommendation_id: f.recommendation_id,
        trigger: 'feedback_outcome_improved',
      },
      subject_kind: 'recommendation',
      subject_id: f.recommendation_id,
    });
  } else if (f.helpfulness === 'not_helpful') {
    await transitionOutcome(
      sb,
      { user_id: user.id, recommendation_id: f.recommendation_id },
      'dismissed',
      { trigger: 'feedback' }
    );
  } else if (f.helpfulness === 'helpful') {
    await transitionOutcome(
      sb,
      { user_id: user.id, recommendation_id: f.recommendation_id },
      'accepted',
      { trigger: 'feedback' }
    );
  }

  return NextResponse.json({ id: ins.data.id, ok: true });
}
