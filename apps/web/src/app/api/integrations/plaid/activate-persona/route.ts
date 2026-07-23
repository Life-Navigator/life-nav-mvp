import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { recordUserEvent } from '@/lib/analytics/events';
import { safeApiError } from '@/lib/security/safe-error';
import { CORE_API } from '../_core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/integrations/plaid/activate-persona  { persona_id }
 *
 * Beta "sample financial profile" activation. The Plaid sandbox flow and ALL
 * finance.* persistence now happen on the backend (Fly core-api), which owns the
 * Plaid credentials — no Plaid secrets or direct Plaid calls live on the
 * frontend. This route stays a thin proxy that keeps only the two frontend-owned
 * side effects: the activation funnel analytics and the best-effort first
 * recommendation kickoff.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!user || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { persona_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const personaId = typeof body?.persona_id === 'string' ? body.persona_id : null;
  if (!personaId) {
    return NextResponse.json({ error: 'Unknown sample financial profile' }, { status: 400 });
  }

  // Service role for server-side audit writes (bypasses RLS). Best-effort.
  const svc = createServiceRoleClient();

  try {
    // Funnel: the user committed to a sample profile (counts even if it fails).
    if (svc) {
      await recordUserEvent(svc, {
        user_id: user.id,
        event_type: 'sample_financial_profile_selected',
        event_metadata: { persona_id: personaId },
        subject_kind: 'plaid_persona',
        subject_id: null,
      }).catch(() => {});
    }

    // Plaid sandbox flow + persistence run on the backend (creds are Fly secrets).
    const r = await fetch(`${CORE_API}/v1/finance/plaid/activate-persona`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ persona_id: personaId }),
      cache: 'no-store',
    });
    const data = await r.json().catch(() => ({}));

    if (svc) {
      await recordUserEvent(svc, {
        user_id: user.id,
        event_type: r.ok ? 'sample_financial_profile_activated' : 'persona_activation_failed',
        event_metadata: {
          persona_id: personaId,
          accounts_linked: data?.accounts_linked ?? null,
          transactions_synced: data?.transactions_synced ?? null,
          ...(r.ok
            ? {}
            : { stage: 'backend', message: data?.detail ?? data?.error ?? 'activation failed' }),
        },
        subject_kind: 'plaid_persona',
        subject_id: null,
      }).catch(() => {});
    }

    // Best-effort: kick off a first recommendation via the gateway. Never fails
    // activation if unavailable.
    if (r.ok) {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (apiUrl) {
          await fetch(`${apiUrl}/api/recommendations/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ trigger: 'financial_profile_activation' }),
            signal: AbortSignal.timeout(20_000),
          }).catch(() => {});
        }
      } catch {
        /* non-fatal */
      }
    }

    return NextResponse.json(data, { status: r.status });
  } catch (err) {
    console.error('Persona activation proxy error:', (err as Error)?.message);
    if (svc) {
      await recordUserEvent(svc, {
        user_id: user.id,
        event_type: 'persona_activation_failed',
        event_metadata: {
          persona_id: personaId,
          stage: 'proxy',
          message: (err as Error)?.message ?? 'unknown',
        },
        subject_kind: 'plaid_persona',
        subject_id: null,
      }).catch(() => {});
    }
    return safeApiError({ code: 'internal_error', internal: err });
  }
}
