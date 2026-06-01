/**
 * GET /api/engagements
 *
 * Returns the patient's active + pending engagements with providers.
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
  const { data } = await sb
    .from('provider_engagements')
    .select('*')
    .eq('patient_user_id', user.id)
    .order('updated_at', { ascending: false });
  return NextResponse.json({ engagements: data ?? [] });
}
