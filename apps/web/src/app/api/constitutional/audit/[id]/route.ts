/**
 * GET /api/constitutional/audit/[id]
 *
 * Returns the constitutional audit envelope including the
 * per-iteration trace. RLS scopes both tables to the user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sb = supabase as any;

  const a = await sb.from('decision_governance_audit').select('*').eq('id', id).maybeSingle();
  if (!a.data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const iter = await sb
    .from('governance_review_iterations')
    .select('*')
    .eq('audit_id', id)
    .order('iteration_index', { ascending: true });
  return NextResponse.json({ audit: a.data, iterations: iter.data ?? [] });
}
