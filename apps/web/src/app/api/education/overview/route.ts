/**
 * GET /api/education/overview — real, server-computed snapshot of the user's education
 * data for the Education dashboard. Counts from the canonical tables; no fabrication.
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
  const count = async (schema: string, table: string) => {
    try {
      const { count: c } = await sb
        .schema(schema)
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      return c || 0;
    } catch {
      return 0;
    }
  };

  // Highest completed degree (for a snapshot headline).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let topDegree: any = null;
  try {
    const { data } = await sb
      .from('education_records')
      .select('institution_name, degree_type, field_of_study, school_logo_url')
      .eq('user_id', user.id)
      .order('graduation_date', { ascending: false })
      .limit(1);
    topDegree = (data && data[0]) || null;
  } catch {
    topDegree = null;
  }

  const [degrees, certificates, licenses, courses, goals] = await Promise.all([
    count('public', 'education_records'),
    count('education', 'certifications'),
    count('education', 'licenses'),
    count('public', 'courses'),
    count('education', 'education_goals'),
  ]);

  return NextResponse.json({
    topDegree: topDegree
      ? {
          institution: topDegree.institution_name,
          degreeType: topDegree.degree_type,
          field: topDegree.field_of_study,
          logoUrl: topDegree.school_logo_url,
        }
      : null,
    counts: { degrees, certificates, licenses, courses, goals },
  });
}
