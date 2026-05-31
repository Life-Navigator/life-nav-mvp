import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DEBT_TYPES = [
  'credit_card',
  'student_loan',
  'personal_loan',
  'medical_debt',
  'tax_debt',
  'family_loan',
  'business_loan',
  'other',
] as const;

const DebtSchema = z.object({
  debt_name: z.string().trim().min(1).max(128),
  debt_type: z.enum(DEBT_TYPES),
  lender: z.string().trim().max(128).optional().nullable(),
  original_amount: z.number().finite().nonnegative().optional().nullable(),
  current_balance: z.number().finite().nonnegative(),
  interest_rate: z.number().finite().min(0).max(2).optional().nullable(),
  minimum_payment: z.number().finite().nonnegative().optional().nullable(),
  payment_frequency: z
    .enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annual', 'other'])
    .optional(),
  due_day: z.number().int().min(1).max(31).optional().nullable(),
  payoff_strategy: z
    .enum(['avalanche', 'snowball', 'minimum_only', 'consolidation', 'refinance', 'custom'])
    .optional()
    .nullable(),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = z
    .object({
      debts: z.array(DebtSchema).max(50),
      replace_existing: z.boolean().optional().default(false),
      source: z.string().trim().min(1).max(64).optional(),
    })
    .safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const source = parsed.data.source ?? 'onboarding';

  if (parsed.data.replace_existing) {
    const { error: delErr } = await (supabase as any)
      .schema('finance')
      .from('debts')
      .delete()
      .eq('user_id', user.id)
      .eq('source', source);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  if (parsed.data.debts.length === 0) return NextResponse.json({ success: true, created: 0 });

  const rows = parsed.data.debts.map((d) => ({
    user_id: user.id,
    source,
    is_active: true,
    ...d,
  }));
  const { error } = await (supabase as any).schema('finance').from('debts').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, created: rows.length });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await (supabase as any)
    .schema('finance')
    .from('debts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('current_balance', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ debts: data ?? [] });
}
