/**
 * POST /api/platform/api-keys
 *   Body: { tenant_id, name, scopes?: string[], expires_at?: string, env?: 'test'|'live' }
 *   Returns: { id, prefix, plain_key }  ← plain key shown ONCE
 *
 * DELETE /api/platform/api-keys  (body: { id })
 *   Marks the key revoked.
 *
 * Auth: must be tenant admin or owner.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateKey } from '@/lib/tenant/api-keys';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    tenant_id: string;
    name: string;
    scopes?: string[];
    expires_at?: string;
    env?: 'test' | 'live';
  };
  if (!body.tenant_id || !body.name) {
    return NextResponse.json({ error: 'tenant_id and name required' }, { status: 400 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const role = await sb.rpc('is_tenant_member', {
    p_tenant_id: body.tenant_id,
    p_user_id: user.id,
    p_min_role: 'admin',
  });
  if (!role.data) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { plain, prefix, key_hash } = generateKey(body.env ?? 'live');
  const ins = await sb
    .from('platform_tenant_api_keys')
    .insert({
      tenant_id: body.tenant_id,
      name: body.name,
      prefix,
      key_hash,
      scopes: body.scopes ?? [],
      status: 'active',
      created_by: user.id,
      expires_at: body.expires_at ?? null,
    })
    .select('id, prefix')
    .single();
  if (ins.error) return safeApiError({ code: 'db_persistence_error', internal: ins.error });
  return NextResponse.json({ id: ins.data.id, prefix: ins.data.prefix, plain_key: plain });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { id: string };
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const upd = await sb
    .from('platform_tenant_api_keys')
    .update({ status: 'revoked' })
    .eq('id', body.id)
    .select('tenant_id')
    .single();
  if (upd.error) return safeApiError({ code: 'db_persistence_error', internal: upd.error });
  return NextResponse.json({ ok: true });
}
