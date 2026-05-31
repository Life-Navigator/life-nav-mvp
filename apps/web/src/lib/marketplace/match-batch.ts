/**
 * Server-side batch helpers. Loads job + candidate snapshots from
 * Supabase under the appropriate role and persists the matches to
 * public.job_candidate_matches via upsert.
 *
 * `refreshMatchesForJob` is the primary entry point — it's invoked by
 * the publish route. A future bulk job worker can call it on a cron.
 *
 * We deliberately keep the candidate loader on a SERVICE-ROLE client
 * because (a) we need to read across users to score them, and (b) the
 * service role is the only role that can write into
 * job_candidate_matches with arbitrary user_id (RLS would otherwise
 * block). The loader still respects the candidate visibility flag.
 */

import { matchMany } from './matcher';
import type { CandidateSnapshot, JobPostSnapshot } from '@/types/marketplace';

interface BatchResult {
  job_id: string;
  scored: number;
  upserted: number;
}

export async function refreshMatchesForJob(
  serviceSupabase: unknown,
  jobId: string,
  options: { limit?: number } = {}
): Promise<BatchResult> {
  const sb: any = serviceSupabase;
  const limit = options.limit ?? 500;

  // Load job post + requirements + locations.
  const [{ data: post }, { data: requirements }, { data: locations }] = await Promise.all([
    sb
      .from('employer_job_posts')
      .select(
        'id, employer_id, title, industry, employment_type, remote_mode, experience_level, salary_min, salary_max, salary_currency, veteran_friendly, status'
      )
      .eq('id', jobId)
      .maybeSingle(),
    sb
      .from('employer_job_post_requirements')
      .select('requirement_kind, value, weight')
      .eq('job_post_id', jobId),
    sb.from('employer_job_post_locations').select('city, state, country').eq('job_post_id', jobId),
  ]);
  if (!post) throw new Error('Job post not found');
  if (post.status !== 'published') {
    return { job_id: jobId, scored: 0, upserted: 0 };
  }

  const job: JobPostSnapshot = {
    id: post.id,
    employer_id: post.employer_id,
    title: post.title,
    industry: post.industry,
    employment_type: post.employment_type,
    remote_mode: post.remote_mode,
    experience_level: post.experience_level,
    salary_min: post.salary_min != null ? Number(post.salary_min) : null,
    salary_max: post.salary_max != null ? Number(post.salary_max) : null,
    salary_currency: post.salary_currency,
    veteran_friendly: !!post.veteran_friendly,
    requirements: (requirements ?? []) as JobPostSnapshot['requirements'],
    locations: (locations ?? []) as JobPostSnapshot['locations'],
  };

  // Load eligible candidates. We join career_profiles +
  // candidate_career_profiles + profiles for city/state. Hidden
  // candidates are excluded server-side as a belt-and-braces check
  // (the matcher also filters them out).
  const { data: candidates } = await sb
    .from('candidate_career_profiles')
    .select(
      `
      user_id,
      visibility,
      desired_industries,
      desired_locations,
      profiles:profiles!candidate_career_profiles_user_id_fkey ( city, state, country ),
      career:career_profiles!career_profiles_user_id_fkey ( current_title, desired_title, desired_salary_min, desired_salary_max, skills, certifications, years_of_experience, work_arrangement, relocation_willingness, job_change_willingness ),
      education:education_intake!education_intake_user_id_fkey ( highest_completed_degree )
    `
    )
    .neq('visibility', 'hidden')
    .limit(limit);

  const snapshots: CandidateSnapshot[] = ((candidates ?? []) as Array<any>).map((c) => ({
    user_id: c.user_id,
    visibility: c.visibility,
    current_title: c.career?.current_title ?? null,
    desired_title: c.career?.desired_title ?? null,
    desired_salary_min:
      c.career?.desired_salary_min != null ? Number(c.career.desired_salary_min) : null,
    desired_salary_max:
      c.career?.desired_salary_max != null ? Number(c.career.desired_salary_max) : null,
    skills: (c.career?.skills ?? []) as string[],
    certifications: (c.career?.certifications ?? []) as string[],
    years_of_experience:
      c.career?.years_of_experience != null ? Number(c.career.years_of_experience) : null,
    work_arrangement: c.career?.work_arrangement ?? null,
    industry_interests: (c.desired_industries ?? []) as string[],
    relocation_willingness: c.career?.relocation_willingness ?? null,
    job_change_willingness: c.career?.job_change_willingness ?? null,
    desired_locations: (c.desired_locations ?? []) as string[],
    city: c.profiles?.city ?? null,
    state: c.profiles?.state ?? null,
    country: c.profiles?.country ?? null,
    highest_completed_degree: c.education?.highest_completed_degree ?? null,
  }));

  const results = matchMany(job, snapshots);

  // Persist — upsert by (user_id, job_post_id).
  const rows = results.map((r) => ({
    user_id: r.user_id,
    job_post_id: job.id,
    employer_id: job.employer_id,
    match_score: r.match_score,
    skills_score: r.dimensions.skills_score,
    certifications_score: r.dimensions.certifications_score,
    education_score: r.dimensions.education_score,
    salary_fit_score: r.dimensions.salary_fit_score,
    location_fit_score: r.dimensions.location_fit_score,
    growth_alignment_score: r.dimensions.growth_alignment_score,
    candidate_visibility_at_match: r.candidate_visibility_at_match,
    employer_facing_summary: r.employer_facing_summary,
    missing_requirements: r.missing_requirements,
    status: 'surfaced',
    source: 'engine',
  }));

  if (rows.length > 0) {
    await sb.from('job_candidate_matches').upsert(rows, { onConflict: 'user_id,job_post_id' });
  }

  return { job_id: jobId, scored: results.length, upserted: rows.length };
}
