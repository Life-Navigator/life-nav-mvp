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
import { persistSnapshot } from '@/lib/readiness/snapshot';
import { careerSnapshotFacts, educationSnapshotFacts } from '@/lib/readiness/snapshotFacts';

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
  const brief = composeLifeBrief(career, careerData, education, educationData, now);

  // Persist all three so the Python report cites the same numbers — career/education readiness
  // plus the composed Life Brief — even if the standalone readiness endpoints were never hit.
  await Promise.all([
    persistSnapshot(supabase, user.id, 'career', {
      score: career.score,
      status: career.status,
      confidence: career.confidence,
      components: career.components,
      strengths: career.strengths,
      gaps: career.gaps,
      recommendedActions: career.recommendedActions,
      dataSources: career.dataSources,
      missingData: career.missingData,
      payload: { ...career, snapshot: careerSnapshotFacts(careerData) },
    }),
    persistSnapshot(supabase, user.id, 'education', {
      score: education.score,
      status: education.status,
      confidence: education.confidence,
      components: education.components,
      strengths: education.strengths,
      gaps: education.gaps,
      recommendedActions: education.recommendedActions,
      dataSources: education.dataSources,
      missingData: education.missingData,
      payload: { ...education, snapshot: educationSnapshotFacts(educationData) },
    }),
    persistSnapshot(supabase, user.id, 'life_brief', {
      score: null, // the Life Brief has no single score — career/education each carry their own
      status: brief.state,
      confidence: brief.confidence,
      strengths: brief.strengths,
      gaps: brief.gaps,
      recommendedActions: brief.nextBestActions,
      dataSources: brief.dataSources,
      missingData: brief.missingData,
      payload: brief,
    }),
  ]);

  return NextResponse.json(brief);
}
