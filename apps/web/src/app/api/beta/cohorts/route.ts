/**
 * GET /api/beta/cohorts
 *
 * Lists all defined cohorts + the calling user's memberships.
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sb = supabase as any;
  const cohorts = await sb.from('ops_cohorts').select('slug, name, description');
  let user_cohorts: Array<{ cohort_slug: string; joined_at: string }> = [];
  if (user) {
    const r = await sb
      .from('ops_user_cohorts')
      .select('cohort_slug, joined_at')
      .eq('user_id', user.id)
      .is('left_at', null);
    user_cohorts = r.data ?? [];
  }
  return NextResponse.json({
    cohorts: cohorts.data ?? [],
    user_cohorts,
  });
}
