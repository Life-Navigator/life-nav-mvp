import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { resolveEntity, listEntity, createEntity } from '@/lib/services/familyService';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ entity: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { entity } = await ctx.params;
  const def = resolveEntity(entity);
  if (!def) return NextResponse.json({ error: 'Unknown entity' }, { status: 404 });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const items = await listEntity(supabase, user.id, def.table);
    return NextResponse.json({ items });
  } catch (err) {
    return safeApiError({ code: 'internal_error', internal: err });
  }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { entity } = await ctx.params;
  const def = resolveEntity(entity);
  if (!def) return NextResponse.json({ error: 'Unknown entity' }, { status: 404 });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const item = await createEntity(supabase, user.id, def, body);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return safeApiError({ code: 'bad_request', internal: err });
  }
}
