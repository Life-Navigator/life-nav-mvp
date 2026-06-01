/**
 * Shared helpers for the /api/provider/portal/* routes.
 *
 * Resolves the authenticated user to a provider_profiles row, and
 * provides a uniform response shape for the cross-cutting denial
 * cases (not authed, not a provider, engagement not theirs, etc.).
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface PortalSession {
  supabase: any;
  user_id: string;
  provider_id: string;
}

export async function loadPortalSession(): Promise<{
  session?: PortalSession;
  error?: NextResponse;
}> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: 'Not configured' }, { status: 503 }) };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const sb = supabase as any;
  const prof = await sb.from('provider_profiles').select('id').eq('user_id', user.id).maybeSingle();
  if (prof.error) {
    return { error: NextResponse.json({ error: prof.error.message }, { status: 500 }) };
  }
  if (!prof.data) {
    return {
      error: NextResponse.json(
        { error: 'Not a provider', reason: 'no_provider_profile' },
        { status: 403 }
      ),
    };
  }
  return {
    session: {
      supabase: sb,
      user_id: user.id,
      provider_id: prof.data.id,
    },
  };
}

export interface EngagementGuardResult {
  engagement?: {
    id: string;
    provider_id: string;
    patient_user_id: string;
    status: string;
    allowed_domains: string[];
    max_sensitivity: string;
    expires_at: string | null;
    revoked_at: string | null;
    accepted_at: string | null;
  };
  reason?: string;
}

export async function loadEngagementGuard(
  session: PortalSession,
  engagement_id: string,
  require_active = true
): Promise<EngagementGuardResult> {
  const r = await session.supabase
    .from('provider_engagements')
    .select(
      'id, provider_id, patient_user_id, status, allowed_domains, max_sensitivity, expires_at, revoked_at, accepted_at'
    )
    .eq('id', engagement_id)
    .eq('provider_id', session.provider_id)
    .maybeSingle();
  if (!r.data) return { reason: 'engagement_not_found' };
  if (require_active) {
    if (r.data.status !== 'active')
      return { reason: `engagement_status_${r.data.status}`, engagement: r.data };
    if (r.data.revoked_at) return { reason: 'engagement_revoked', engagement: r.data };
    if (r.data.expires_at && r.data.expires_at < new Date().toISOString()) {
      return { reason: 'engagement_expired', engagement: r.data };
    }
  }
  return { engagement: r.data };
}

export function deny(reason: string, status = 403): NextResponse {
  return NextResponse.json({ error: 'denied', reason }, { status });
}
