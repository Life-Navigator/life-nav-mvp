/**
 * POST /api/employer/matches/[id]/request-intro
 *
 * Flips the match status to 'intro_requested' so the candidate sees an
 * intro request on their dashboard. The candidate must then explicitly
 * consent (POST /api/jobs/matches/[id]) before the employer sees any
 * identifying detail.
 *
 * This route is service-role-backed because the calling employer user
 * does NOT have RLS read access to the match row yet (their direct
 * access is only granted after status='intro_consented' or 'applied').
 * We must still confirm the calling user is an employer member of the
 * job's employer profile.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const service = createServiceRoleClient();
  if (!supabase || !service) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: matchId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(matchId))
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const sb: any = supabase;
  const svc: any = service;

  // Resolve the match's employer_id via the service role.
  const { data: match } = await svc
    .from('job_candidate_matches')
    .select('id, employer_id, status')
    .eq('id', matchId)
    .maybeSingle();
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Confirm caller is an active member of that employer.
  const { data: member } = await sb
    .from('employer_users')
    .select('employer_id')
    .eq('user_id', user.id)
    .eq('employer_id', match.employer_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (match.status !== 'surfaced' && match.status !== 'saved') {
    return NextResponse.json(
      { error: `Cannot request intro from status='${match.status}'` },
      { status: 400 }
    );
  }

  const { error } = await svc
    .from('job_candidate_matches')
    .update({ status: 'intro_requested' })
    .eq('id', matchId);
  if (error) return safeApiError({ code: 'validation_failed', internal: error });
  return NextResponse.json({ success: true });
}
