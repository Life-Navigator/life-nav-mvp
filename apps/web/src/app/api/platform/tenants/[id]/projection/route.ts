/**
 * GET /api/platform/tenants/[id]/projection — Sprint S Phase 4.
 *
 * Returns the tenant's enterprise projection metadata + the resolved
 * 4-tier constitutional layer set (global / industry / organization /
 * user). RLS gates membership.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { resolveLayers, ruleSetVersion } from '@/lib/enterprise-projections/layer-resolver';
import type { LayerRule, Industry } from '@/lib/enterprise-projections/types';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return safeApiError({ code: 'upstream_unavailable' });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeApiError({ code: 'unauthorized' });

  const { id: tenant_id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(tenant_id)) return safeApiError({ code: 'bad_request' });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const projRes = await sb
    .from('projections_enterprise_projections')
    .select('*')
    .eq('tenant_id', tenant_id)
    .limit(1);
  const projection = Array.isArray(projRes.data) ? (projRes.data[0] ?? null) : null;
  if (!projection) return safeApiError({ code: 'not_found' });

  const rulesRes = await sb
    .from('projections_constitutional_layer_rules')
    .select('*')
    .or(
      [
        'layer.eq.global',
        `and(layer.eq.industry,industry.eq.${projection.industry})`,
        `and(layer.eq.organization,tenant_id.eq.${tenant_id})`,
        `and(layer.eq.user,user_id.eq.${user.id})`,
      ].join(',')
    );

  const rules: LayerRule[] = Array.isArray(rulesRes.data) ? (rulesRes.data as LayerRule[]) : [];
  const resolved = resolveLayers({
    rules,
    industry: projection.industry as Industry,
    tenant_id,
    user_id: user.id,
  });

  return NextResponse.json({
    projection,
    rule_set_version: ruleSetVersion(resolved.rules),
    rules: resolved.rules,
    blocked_overrides: resolved.blocked_overrides,
  });
}
