import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { validateNps, type NpsInput } from '@/lib/feedback/service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as NpsInput;
  const v = validateNps(body);
  if (!v.ok) return NextResponse.json({ error: 'invalid', errors: v.errors }, { status: 400 });

  const sb = supabase as any;
  const ins = await sb
    .from('feedback_nps_responses')
    .insert({
      user_id: user.id,
      score: body.score,
      comment: body.comment ?? null,
      prompt_slug: body.prompt_slug ?? null,
      metadata: {},
    })
    .select('id')
    .single();
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  return NextResponse.json({ id: ins.data.id });
}
