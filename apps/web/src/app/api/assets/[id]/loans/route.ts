/**
 * GET  /api/assets/[id]/loans  — loans attached to one asset (finance.asset_loans).
 * POST /api/assets/[id]/loans  — attach a loan (mortgage / auto / heloc / personal / other).
 *
 * RLS-scoped (auth.uid() = user_id) with explicit user_id filters for defense in
 * depth. finance.asset_loans already exists (migration 031) and is granted to
 * `authenticated` (migration 105). Friendly camelCase body → real snake_case columns.
 */
import { NextResponse, NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const LOAN_TYPES = ['mortgage', 'auto_loan', 'heloc', 'personal', 'other'];

function num(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .schema('finance')
    .from('asset_loans')
    .select('*')
    .eq('user_id', user.id)
    .eq('asset_id', id)
    .order('created_at', { ascending: false });
  if (error)
    return safeApiError({
      code: 'db_persistence_error',
      internal: error,
      context: { route: '/api/assets/[id]/loans', table: 'finance.asset_loans' },
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loans = (data || []).map((l: any) => ({
    id: l.id,
    assetId: l.asset_id,
    loanType: l.loan_type,
    lender: l.lender,
    originalAmount: l.original_amount != null ? Number(l.original_amount) : undefined,
    currentBalance: Number(l.current_balance ?? 0),
    interestRate: l.interest_rate != null ? Number(l.interest_rate) : undefined,
    monthlyPayment: l.monthly_payment != null ? Number(l.monthly_payment) : undefined,
    startDate: l.start_date ?? undefined,
    endDate: l.end_date ?? undefined,
    isActive: l.is_active ?? true,
  }));
  return NextResponse.json({ loans });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const currentBalance = num(body.currentBalance ?? body.current_balance);
  if (currentBalance == null) {
    return safeApiError({
      code: 'validation_failed',
      publicMessage: 'A current loan balance is required.',
      context: { route: '/api/assets/[id]/loans', field: 'currentBalance' },
    });
  }
  const loanTypeRaw = String(body.loanType ?? body.loan_type ?? 'other').toLowerCase();
  const loanType = LOAN_TYPES.includes(loanTypeRaw) ? loanTypeRaw : 'other';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const row = {
    asset_id: id,
    user_id: user.id,
    loan_type: loanType,
    lender: body.lender ? String(body.lender) : null,
    original_amount: num(body.originalAmount ?? body.original_amount),
    current_balance: currentBalance,
    interest_rate: num(body.interestRate ?? body.interest_rate),
    monthly_payment: num(body.monthlyPayment ?? body.monthly_payment),
    start_date: body.startDate || body.start_date || null,
    end_date: body.endDate || body.end_date || null,
    is_active: body.isActive ?? true,
  };
  const { data, error } = await sb
    .schema('finance')
    .from('asset_loans')
    .insert(row)
    .select('*')
    .single();
  if (error)
    return safeApiError({
      code: 'db_persistence_error',
      internal: error,
      context: { route: '/api/assets/[id]/loans', table: 'finance.asset_loans', code: error.code },
    });

  return NextResponse.json({
    loan: {
      id: data.id,
      assetId: data.asset_id,
      loanType: data.loan_type,
      lender: data.lender,
      originalAmount: data.original_amount != null ? Number(data.original_amount) : undefined,
      currentBalance: Number(data.current_balance ?? 0),
      interestRate: data.interest_rate != null ? Number(data.interest_rate) : undefined,
      monthlyPayment: data.monthly_payment != null ? Number(data.monthly_payment) : undefined,
      startDate: data.start_date ?? undefined,
      endDate: data.end_date ?? undefined,
      isActive: data.is_active ?? true,
    },
  });
}
