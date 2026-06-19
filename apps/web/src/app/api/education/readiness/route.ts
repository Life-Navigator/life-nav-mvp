/**
 * GET /api/education/readiness — deterministic, explainable education readiness (0–100)
 * computed from the user's REAL education data. No fabricated assumptions.
 */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreEducation, type EducationData } from '@/lib/readiness/education';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const sel = async (schema: string, table: string, cols: string) => {
    try {
      const { data } = await sb.schema(schema).from(table).select(cols).eq('user_id', user.id);
      return data || [];
    } catch {
      return [];
    }
  };

  const [degrees, courses, certifications, licenses, goals, careerGoals] = await Promise.all([
    sel(
      'public',
      'education_records',
      'institution_name,degree_type,field_of_study,status,is_current,graduation_date,school_domain,school_logo_url'
    ),
    sel('public', 'courses', 'course_name,status,completion_date'),
    sel('education', 'certifications', 'name,issuer_domain,status'),
    sel('education', 'licenses', 'name,issuer_domain,status'),
    sel('education', 'education_goals', 'title,target_role,target_date,status'),
    sel('career', 'career_goals', 'status'),
  ]);

  const data: EducationData = {
    degrees,
    courses,
    certifications,
    licenses,
    goals,
    careerGoalsCount: (careerGoals as { status?: string }[]).filter(
      (g) => (g.status ?? 'active') === 'active'
    ).length,
  };
  return NextResponse.json(scoreEducation(data, new Date().toISOString()));
}
