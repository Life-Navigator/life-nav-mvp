/**
 * POST /api/platform/tenants/[id]/policy-eval — Sprint S Phase 5.
 *
 * Evaluates the tenant's organization policies against a subject. RLS
 * gates the policy lookup. Audit row written best-effort.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { evaluatePolicies, recordPolicyDecision } from '@/lib/enterprise-projections/policy-engine';
import type { OrganizationPolicy } from '@/lib/enterprise-projections/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return safeApiError({ code: 'upstream_unavailable' });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeApiError({ code: 'unauthorized' });

  const { id: tenant_id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(tenant_id)) return safeApiError({ code: 'bad_request' });

  let body: { subject_kind?: string; subject_text?: string; subject_id?: string };
  try {
    body = await request.json();
  } catch {
    return safeApiError({ code: 'bad_request' });
  }
  if (!body.subject_kind || typeof body.subject_kind !== 'string') {
    return safeApiError({ code: 'bad_request' });
  }
  if (body.subject_kind.length > 256) return safeApiError({ code: 'bad_request' });
  const subject_text = (body.subject_text ?? '').slice(0, 16_000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const polRes = await sb
    .from('projections_organization_policies')
    .select('*')
    .eq('tenant_id', tenant_id);
  const policies: OrganizationPolicy[] = Array.isArray(polRes.data)
    ? (polRes.data as OrganizationPolicy[])
    : [];

  const result = evaluatePolicies({
    policies,
    subject_kind: body.subject_kind,
    subject_text,
  });

  await recordPolicyDecision(sb, {
    tenant_id,
    user_id: user.id,
    subject_kind: body.subject_kind,
    subject_id: body.subject_id,
    result,
  });

  return NextResponse.json({ result });
}
