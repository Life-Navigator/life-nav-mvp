/**
 * GET /api/provider/portal/clients
 *
 * Returns the provider's engagement list with bucket counts.
 * Used by /portal/provider/clients listing.
 */

import { NextResponse } from 'next/server';
import { loadPortalSession } from '@/lib/provider/portal-route-helpers';
import { classifyEngagementGroup } from '@/types/provider-portal';
import type { ProviderEngagement } from '@/types/provider';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { session, error } = await loadPortalSession();
  if (error) return error;
  const s = session!;
  const r = await s.supabase
    .from('provider_engagements')
    .select('*')
    .eq('provider_id', s.provider_id);
  const engagements = (r.data ?? []) as ProviderEngagement[];
  let active = 0,
    paused = 0,
    completed = 0;
  for (const e of engagements) {
    const g = classifyEngagementGroup(e.status);
    if (g === 'active') active++;
    else if (g === 'paused') paused++;
    else if (g === 'completed') completed++;
  }
  return NextResponse.json({
    active_count: active,
    paused_count: paused,
    completed_count: completed,
    engagements,
  });
}
