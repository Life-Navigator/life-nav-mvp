import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { resolveCareerEntity } from '@/lib/services/careerEntityService';
import { deleteEntity } from '@/lib/services/domainCrud';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ entity: string; id: string }> };

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { entity, id } = await ctx.params;
  const def = resolveCareerEntity(entity);
  if (!def) return NextResponse.json({ error: 'Unknown entity' }, { status: 404 });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await deleteEntity(supabase, user.id, def, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return safeApiError({ code: 'internal_error', internal: err });
  }
}
