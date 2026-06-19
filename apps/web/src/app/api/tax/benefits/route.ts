/**
 * GET /api/tax/benefits?current=true — employer benefits from finance.employer_benefits,
 * mapped to the page's EmployerBenefits shape, plus derived opportunities.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const currentOnly = new URL(req.url).searchParams.get('current') === 'true';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let rows: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    let q = sb.schema('finance').from('employer_benefits').select('*').eq('user_id', user.id);
    if (currentOnly) q = q.eq('is_current', true);
    const { data } = await q;
    rows = data || [];
  } catch {
    rows = [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const benefits = rows.map((b: any) => {
    const health = b.health_benefits || {};
    const additional = b.additional_benefits || {};
    return {
      id: b.id,
      employerName: b.employer_name || 'Employer',
      isCurrentEmployer: !!b.is_current,
      baseSalary: b.salary != null ? Number(b.salary) : undefined,
      bonusTarget: b.bonus_target != null ? Number(b.bonus_target) : undefined,
      healthBenefits: Array.isArray(health.plans)
        ? health.plans
        : Object.keys(health).length
          ? [{ id: `${b.id}-health`, planType: health.plan_type || 'health', ...health }]
          : [],
      retirementBenefits:
        b.retirement_match_percent != null
          ? [
              {
                id: `${b.id}-retire`,
                planType: '401k',
                employerMatchPct: Number(b.retirement_match_percent),
                employerMatchLimit:
                  b.retirement_match_limit != null ? Number(b.retirement_match_limit) : undefined,
              },
            ]
          : [],
      additionalBenefits: Array.isArray(additional.items) ? additional.items : [],
    };
  });

  // Derived opportunities: unused retirement match.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opportunities: any[] = [];
  for (const b of rows) {
    const matchPct = Number(b.retirement_match_percent) || 0;
    const salary = Number(b.salary) || 0;
    if (matchPct > 0 && salary > 0) {
      opportunities.push({
        category: 'retirement',
        title: 'Maximize 401(k) match',
        description: `${b.employer_name || 'Your employer'} matches up to ${matchPct}% of salary.`,
        potentialSavings: Math.round((salary * matchPct) / 100),
        actionRequired: `Contribute at least ${matchPct}% of pay.`,
        priority: 9,
      });
    }
  }

  return NextResponse.json({
    benefits,
    opportunities,
    totalPotentialSavings: opportunities.reduce((n, o) => n + (o.potentialSavings || 0), 0),
  });
}
