import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const Body = z.object({
  feedback: z.enum([
    'relevant',
    'irrelevant',
    'salary_off',
    'location_off',
    'skill_mismatch',
    'industry_off',
    'experience_off',
    'other',
  ]),
  comment: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: matchId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(matchId))
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const sb: any = supabase;
  const { error } = await sb.from('job_match_feedback').insert({
    user_id: user.id,
    match_id: matchId,
    feedback: parsed.data.feedback,
    comment: parsed.data.comment ?? null,
    source: 'user',
  });
  if (error) return safeApiError({ code: 'validation_failed', internal: error });
  return NextResponse.json({ success: true });
}
