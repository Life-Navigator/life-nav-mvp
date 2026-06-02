/**
 * GET /api/platform/tenants/me
 *
 * Returns the calling user's tenant memberships + roles.
 */

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const r = await sb
    .from('platform_tenant_users')
    .select('tenant_id, role, joined_at, removed_at')
    .eq('user_id', user.id)
    .is('removed_at', null);
  const memberships = r.data ?? [];
  const tenant_ids = memberships.map((m: { tenant_id: string }) => m.tenant_id);
  let tenants: unknown[] = [];
  if (tenant_ids.length > 0) {
    const t = await sb.from('platform_tenants').select('*').in('id', tenant_ids);
    tenants = t.data ?? [];
  }
  return NextResponse.json({ memberships, tenants });
}
