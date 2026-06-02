/**
 * GET /api/ingest/jobs/[id]
 *
 * Returns the job + its extractions + counts. RLS-scoped to owner.
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

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          k: string,
          v: string
        ) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
          eq?: (k: string, v: string) => Promise<{ data: Record<string, unknown>[] | null }>;
        };
      };
    };
  };

  const job = await sb.from('ingestion_extraction_jobs').select('*').eq('id', id).maybeSingle();
  if (!job.data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = supabase as any;
  const [extractions, entities, facts] = await Promise.all([
    sbAny
      .from('ingestion_extractions')
      .select('id, extractor_name, extraction_kind, confidence, language, duration_ms')
      .eq('job_id', id),
    sbAny
      .from('ingestion_extracted_entities')
      .select('id, entity_kind, canonical_text, confidence')
      .eq('job_id', id),
    sbAny
      .from('ingestion_extracted_facts')
      .select(
        'id, predicate, object_value, object_unit, object_text, object_date, extraction_confidence'
      )
      .eq('job_id', id),
  ]);

  return NextResponse.json({
    job: job.data,
    extractions: extractions.data ?? [],
    entities: entities.data ?? [],
    facts: facts.data ?? [],
  });
}
