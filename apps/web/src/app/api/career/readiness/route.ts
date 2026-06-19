/**
 * GET /api/career/readiness — deterministic, explainable career readiness (0–100)
 * computed from the user's REAL career data. No fabricated assumptions.
 */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreCareer, type CareerData } from '@/lib/readiness/career';

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

  const [experience, volunteer, sideProjects, goals, certifications, licenses] = await Promise.all([
    sel(
      'career',
      'experience_records',
      'title,employer,industry,start_date,end_date,is_current,responsibilities'
    ),
    sel('career', 'volunteer_records', 'organization,role,cause_area,is_current'),
    sel('career', 'side_projects', 'name,role,project_type,url'),
    sel('career', 'career_goals', 'title,target_role,target_date,status'),
    sel('education', 'certifications', 'name'),
    sel('education', 'licenses', 'name'),
  ]);

  const data: CareerData = { experience, volunteer, sideProjects, goals, certifications, licenses };
  return NextResponse.json(scoreCareer(data, new Date().toISOString()));
}
