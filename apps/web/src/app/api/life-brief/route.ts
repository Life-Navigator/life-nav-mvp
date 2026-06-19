/**
 * GET /api/life-brief — grounded, user-specific Life Brief composed deterministically
 * from the Phase-7 readiness intelligence (career + education). Server-side imports of
 * the canonical scorers — no duplicated scoring, no LLM, no fabricated facts.
 */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreCareer } from '@/lib/readiness/career';
import { scoreEducation } from '@/lib/readiness/education';
import { fetchCareerData, fetchEducationData } from '@/lib/readiness/fetch';
import { composeLifeBrief } from '@/lib/lifeBrief/compose';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date().toISOString();
  const [careerData, educationData] = await Promise.all([
    fetchCareerData(supabase, user.id),
    fetchEducationData(supabase, user.id),
  ]);
  const career = scoreCareer(careerData, now);
  const education = scoreEducation(educationData, now);

  return NextResponse.json(composeLifeBrief(career, careerData, education, educationData, now));
}
