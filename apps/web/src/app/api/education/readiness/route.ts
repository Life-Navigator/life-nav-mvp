/**
 * GET /api/education/readiness — deterministic, explainable education readiness (0–100)
 * computed from the user's REAL education data. No fabricated assumptions.
 */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreEducation } from '@/lib/readiness/education';
import { fetchEducationData } from '@/lib/readiness/fetch';
import { persistSnapshot } from '@/lib/readiness/snapshot';
import { educationSnapshotFacts } from '@/lib/readiness/snapshotFacts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await fetchEducationData(supabase, user.id);
  const result = scoreEducation(data, new Date().toISOString());
  // Record the computed result so the Python advisor/report cite the same numbers (one source of truth).
  await persistSnapshot(supabase, user.id, 'education', {
    score: result.score,
    status: result.status,
    confidence: result.confidence,
    components: result.components,
    strengths: result.strengths,
    gaps: result.gaps,
    recommendedActions: result.recommendedActions,
    dataSources: result.dataSources,
    missingData: result.missingData,
    payload: { ...result, snapshot: educationSnapshotFacts(data) },
  });
  return NextResponse.json(result);
}
