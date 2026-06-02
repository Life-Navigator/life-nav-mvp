/**
 * PATCH /api/jobs/matches/[id]
 *
 * Candidate actions on their own match:
 *   action: 'save' | 'dismiss' | 'apply' | 'consent_to_intro' | 'decline_intro'
 *
 * RLS already restricts the row to the candidate (auth.uid()=user_id).
 * 'consent_to_intro' flips the status so the employer can finally read
 * the row (their `jcm_employer_post_consent` SELECT policy admits
 * `intro_consented` / `applied`).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const Body = z.object({
  action: z.enum(['save', 'dismiss', 'apply', 'consent_to_intro', 'decline_intro']),
});

const ACTION_MAP: Record<z.infer<typeof Body>['action'], string> = {
  save: 'saved',
  dismiss: 'dismissed',
  apply: 'applied',
  consent_to_intro: 'intro_consented',
  decline_intro: 'intro_declined',
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const sb: any = supabase;
  const newStatus = ACTION_MAP[parsed.data.action];
  const { error } = await sb
    .from('job_candidate_matches')
    .update({ status: newStatus })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return safeApiError({ code: 'validation_failed', internal: error });
  return NextResponse.json({ success: true, status: newStatus });
}
