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

  const emptyDashboard = {
    financial: {
      netWorth: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      checking: 0,
      savings: 0,
      investments: 0,
      hasData: false,
    },
    health: { nextAppointment: null, wellnessScore: null, medicationsDue: 0, hasData: false },
    career: { title: null, company: null, networkSize: 0, activeApplications: 0, hasData: false },
    education: { activeCourses: 0, completionRate: 0, studyStreak: 0, hasData: false },
    hasAnyData: false,
  };

  try {
    const sb = supabase as any;

    // Fetch career profile
    const { data: careerProfile } = await sb
      .from('career_profiles')
      .select('current_title, current_company')
      .eq('user_id', user.id)
      .single();

    // Fetch active job applications count
    const { count: activeApplications } = await sb
      .from('job_applications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['applied', 'interview']);

    // Fetch network connections count
    const { count: networkSize } = await sb
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Fetch education stats
    const { data: courses } = await sb
      .from('courses')
      .select('status, progress_percent')
      .eq('user_id', user.id);

    const courseList = (courses || []) as Array<{ status: string; progress_percent: number }>;
    const activeCourses = courseList.filter((c) => c.status === 'in_progress').length;
    const completedCourses = courseList.filter((c) => c.status === 'completed').length;
    const totalCourses = courseList.length;
    const completionRate =
      totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;

    const hasAnyData = !!(
      careerProfile ||
      (activeApplications && activeApplications > 0) ||
      totalCourses > 0
    );

    return NextResponse.json({
      ...emptyDashboard,
      career: {
        title: careerProfile?.current_title || null,
        company: careerProfile?.current_company || null,
        networkSize: networkSize ?? 0,
        activeApplications: activeApplications ?? 0,
        hasData: !!(careerProfile || (activeApplications && activeApplications > 0)),
      },
      education: {
        activeCourses,
        completionRate,
        studyStreak: 0,
        hasData: totalCourses > 0,
      },
      hasAnyData,
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    return NextResponse.json(emptyDashboard);
  }
}
