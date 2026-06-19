/**
 * GET /api/education/readiness — deterministic, explainable education readiness (0–100)
 * computed from the user's REAL education data. No fabricated assumptions.
 */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreEducation } from '@/lib/readiness/education';
import { fetchEducationData } from '@/lib/readiness/fetch';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await fetchEducationData(supabase, user.id);
  return NextResponse.json(scoreEducation(data, new Date().toISOString()));
}
