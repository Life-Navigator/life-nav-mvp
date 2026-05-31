/**
 * Consent architecture endpoint. Wraps two layers:
 *
 *  - core.consent_records              policy-style (terms, privacy, ...)
 *  - core.user_integration_consents    integration-scoped (plaid, arcana, ...)
 *
 *  POST   { kind: 'policy' | 'integration', ... }    grant
 *  DELETE ?kind=integration&integration=plaid&purpose=transaction_sync
 *                                                    revoke
 *  GET                                                full consent snapshot
 *
 * Both forms stamp IP + user-agent server-side; they're never trusted
 * from the request body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function ipFromRequest(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  return req.headers.get('x-real-ip');
}

const PolicySchema = z.object({
  kind: z.literal('policy'),
  consent_type: z.string().trim().min(1).max(64), // 'terms_of_service' | 'privacy_policy' | 'data_processing' | ...
  version: z.string().trim().min(1).max(64),
  granted: z.boolean(),
  purpose: z.string().trim().max(128).optional().nullable(),
  scope: z.record(z.unknown()).optional(),
  expires_at: z.string().datetime().optional().nullable(),
});

const IntegrationSchema = z.object({
  kind: z.literal('integration'),
  integration: z.string().trim().min(1).max(64),
  purpose: z.string().trim().min(1).max(128),
  scope: z.record(z.unknown()).optional(),
  consent_version: z.string().trim().max(64).optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
});

const BodySchema = z.discriminatedUnion('kind', [PolicySchema, IntegrationSchema]);

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const ip = ipFromRequest(request);
  const ua = request.headers.get('user-agent');

  if (parsed.data.kind === 'policy') {
    const { error } = await (supabase as any)
      .schema('core')
      .from('consent_records')
      .insert({
        user_id: user.id,
        consent_type: parsed.data.consent_type,
        version: parsed.data.version,
        granted: parsed.data.granted,
        purpose: parsed.data.purpose ?? null,
        scope: parsed.data.scope ?? {},
        ip_address: ip,
        user_agent: ua,
        expires_at: parsed.data.expires_at ?? null,
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, kind: 'policy' });
  }

  // Integration consent — RPC stamps audit log atomically.
  const { data, error } = await (supabase as any).schema('core').rpc('record_integration_consent', {
    p_integration: parsed.data.integration,
    p_purpose: parsed.data.purpose,
    p_scope: parsed.data.scope ?? {},
    p_consent_version: parsed.data.consent_version ?? null,
    p_ip: ip,
    p_user_agent: ua,
    p_expires_at: parsed.data.expires_at ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, kind: 'integration', id: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const kind = request.nextUrl.searchParams.get('kind');
  if (kind !== 'integration') {
    return NextResponse.json(
      { error: 'Only integration consents support DELETE today' },
      { status: 400 }
    );
  }
  const integration = request.nextUrl.searchParams.get('integration');
  const purpose = request.nextUrl.searchParams.get('purpose');
  if (!integration || !purpose) {
    return NextResponse.json(
      { error: 'integration and purpose query parameters are required' },
      { status: 400 }
    );
  }

  const ip = ipFromRequest(request);
  const ua = request.headers.get('user-agent');
  const { data, error } = await (supabase as any).schema('core').rpc('revoke_integration_consent', {
    p_integration: integration,
    p_purpose: purpose,
    p_ip: ip,
    p_user_agent: ua,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, revoked: data === true });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: policies }, { data: integrations }] = await Promise.all([
    (supabase as any)
      .schema('core')
      .from('consent_records')
      .select(
        'id, consent_type, version, granted, purpose, scope, granted_at, revoked_at, expires_at'
      )
      .eq('user_id', user.id)
      .order('granted_at', { ascending: false }),
    (supabase as any)
      .schema('core')
      .from('user_integration_consents')
      .select(
        'id, integration, purpose, scope, granted, granted_at, revoked_at, expires_at, consent_version'
      )
      .eq('user_id', user.id),
  ]);

  return NextResponse.json({
    policies: policies ?? [],
    integrations: integrations ?? [],
  });
}
