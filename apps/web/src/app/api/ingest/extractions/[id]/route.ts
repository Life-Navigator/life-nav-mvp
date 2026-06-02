/**
 * GET /api/ingest/extractions/[id]
 *
 * Returns one extraction row + its entities + its facts. RLS-scoped.
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const ex = await sb.from('ingestion_extractions').select('*').eq('id', id).maybeSingle();
  if (!ex.data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const [entities, facts] = await Promise.all([
    sb.from('ingestion_extracted_entities').select('*').eq('extraction_id', id),
    sb.from('ingestion_extracted_facts').select('*').eq('extraction_id', id),
  ]);
  return NextResponse.json({
    extraction: ex.data,
    entities: entities.data ?? [],
    facts: facts.data ?? [],
  });
}
