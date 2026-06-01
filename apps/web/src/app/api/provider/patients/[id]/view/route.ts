/**
 * GET /api/provider/patients/[id]/view?domain=health
 *
 * Returns the scoped PatientView. Three barriers:
 *
 *   1. RLS on provider_engagements gives us the engagement only if
 *      the provider has one for this patient_user_id.
 *   2. ProviderAccessService.verifyAccess pre-flights the decision in TS.
 *   3. The SECURITY DEFINER RPC `providers.get_patient_summary`
 *      re-checks via `providers.has_access_to` before returning rows.
 *
 * If access is denied, returns 403 with the reasons.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { __test as accessTest } from '@/lib/provider/access-service';
import { loadPatientView } from '@/lib/provider/view-service';
import type { ProviderDomain } from '@/types/provider';

const { verifyAccess } = accessTest;
const VALID_DOMAINS: ProviderDomain[] = [
  'health',
  'financial',
  'career',
  'education',
  'estate',
  'benefits',
  'insurance',
  'behavioral',
  'rehabilitation',
];

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params;
  const domainParam = request.nextUrl.searchParams.get('domain') ?? 'health';
  const domain: ProviderDomain = VALID_DOMAINS.includes(domainParam as ProviderDomain)
    ? (domainParam as ProviderDomain)
    : 'health';

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabase as any;

  // 1. Provider profile.
  const { data: profile } = await sb
    .from('provider_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'Not a registered provider' }, { status: 403 });

  // 2. Engagement.
  const { data: engagement } = await sb
    .from('provider_engagements')
    .select('*')
    .eq('provider_id', profile.id)
    .eq('patient_user_id', patientId)
    .maybeSingle();

  // 3. Pre-flight via verifyAccess.
  const decision = verifyAccess({
    provider: profile,
    engagement: engagement ?? null,
    requested_domain: domain,
    requested_sensitivity: 'low',
  });
  if (!decision.allowed) {
    return NextResponse.json(
      { error: 'Access denied', reasons: decision.reasons },
      { status: 403 }
    );
  }

  // 4. RPC (which also re-checks).
  const view = await loadPatientView(sb, patientId, domain, {
    provider_id: profile.id,
    granted_at: engagement?.accepted_at ?? undefined,
  });

  return NextResponse.json({ view });
}
