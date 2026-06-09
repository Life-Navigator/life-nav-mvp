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

    // Fetch persisted finance accounts (RLS-scoped). Mirrors the First Insight
    // engine's classification so the Financial Overview card and the brief
    // never contradict ("$242,200 …" above "No financial data" below).
    const ASSET = new Set(['checking', 'savings', 'investment', 'retirement']);
    let financial = { ...emptyDashboard.financial };
    try {
      const { data: accts } = await sb
        .schema('finance')
        .from('financial_accounts')
        .select('account_type, current_balance')
        .eq('user_id', user.id)
        .eq('is_active', true);
      const rows = (accts || []) as Array<{ account_type: string; current_balance: number | null }>;
      if (rows.length) {
        const sum = (pred: (t: string) => boolean) =>
          rows
            .filter((r) => pred(r.account_type))
            .reduce((n, r) => n + Number(r.current_balance ?? 0), 0);
        const checking = sum((t) => t === 'checking');
        const savings = sum((t) => t === 'savings');
        const investments = sum((t) => t === 'investment' || t === 'retirement');
        const totalAssets = sum((t) => ASSET.has(t));
        // Plaid returns mortgage/loan liabilities but not the backing assets
        // (home, car), so counting them yields a misleadingly negative net
        // worth. Mirror the First Insight engine: net worth = assets minus
        // credit-card debt; expose full liabilities (incl. mortgage) separately.
        const consumerDebt = sum((t) => t === 'credit_card');
        const totalLiabilities = sum(
          (t) => t === 'credit_card' || t === 'loan' || t === 'mortgage'
        );
        financial = {
          netWorth: totalAssets - consumerDebt,
          totalAssets,
          totalLiabilities,
          checking,
          savings,
          investments,
          hasData: true,
        };
      }
    } catch (finErr) {
      console.warn('Dashboard finance read failed:', (finErr as Error)?.message);
    }

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

    // Sprint 46 cohesion: the dashboard must reflect what the ADVISOR knows. Read canonical
    // life.life_objectives so each domain card surfaces the user's real objective — even when the
    // legacy domain tables are empty. One life model, one truth (no advisor/dashboard mismatch).
    const objByDomain: Record<string, string> = {};
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lifeObjs } = await (sb as any)
        .schema('life')
        .from('life_objectives')
        .select('title, domain, status')
        .eq('user_id', user.id)
        .eq('status', 'active');
      for (const o of lifeObjs || []) {
        if (o.domain && !objByDomain[o.domain]) objByDomain[o.domain] = o.title;
      }
    } catch {
      /* canonical objectives are additive; never block the summary */
    }

    const hasAnyData = !!(
      financial.hasData ||
      careerProfile ||
      (activeApplications && activeApplications > 0) ||
      totalCourses > 0 ||
      Object.keys(objByDomain).length > 0
    );

    return NextResponse.json({
      ...emptyDashboard,
      financial,
      career: {
        title: careerProfile?.current_title || null,
        company: careerProfile?.current_company || null,
        networkSize: networkSize ?? 0,
        activeApplications: activeApplications ?? 0,
        lifeObjective: objByDomain['career'] || null,
        hasData: !!(careerProfile || (activeApplications && activeApplications > 0)),
      },
      education: {
        activeCourses,
        completionRate,
        studyStreak: 0,
        lifeObjective: objByDomain['education'] || null,
        hasData: totalCourses > 0,
      },
      health: {
        ...emptyDashboard.health,
        lifeObjective: objByDomain['health'] || null,
      },
      family: { lifeObjective: objByDomain['family'] || null, hasData: false },
      hasAnyData,
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    return NextResponse.json(emptyDashboard);
  }
}
