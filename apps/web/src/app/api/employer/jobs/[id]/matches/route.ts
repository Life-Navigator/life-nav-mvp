/**
 * GET /api/employer/jobs/[id]/matches
 *
 * Returns the *anonymized* match list for an employer-owned job post.
 * Uses the public.employer_match_anonymized view (defined in migration
 * 072) which deliberately excludes user_id and any identifying fields.
 * Employer members can only see matches whose status is
 * surfaced / saved / intro_requested / intro_consented / applied.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const sb: any = supabase;
  const { data, error } = await sb
    .from('employer_match_anonymized')
    .select(
      'id, match_score, skills_score, certifications_score, education_score, salary_fit_score, location_fit_score, growth_alignment_score, employer_facing_summary, missing_requirements, status, created_at'
    )
    .eq('job_post_id', id)
    .order('match_score', { ascending: false })
    .limit(100);
  if (error) return safeApiError({ code: 'validation_failed', internal: error });
  return NextResponse.json({ matches: data ?? [] });
}
