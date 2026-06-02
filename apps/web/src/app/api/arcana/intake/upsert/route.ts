/**
 * POST /api/arcana/intake/upsert
 *
 * Generic upsert endpoint for the seven intake-shaped tables.
 *
 * Body: { kind: 'goal'|'constraint'|'capability'|'motivation', rows: [...] }
 *
 * Every row is forced to user_id=auth.user.id and profile_id
 * resolved from the user's arcana_profile.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { recordUserEvent } from '@/lib/analytics/events';

export const dynamic = 'force-dynamic';

const TABLE: Record<string, string> = {
  goal: 'arcana_goals',
  constraint: 'arcana_constraints',
  capability: 'arcana_capabilities',
  motivation: 'arcana_motivations',
};

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    kind: keyof typeof TABLE;
    rows: Array<Record<string, unknown>>;
  };
  const table = TABLE[body?.kind];
  if (!table || !Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const sb = supabase as any;

  // Resolve profile.
  const prof = await sb.from('arcana_profiles').select('id').eq('user_id', user.id).maybeSingle();
  if (prof.error || !prof.data) {
    return NextResponse.json({ error: 'arcana profile not initialized' }, { status: 409 });
  }

  // Force user_id and profile_id; drop any caller-supplied values.
  const sanitized = body.rows.map((r) => ({
    ...r,
    user_id: user.id,
    profile_id: prof.data.id,
  }));

  const insert = await sb.from(table).insert(sanitized).select('*');
  if (insert.error) return safeApiError({ code: 'db_persistence_error', internal: insert.error });

  // arcana_intake_completed fires when motivations are recorded — the
  // motivation table is the last conventional step in the intake flow.
  if (body.kind === 'motivation') {
    await recordUserEvent(sb, {
      user_id: user.id,
      event_type: 'arcana_intake_completed',
      event_metadata: { rows_inserted: insert.data?.length ?? 0 },
      subject_kind: 'arcana_profile',
      subject_id: prof.data.id,
    });
  }

  return NextResponse.json({ inserted: insert.data });
}
