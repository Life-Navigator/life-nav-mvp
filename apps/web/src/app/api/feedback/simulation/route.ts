import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { validateSimulationFeedback, type SimulationFeedbackInput } from '@/lib/feedback/service';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as SimulationFeedbackInput;
  const v = validateSimulationFeedback(body);
  if (!v.ok) return NextResponse.json({ error: 'invalid', errors: v.errors }, { status: 400 });

  const sb = supabase as any;
  const ins = await sb
    .from('feedback_simulation_feedback')
    .insert({
      user_id: user.id,
      simulation_id: body.simulation_id ?? null,
      feedback_kind: body.feedback_kind,
      comment: body.comment ?? null,
      metadata: {},
    })
    .select('id')
    .single();
  if (ins.error) return safeApiError({ code: 'db_persistence_error', internal: ins.error });
  return NextResponse.json({ id: ins.data.id });
}
