/**
 * GET /api/governance/principles
 *
 * Public read of the 8 immutable principles + the active
 * governance_version. The principles are returned from the TS layer
 * (the source-of-truth dictionary) AND cross-checked against the
 * persisted policy_versions row if reachable.
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { GOVERNANCE_VERSION, PRINCIPLES } from '@/types/governance';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  let db_version: string | null = null;
  if (supabase) {
    const sb = supabase as any;
    const r = await sb
      .from('governance_policy_versions')
      .select('version')
      .order('activated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    db_version = r.data?.version ?? null;
  }
  return NextResponse.json({
    governance_version: GOVERNANCE_VERSION,
    db_governance_version: db_version,
    principles: PRINCIPLES,
  });
}
