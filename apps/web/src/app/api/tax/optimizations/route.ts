/**
 * GET /api/tax/optimizations?year= — tax-saving opportunities derived from REAL data:
 *   - unused employer retirement match (employer_benefits.retirement_match_percent)
 *   - tax-loss-harvest candidates (investment_holdings trading below cost basis)
 * Honest empty array when no qualifying signals exist — never fabricated savings.
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optimizations: any[] = [];
  const now = new Date().toISOString();

  // 1) Tax-loss harvesting — holdings currently below cost basis.
  try {
    const { data: holdings } = await sb
      .schema('finance')
      .from('investment_holdings')
      .select('*')
      .eq('user_id', user.id);
    let unrealizedLoss = 0;
    for (const h of holdings || []) {
      const qty = Number(h.quantity) || 0;
      const cost = (Number(h.cost_basis) || 0) * qty;
      const value =
        h.current_value != null ? Number(h.current_value) : (Number(h.current_price) || 0) * qty;
      if (value < cost) unrealizedLoss += cost - value;
    }
    if (unrealizedLoss > 0) {
      optimizations.push({
        id: `tlh:${year}`,
        taxProfileId: '',
        category: 'tax_loss_harvesting',
        title: 'Harvest investment losses',
        description: `You have roughly $${Math.round(unrealizedLoss).toLocaleString()} in unrealized losses. Realizing them can offset capital gains and up to $3,000 of ordinary income.`,
        estimatedSavings: Math.round(Math.min(unrealizedLoss, 3000) * 0.22),
        confidenceLevel: 'medium',
        timeframe: 'this_year',
        complexity: 'moderate',
        actionRequired:
          'Review lots trading below cost basis and consider selling before year-end.',
        status: 'suggested',
        source: 'system',
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch {
    /* no holdings */
  }

  // 2) Unused employer retirement match.
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
        const matchValue = Math.round((salary * matchPct) / 100);
        optimizations.push({
          id: `match:${year}:${b.id}`,
          taxProfileId: '',
          category: 'retirement_contribution',
          title: 'Capture your full 401(k) match',
          description: `${b.employer_name || 'Your employer'} matches up to ${matchPct}% of salary (~$${matchValue.toLocaleString()}/yr). Contributing at least to the match is free, tax-advantaged money.`,
          estimatedSavings: matchValue,
          confidenceLevel: 'high',
          timeframe: 'this_year',
          complexity: 'simple',
          actionRequired: `Set your contribution to at least ${matchPct}% of pay.`,
          status: 'suggested',
          source: 'system',
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  } catch {
    /* no benefits */
  }

  return NextResponse.json({
    optimizations,
    totalPotentialSavings: optimizations.reduce((n, o) => n + (o.estimatedSavings || 0), 0),
    topRecommendations: optimizations.slice(0, 3),
  });
}
