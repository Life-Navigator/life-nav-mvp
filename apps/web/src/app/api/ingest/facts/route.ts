/**
 * GET /api/ingest/facts
 *
 * Returns the most recent extracted facts for the user. Filters:
 *   - file_id
 *   - job_id
 *   - predicate
 *   - since (ISO date)
 *
 * Owner-scoped via RLS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const file_id = url.searchParams.get('file_id');
  const job_id = url.searchParams.get('job_id');
  const predicate = url.searchParams.get('predicate');
  const since = url.searchParams.get('since');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any).from('ingestion_extracted_facts').select('*');
  if (file_id) q = q.eq('file_id', file_id);
  if (job_id) q = q.eq('job_id', job_id);
  if (predicate) q = q.eq('predicate', predicate);
  if (since) q = q.gte('ingested_at', since);
  q = q.order('ingested_at', { ascending: false }).limit(200);

  const r = await q;
  return NextResponse.json({ facts: r.data ?? [] });
}
