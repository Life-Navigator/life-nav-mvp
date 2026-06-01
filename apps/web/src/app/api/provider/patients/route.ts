/**
 * GET /api/provider/patients
 *
 * Returns the calling provider's active engagements + minimal
 * patient header info. RLS on `provider_engagements` does the
 * scoping — providers see only rows where their provider_id matches.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabase as any;
  // Resolve provider profile.
  const { data: profile } = await sb
    .from('provider_profiles')
    .select('id, provider_type, primary_domains, verified')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ engagements: [] });

  const { data: engagements } = await sb
    .from('provider_engagements')
    .select('*')
    .eq('provider_id', profile.id)
    .order('updated_at', { ascending: false });

  return NextResponse.json({
    provider: profile,
    engagements: engagements ?? [],
  });
}
