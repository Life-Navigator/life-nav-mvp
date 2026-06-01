/**
 * GET /api/provider/portal/messages/thread?engagement_id=...
 *
 * Returns the projected thread for one engagement, scoped to the
 * authenticated user (either provider or patient — RLS handles it).
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectThread } from '@/lib/provider/message-service';
import { loadPortalSession } from '@/lib/provider/portal-route-helpers';
import type { ProviderMessage } from '@/types/provider-portal';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { session, error } = await loadPortalSession();
  if (error) return error;
  const engagementId = new URL(req.url).searchParams.get('engagement_id');
  if (!engagementId) return NextResponse.json({ error: 'engagement_id required' }, { status: 400 });

  const r = await session!.supabase
    .from('provider_messages')
    .select('*')
    .eq('engagement_id', engagementId);
  const projected = projectThread((r.data ?? []) as ProviderMessage[], session!.user_id);
  return NextResponse.json(projected);
}
