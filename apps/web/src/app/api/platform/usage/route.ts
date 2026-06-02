/**
 * GET /api/platform/usage?tenant_id=&since=
 *
 * Returns recent platform.tenant_api_usage rows. Tenant admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const tenant_id = url.searchParams.get('tenant_id');
  const since = url.searchParams.get('since');
  if (!tenant_id) return NextResponse.json({ error: 'tenant_id required' }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let q = sb
    .from('platform_tenant_api_usage')
    .select('*')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false })
    .limit(500);
  if (since) q = q.gte('created_at', since);
  const r = await q;
  return NextResponse.json({ usage: r.data ?? [] });
}
