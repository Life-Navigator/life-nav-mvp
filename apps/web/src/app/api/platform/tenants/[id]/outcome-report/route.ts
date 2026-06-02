/**
 * GET /api/platform/tenants/[id]/outcome-report?window_days=30 — Sprint O.
 *
 * Returns the latest enterprise outcome report for the tenant.
 * Authorization: caller must be a tenant member (RLS enforces this
 * via platform.is_tenant_member). Aggregate-only — no per-user
 * identifiers leave this route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return safeApiError({ code: 'upstream_unavailable' });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeApiError({ code: 'unauthorized' });

  const { id: tenant_id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(tenant_id)) return safeApiError({ code: 'bad_request' });

  const url = request.nextUrl;
  const window_days = Math.max(
    1,
    Math.min(180, Number.parseInt(url.searchParams.get('window_days') ?? '30', 10) || 30)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const r = await sb
    .from('outcome_tenant_reports')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('window_days', window_days)
    .order('computed_at', { ascending: false })
    .limit(1);
  // RLS via `tr_member` ensures this returns nothing if the caller
  // is not a tenant member.
  const report = Array.isArray(r.data) ? (r.data[0] ?? null) : null;
  if (!report) return safeApiError({ code: 'not_found' });

  return NextResponse.json({ report });
}
