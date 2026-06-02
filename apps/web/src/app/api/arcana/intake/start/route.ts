/**
 * POST /api/arcana/intake/start
 *
 * Idempotent: returns the existing arcana_profile if one exists for
 * the user; otherwise creates one. Optionally seeds a discovery
 * session record from Sprint H so the Need-Behind-Need drill-down
 * can start immediately.
 *
 * Body: { intake_source?: 'arcana'|'clinic'|...; referring_provider_id?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { recordUserEvent } from '@/lib/analytics/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    intake_source?: string;
    referring_provider_id?: string;
  };

  const sb = supabase as any;
  const existing = await sb
    .from('arcana_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing.error) {
    return safeApiError({ code: 'db_persistence_error', internal: existing.error });
  }
  if (existing.data) {
    return NextResponse.json({ profile: existing.data, created: false });
  }

  const insert = await sb
    .from('arcana_profiles')
    .insert({
      user_id: user.id,
      intake_source: body.intake_source ?? 'arcana',
      referring_provider_id: body.referring_provider_id ?? null,
      readiness_factors: [],
      provider_lead_consent_given: false,
      metadata: {},
    })
    .select('*')
    .single();

  if (insert.error) {
    return safeApiError({ code: 'db_persistence_error', internal: insert.error });
  }

  await recordUserEvent(sb, {
    user_id: user.id,
    event_type: 'arcana_intake_started',
    event_metadata: { intake_source: body.intake_source ?? 'arcana' },
    subject_kind: 'arcana_profile',
    subject_id: insert.data.id,
  });

  return NextResponse.json({ profile: insert.data, created: true });
}
