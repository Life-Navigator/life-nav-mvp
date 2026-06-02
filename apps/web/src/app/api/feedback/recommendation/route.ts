import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import {
  validateRecommendationFeedback,
  type RecommendationFeedbackInput,
} from '@/lib/feedback/service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as RecommendationFeedbackInput;
  const v = validateRecommendationFeedback(body);
  if (!v.ok) return NextResponse.json({ error: 'invalid', errors: v.errors }, { status: 400 });

  const sb = supabase as any;
  const ins = await sb
    .from('feedback_recommendation_feedback')
    .insert({
      user_id: user.id,
      recommendation_id: body.recommendation_id ?? null,
      recommendation_table: body.recommendation_table ?? null,
      agent_kind: body.agent_kind ?? null,
      agent_name: body.agent_name ?? null,
      governance_audit_id: body.governance_audit_id ?? null,
      feedback_kind: body.feedback_kind,
      comment: body.comment ?? null,
      metadata: {},
    })
    .select('id')
    .single();
  if (ins.error) return safeApiError({ code: 'db_persistence_error', internal: ins.error });
  return NextResponse.json({ id: ins.data.id });
}
