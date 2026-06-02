/**
 * GET /api/connectors
 *
 * Returns the public connector catalog plus, if a tenant_id is
 * supplied, the tenant's existing connections.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const tenant_id = new URL(request.url).searchParams.get('tenant_id');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const catalog = await sb.from('connectors_connector_registry').select('*').eq('enabled', true);
  let connections: unknown[] = [];
  if (tenant_id) {
    const r = await sb.from('connectors_tenant_connections').select('*').eq('tenant_id', tenant_id);
    connections = r.data ?? [];
  }
  return NextResponse.json({ catalog: catalog.data ?? [], connections });
}
