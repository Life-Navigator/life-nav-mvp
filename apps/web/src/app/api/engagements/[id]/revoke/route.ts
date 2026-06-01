/**
 * POST /api/engagements/[id]/revoke
 *
 * Patient-initiated immediate revocation. Sets status='revoked' and
 * revoked_at=NOW(). After this, `providers.has_access_to` returns
 * FALSE and any subsequent provider reads are blocked.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const Body = z.object({
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));

  const sb = supabase as any;
  const { data, error } = await sb
    .from('provider_engagements')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_reason: parsed.success ? (parsed.data.reason ?? null) : null,
    })
    .eq('id', id)
    .eq('patient_user_id', user.id)
    .select('*')
    .single();
  if (error || !data)
    return NextResponse.json({ error: 'Not found or not yours' }, { status: 404 });
  return NextResponse.json({ engagement: data });
}
