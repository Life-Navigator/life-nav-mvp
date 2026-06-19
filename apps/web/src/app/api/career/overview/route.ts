/**
 * GET /api/career/overview — real, server-computed snapshot of the user's career data
 * for the Career dashboard. Counts come from the canonical career.* tables (+ certifications
 * from education). No fabrication: absent data yields zeros and the UI shows honest empty states.
 */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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
  const count = async (schema: string, table: string, filters?: (q: any) => any) => {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      let q = sb
        .schema(schema)
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (filters) q = filters(q);
      const { count: c } = await q;
      return c || 0;
    } catch {
      return 0;
    }
  };

  // Employment list (for counts + current role).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let experience: any[] = [];
  try {
    const { data } = await sb
      .schema('career')
      .from('experience_records')
      .select('title, employer, start_date, end_date, is_current')
      .eq('user_id', user.id)
      .order('is_current', { ascending: false })
      .order('start_date', { ascending: false });
    experience = data || [];
  } catch {
    experience = [];
  }

  const current = experience.find((e) => e.is_current) || experience[0] || null;

  // Years of experience: earliest start_date across roles → now (honest, computed).
  let yearsExperience: number | null = null;
  const starts = experience
    .map((e) => e.start_date)
    .filter(Boolean)
    .sort();
  if (starts.length) {
    const first = new Date(starts[0]).getTime();
    if (!Number.isNaN(first)) {
      yearsExperience = Math.max(
        0,
        Math.round(((Date.now() - first) / (365.25 * 864e5)) * 10) / 10
      );
    }
  }

  const [volunteer, sideProjects, goals, certifications] = await Promise.all([
    count('career', 'volunteer_records'),
    count('career', 'side_projects'),
    count('career', 'career_goals', (q) => q.eq('status', 'active')),
    count('education', 'certifications'),
  ]);

  return NextResponse.json({
    currentRole: current?.title ?? null,
    currentEmployer: current?.employer ?? null,
    yearsExperience,
    counts: {
      employment: experience.length,
      volunteer,
      sideProjects,
      goals,
      certifications,
    },
  });
}
