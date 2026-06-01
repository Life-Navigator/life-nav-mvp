/**
 * POST /api/constitutional/review
 *
 * The pre-stream guard endpoint. Callers stream the final_text only
 * if `ok_to_stream: true` AND `final_verdict !== 'REQUEST_CLARIFICATION'`.
 *
 * Body:
 *   { user_input_text?: string; draft_text: string; subject?: GovernanceSubject;
 *     retrieval_ok?: boolean; max_iterations?: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { reviewAndPersist } from '@/lib/constitutional/middleware';
import type { GovernanceSubject } from '@/types/governance';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    user_input_text?: string;
    draft_text: string;
    subject?: GovernanceSubject;
    retrieval_ok?: boolean;
    max_iterations?: number;
  };
  if (typeof body?.draft_text !== 'string') {
    return NextResponse.json({ error: 'draft_text required' }, { status: 400 });
  }

  try {
    const result = await reviewAndPersist({
      supabase: supabase as any,
      user_id: user.id,
      user_input_text: body.user_input_text,
      draft_text: body.draft_text,
      subject: body.subject,
      retrieval_ok: body.retrieval_ok,
      max_iterations: body.max_iterations,
      now: new Date().toISOString(),
    });
    return NextResponse.json({
      verdict: result.final_verdict,
      ok_to_stream: result.ok_to_stream,
      final_text: result.final_text,
      iterations: result.iterations,
      decision: result.final_decision,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'governance_failure', message }, { status: 500 });
  }
}
