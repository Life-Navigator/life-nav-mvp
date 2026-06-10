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

  const typeFilter = new URL(req.url).searchParams.get('type');
  const assets = rows
    .map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.asset_name || 'Asset',
      type: classify(r.asset_type),
      subtype: r.asset_type || undefined,
      value: Number(r.current_value ?? 0),
      currentValue: Number(r.current_value ?? 0),
      currency: 'USD',
      purchasePrice: r.purchase_price ?? undefined,
      purchaseDate: r.purchase_date ?? undefined,
      location: r.location ?? undefined,
      description: r.description ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
    .filter((a) => !typeFilter || typeFilter === 'all' || a.type === typeFilter);

  const byType: Record<string, { type: AssetType; count: number; value: number; equity: number }> =
    {};
  for (const a of assets) {
    byType[a.type] = byType[a.type] || { type: a.type, count: 0, value: 0, equity: 0 };
    byType[a.type].count += 1;
    byType[a.type].value += a.value;
    byType[a.type].equity += a.value; // no per-asset loans wired yet; equity = value
  }
  const totalValue = assets.reduce((n, a) => n + a.value, 0);

  return NextResponse.json({
    assets,
    summary: {
      totalValue,
      totalEquity: totalValue,
      totalDebt: 0,
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
  if (!body?.name || body?.value == null) {
    return NextResponse.json({ error: 'name and value are required' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const row = {
    user_id: user.id,
    asset_name: String(body.name),
    asset_type: classify(body.type), // store the normalized class
    current_value: Number(body.value ?? body.currentValue ?? 0),
    purchase_price: body.purchasePrice != null ? Number(body.purchasePrice) : null,
    purchase_date: body.purchaseDate
      ? new Date(body.purchaseDate).toISOString().slice(0, 10)
      : null,
    description: body.description ?? null,
    location: body.location ?? null,
    metadata: { source: 'user_entered' },
  };
  const { data, error } = await sb
    .schema('finance')
    .from('assets')
    .insert(row)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

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
