/**
 * GET /api/jobs/matches
 *
 * The candidate's own match list. RLS already filters by `auth.uid()`.
 * We join the public.employer_job_posts row so the UI can render the
 * job title / company without an extra round-trip.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = request.nextUrl.searchParams.get('status');
  const sb: any = supabase;
  let q = sb
    .from('job_candidate_matches')
    .select(
      `
      id, match_score, status, missing_requirements, created_at,
      employer_facing_summary,
      skills_score, certifications_score, education_score, salary_fit_score, location_fit_score, growth_alignment_score,
      job:employer_job_posts!job_candidate_matches_job_post_id_fkey ( id, title, remote_mode, salary_min, salary_max, experience_level, industry ),
      employer:employer_profiles!job_candidate_matches_employer_id_fkey ( id, display_name, legal_name, industry )
    `
    )
    .eq('user_id', user.id)
    .order('match_score', { ascending: false })
    .limit(100);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ matches: data ?? [] });
}
