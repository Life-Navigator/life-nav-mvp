/**
 * POST /api/arcana/lead-package/consent
 *
 * Creates a lead_package_consents row. The row is the gate the
 * package endpoint reads before generating the snapshot.
 *
 * Body: {
 *   recipient_provider_id?: string;
 *   consent_kind?: 'lead_package'|'full_record_share'|'prescreen_only';
 *   include_*: boolean;   // each section flag
 *   expires_at?: string;
 *   granted_via?: string;
 * }
 *
 * Revoking a consent is a separate PATCH so we keep the audit trail
 * (revoked_at) and downstream packages remain readable to the recipient
 * for the window the consent was alive.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const row = {
    user_id: user.id,
    recipient_provider_id: (body.recipient_provider_id as string | undefined) ?? null,
    consent_kind: (body.consent_kind as string | undefined) ?? 'lead_package',
    include_goals: body.include_goals !== false,
    include_constraints: body.include_constraints !== false,
    include_motivation: body.include_motivation !== false,
    include_biometrics: body.include_biometrics !== false,
    include_labs: body.include_labs === true,
    include_protocols: body.include_protocols !== false,
    include_supplements: body.include_supplements !== false,
    include_medications: body.include_medications === true,
    include_insurance: body.include_insurance === true,
    expires_at: (body.expires_at as string | undefined) ?? null,
    granted_via: (body.granted_via as string | undefined) ?? 'app',
    metadata: {},
  };

  const sb = supabase as any;
  const insert = await sb.from('lead_package_consents').insert(row).select('*').single();
  if (insert.error) return safeApiError({ code: 'db_persistence_error', internal: insert.error });

  await sb
    .from('arcana_profiles')
    .update({
      provider_lead_consent_given: true,
      provider_lead_consent_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  return NextResponse.json({ consent: insert.data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { consent_id: string };
  if (!body?.consent_id) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const sb = supabase as any;
  const upd = await sb
    .from('lead_package_consents')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', body.consent_id)
    .eq('user_id', user.id)
    .select('*')
    .single();
  if (upd.error) return safeApiError({ code: 'db_persistence_error', internal: upd.error });
  return NextResponse.json({ consent: upd.data });
}
