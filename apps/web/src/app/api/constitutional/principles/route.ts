/**
 * GET /api/constitutional/principles
 *
 * Returns the 15 constitutional principles + the 13-step review order
 * + the active constitutional entity counts. Public read.
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  CONSTITUTIONAL_PRINCIPLES_9_15,
  CONSTITUTIONAL_REVIEW_ORDER,
} from '@/types/constitutional';
import { GOVERNANCE_VERSION, PRINCIPLES } from '@/types/governance';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  let entity_counts: Record<string, number> = {};
  if (supabase) {
    const sb = supabase as any;
    const r = await sb
      .from('constitutional_entities')
      .select('entity_kind')
      .eq('review_status', 'active');
    if (Array.isArray(r.data)) {
      entity_counts = r.data.reduce((acc: Record<string, number>, row: { entity_kind: string }) => {
        acc[row.entity_kind] = (acc[row.entity_kind] ?? 0) + 1;
        return acc;
      }, {});
    }
  }
  return NextResponse.json({
    governance_version: GOVERNANCE_VERSION,
    principles_1_to_8: PRINCIPLES,
    principles_9_to_15: CONSTITUTIONAL_PRINCIPLES_9_15,
    review_order: CONSTITUTIONAL_REVIEW_ORDER,
    entity_counts,
  });
}
