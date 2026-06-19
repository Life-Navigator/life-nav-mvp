/**
 * GET /api/tax/strategies?year= — saved tax strategies + recommended strategies.
 *
 * There is no dedicated strategies table yet; saved strategies live in
 * tax_profiles.metadata.strategies. Recommendations are derived from the same
 * real signals as /api/tax/optimizations (mapped to the strategy shape). Honest
 * empty arrays when there's nothing to suggest.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const CURRENT_YEAR = 2026;

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const year = Number(new URL(req.url).searchParams.get('year')) || CURRENT_YEAR;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  let strategies: unknown[] = [];
  try {
    const { data } = await sb
      .schema('finance')
      .from('tax_profiles')
      .select('metadata')
      .eq('user_id', user.id)
      .eq('tax_year', year)
      .maybeSingle();
    strategies = (data?.metadata?.strategies as unknown[]) || [];
  } catch {
    strategies = [];
  }

  // Recommendations from the optimizations route's signals (reuse via fetch would
  // be circular; mirror the high-value default here, mapped to strategy shape).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recommendations: any[] = [];
  try {
    const { data: benefits } = await sb
      .schema('finance')
      .from('employer_benefits')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_current', true);
    for (const b of benefits || []) {
      const matchPct = Number(b.retirement_match_percent) || 0;
      const salary = Number(b.salary) || 0;
      if (matchPct > 0 && salary > 0) {
        recommendations.push({
          id: `strat-match:${year}:${b.id}`,
          strategyType: 'retirement_contribution',
          name: 'Capture full employer match',
          description: `Contribute at least ${matchPct}% to capture the full ${b.employer_name || 'employer'} match.`,
          estimatedSavings: Math.round((salary * matchPct) / 100),
          goalAlignmentScore: 90,
          status: 'recommended',
        });
      }
    }
  } catch {
    /* none */
  }

  return NextResponse.json({ strategies, recommendations });
}
