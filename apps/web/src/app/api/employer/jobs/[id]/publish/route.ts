/**
 * POST /api/employer/jobs/[id]/publish
 *
 * Flips the job's status to 'published' (RLS enforces the caller is an
 * employer member of the owning employer_profile) and then triggers
 * the matcher under service_role to surface candidate matches.
 *
 * Matching needs cross-user reads, so it uses the service-role client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { refreshMatchesForJob } from '@/lib/marketplace/match-batch';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const service = createServiceRoleClient();
  if (!supabase || !service) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const sb: any = supabase;
  const { error } = await sb
    .from('employer_job_posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let scored = 0;
  try {
    const result = await refreshMatchesForJob(service, id);
    scored = result.scored;
  } catch (e) {
    // Surface the failure but don't undo the publish — the user can
    // retry matching via a future "refresh matches" route.
    return NextResponse.json({
      success: true,
      published: true,
      match_refresh_error: e instanceof Error ? e.message : 'match refresh failed',
    });
  }
  return NextResponse.json({ success: true, published: true, candidates_scored: scored });
}
