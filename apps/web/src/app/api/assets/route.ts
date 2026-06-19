/**
 * GET  /api/assets  — the user's NON-account assets (real estate, vehicles, business,
 *                     collectibles, other), classified by asset_type. Reads canonical
 *                     finance.assets (RLS + explicit user_id).
 * POST /api/assets  — manually add a real asset.
 *
 * IMPORTANT: this endpoint excludes account "mirrors" — rows that duplicate a
 * connected financial_account (metadata.source = 'connected_account' or a
 * plaid_account_id) and rows with asset_type 'investment'. Investment and retirement
 * balances live on the Investments/Retirement pages (sourced from financial_accounts);
 * the Assets page is for genuine non-account assets only. This prevents the same money
 * being counted as both an "investment" and an "asset".
 */
import { NextResponse, NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

type AssetType = 'real_estate' | 'vehicle' | 'collectible' | 'business' | 'other';

function classify(assetType?: string): AssetType {
  const v = (assetType || '').toLowerCase();
  if (['real_estate', 'home', 'property'].includes(v)) return 'real_estate';
  if (['vehicle', 'auto', 'car'].includes(v)) return 'vehicle';
  if (v === 'business') return 'business';
  if (['collectible', 'collectibles'].includes(v)) return 'collectible';
  return 'other';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAccountMirror(row: any): boolean {
  const md = row.metadata || {};
  if (md.source === 'connected_account' || md.plaid_account_id) return true;
  // Investment-type assets represent connected investment ACCOUNTS, not other assets.
  if ((row.asset_type || '').toLowerCase() === 'investment') return true;
  return false;
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];
  try {
    const { data } = await sb.schema('finance').from('assets').select('*').eq('user_id', user.id);
    rows = (data || []).filter((r: unknown) => !isAccountMirror(r));
  } catch {
    rows = [];
  }

  // Per-asset loans (finance.asset_loans) → group active balances by asset_id so
  // equity = current value − outstanding loans (computed server-side, Rule 1).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loansByAsset: Record<string, any[]> = {};
  try {
    const { data: loanRows } = await sb
      .schema('finance')
      .from('asset_loans')
      .select('*')
      .eq('user_id', user.id);
    for (const l of loanRows || []) {
      (loansByAsset[l.asset_id] = loansByAsset[l.asset_id] || []).push({
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
      });
    }
  } catch {
    /* asset_loans unavailable → equity falls back to current value */
  }

  // Sign image paths (private bucket) for direct <img> display.
  const imageUrlByAsset: Record<string, string> = {};
  await Promise.all(
    rows
      .filter((r) => r.image_url)
      .map(async (r) => {
        const { data: signed } = await supabase.storage
          .from('documents')
          .createSignedUrl(r.image_url, 60 * 60);
        if (signed?.signedUrl) imageUrlByAsset[r.id] = signed.signedUrl;
      })
  );

  const typeFilter = new URL(req.url).searchParams.get('type');
  const assets = rows
    .map((r) => {
      const currentValue = Number(r.current_value ?? 0);
      const purchasePrice = r.purchase_price != null ? Number(r.purchase_price) : undefined;
      const loans = loansByAsset[r.id] || [];
      const debt = loans.filter((l) => l.isActive).reduce((n, l) => n + (l.currentBalance || 0), 0);
      // equity/appreciation are computed HERE (server), never in the frontend (Rule 1).
      const equity = currentValue - debt;
      const appreciation =
        purchasePrice && purchasePrice > 0
          ? Math.round(((currentValue - purchasePrice) / purchasePrice) * 1000) / 10
          : null;
      return {
        id: r.id,
        userId: r.user_id,
        name: r.asset_name || 'Asset',
        type: classify(r.asset_type),
        subtype: r.asset_type || undefined,
        value: currentValue,
        currentValue,
        currency: 'USD',
        purchasePrice,
        purchaseDate: r.purchase_date ?? undefined,
        location: r.location ?? undefined,
        description: r.description ?? undefined,
        imageUrl: imageUrlByAsset[r.id] ?? undefined,
        loans,
        debt,
        equity,
        appreciation,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    })
    .filter((a) => !typeFilter || typeFilter === 'all' || a.type === typeFilter);

  const byType: Record<string, { type: AssetType; count: number; value: number; equity: number }> =
    {};
  for (const a of assets) {
    byType[a.type] = byType[a.type] || { type: a.type, count: 0, value: 0, equity: 0 };
    byType[a.type].count += 1;
    byType[a.type].value += a.value;
    byType[a.type].equity += a.equity;
  }
  const totalValue = assets.reduce((n, a) => n + a.value, 0);
  const totalDebt = assets.reduce((n, a) => n + (a.debt || 0), 0);

  return NextResponse.json({
    assets,
    summary: {
      totalValue,
      totalEquity: totalValue - totalDebt,
      totalDebt,
      byType: Object.values(byType),
    },
  });
}

export async function POST(req: NextRequest) {
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
  // The Add-Asset form sends `currentValue` (and `name`); accept the legacy `value` alias too.
  const rawValue = body?.value ?? body?.currentValue;
  if (!body?.name || rawValue == null || rawValue === '') {
    return safeApiError({
      code: 'validation_failed',
      publicMessage: 'Asset name and current value are required.',
      context: { route: '/api/assets', field: 'name|currentValue' },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const row = {
    user_id: user.id,
    asset_name: String(body.name),
    asset_type: classify(body.type), // store the normalized class
    current_value: Number(rawValue) || 0,
    purchase_price:
      body.purchasePrice != null && body.purchasePrice !== '' ? Number(body.purchasePrice) : null,
    purchase_date: body.purchaseDate
      ? new Date(body.purchaseDate).toISOString().slice(0, 10)
      : null,
    description: body.description || null,
    location: body.location || null,
    metadata: { source: 'user_entered' },
  };
  const { data, error } = await sb
    .schema('finance')
    .from('assets')
    .insert(row)
    .select('*')
    .single();
  if (error)
    return safeApiError({
      code: 'db_persistence_error',
      internal: error,
      context: { route: '/api/assets', table: 'finance.assets', code: error.code },
    });

  return NextResponse.json({
    asset: {
      id: data.id,
      userId: data.user_id,
      name: data.asset_name,
      type: classify(data.asset_type),
      value: Number(data.current_value ?? 0),
      currentValue: Number(data.current_value ?? 0),
      currency: 'USD',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  });
}
