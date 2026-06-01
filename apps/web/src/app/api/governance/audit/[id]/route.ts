/**
 * GET /api/governance/audit/[id]
 *
 * The "why was this blocked?" surface (Phase 9). Returns:
 *   - the row's recorded verdict + governance_version
 *   - a plain-language explanation built from the persisted
 *     violations (no internal regex / implementation details).
 *
 * RLS scopes audit rows to the patient (user_id = auth.uid()), so
 * the route does not need additional access checks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { explainDecision } from '@/lib/governance/governance-xai';
import type {
  GovernanceDecision,
  GovernanceViolation,
  PolicyCheckRecord,
  SaferAlternative,
} from '@/types/governance';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabase as any;
  const r = await sb.from('decision_governance_audit').select('*').eq('id', id).maybeSingle();
  if (!r.data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const decision: GovernanceDecision = {
    approved: r.data.approved,
    verdict: r.data.approved
      ? r.data.severity === 'medium' || r.data.severity === 'low'
        ? 'approved_with_warnings'
        : 'approved'
      : 'blocked',
    severity: r.data.severity,
    governance_version: r.data.governance_version,
    violations: (r.data.violations ?? []) as GovernanceViolation[],
    policy_checks: (r.data.policy_checks ?? []) as PolicyCheckRecord[],
    safer_alternatives: (r.data.safer_alternatives ?? []) as SaferAlternative[],
    input_hash: r.data.input_hash ?? '',
    computed_at: r.data.created_at,
  };
  const explanation = explainDecision(decision);
  return NextResponse.json({ explanation });
}
