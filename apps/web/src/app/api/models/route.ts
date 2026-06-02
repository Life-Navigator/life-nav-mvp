/**
 * GET /api/models                       — public registry catalog
 * POST /api/models/tenant-override      — set { tenant_id, capability, provider, model_id }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const r = await sb.from('models_model_registry').select('*').eq('enabled', true);
  return NextResponse.json({ models: r.data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    tenant_id: string;
    capability: string;
    provider: string;
    model_id: string;
    enforced?: boolean;
  };
  if (!body.tenant_id || !body.capability || !body.provider || !body.model_id) {
    return NextResponse.json(
      { error: 'tenant_id, capability, provider, model_id required' },
      { status: 400 }
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const member = await sb.rpc('is_tenant_member', {
    p_tenant_id: body.tenant_id,
    p_user_id: user.id,
    p_min_role: 'admin',
  });
  if (!member.data) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const target = await sb
    .from('models_model_registry')
    .select('id')
    .eq('provider', body.provider)
    .eq('model_id', body.model_id)
    .maybeSingle();
  if (!target.data) return NextResponse.json({ error: 'model_not_found' }, { status: 404 });

  const up = await sb
    .from('models_tenant_model_overrides')
    .upsert(
      {
        tenant_id: body.tenant_id,
        capability: body.capability,
        model_registry_id: target.data.id,
        enforced: body.enforced ?? true,
      },
      { onConflict: 'tenant_id,capability' }
    )
    .select('*')
    .single();
  if (up.error) return safeApiError({ code: 'db_persistence_error', internal: up.error });
  return NextResponse.json({ override: up.data });
}
