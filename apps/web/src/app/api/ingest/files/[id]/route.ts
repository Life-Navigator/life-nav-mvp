/**
 * GET /api/ingest/files/[id]
 *
 * Returns the file + its versions + its jobs. RLS-scoped.
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
  const [file, versions, jobs] = await Promise.all([
    sb.from('ingestion_files').select('*').eq('id', id).maybeSingle(),
    sb
      .from('ingestion_file_versions')
      .select('*')
      .eq('file_id', id)
      .order('version_number', { ascending: false }),
    sb
      .from('ingestion_extraction_jobs')
      .select('id, status, started_at, completed_at, deferred_reason, routed_extractors')
      .eq('file_id', id)
      .order('created_at', { ascending: false }),
  ]);
  if (!file.data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({
    file: file.data,
    versions: versions.data ?? [],
    jobs: jobs.data ?? [],
  });
}
