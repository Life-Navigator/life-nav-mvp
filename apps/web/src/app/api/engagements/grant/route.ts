/**
 * POST /api/engagements/grant
 *
 * Body: { provider_id, allowed_domains[], max_sensitivity?, expires_at?,
 *         can_issue_recommendations? }
 *
 * Patient-initiated engagement grant. Creates a pending row in
 * `provider_engagements` and immediately accepts it (because this IS
 * the patient acting). The provider sees it next time they list
 * patients.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const Body = z.object({
  provider_id: z.string().uuid(),
  allowed_domains: z
    .array(
      z.enum([
        'health',
        'financial',
        'career',
        'education',
        'estate',
        'benefits',
        'insurance',
        'behavioral',
        'rehabilitation',
      ])
    )
    .min(1),
  max_sensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
  expires_at: z.string().datetime().optional().nullable(),
  can_issue_recommendations: z.boolean().default(true),
  notes_for_provider: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Bad request', details: parsed.error.flatten() },
      { status: 400 }
    );

  const now = new Date().toISOString();
  const sb = supabase as any;
  const row = {
    provider_id: parsed.data.provider_id,
    patient_user_id: user.id,
    status: 'active',
    allowed_domains: parsed.data.allowed_domains,
    max_sensitivity: parsed.data.max_sensitivity,
    can_issue_recommendations: parsed.data.can_issue_recommendations,
    initiated_by: 'patient',
    invited_at: now,
    accepted_at: now,
    expires_at: parsed.data.expires_at ?? null,
    notes_for_provider: parsed.data.notes_for_provider ?? null,
  };
  const { data, error } = await sb
    .from('provider_engagements')
    .upsert(row, { onConflict: 'provider_id,patient_user_id' })
    .select('*')
    .single();
  if (error) return safeApiError({ code: 'db_persistence_error', internal: error });
  return NextResponse.json({ engagement: data }, { status: 201 });
}
