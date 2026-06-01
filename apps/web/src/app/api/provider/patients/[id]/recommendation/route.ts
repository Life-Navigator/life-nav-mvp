/**
 * POST /api/provider/patients/[id]/recommendation
 *
 * Body: { engagement_id, domain, title, body, rationale?, related_goal_id?,
 *         expected_horizon_months?, expected_strength?, citations? }
 *
 * Issues a provider_recommendation. The INSERT policy on the table
 * gates this via providers.has_access_to(...), so a provider without
 * an active engagement is blocked at the DB level.
 *
 * GET on the same path lists recommendations the provider has issued
 * for this patient.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { issueRecommendation, listRecommendations } from '@/lib/provider/recommendation-service';

export const dynamic = 'force-dynamic';

const Body = z.object({
  engagement_id: z.string().uuid(),
  domain: z.enum([
    'health',
    'financial',
    'career',
    'education',
    'estate',
    'benefits',
    'insurance',
    'behavioral',
    'rehabilitation',
  ]),
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(8000),
  rationale: z.string().trim().max(8000).optional(),
  related_goal_id: z.string().uuid().optional().nullable(),
  expected_horizon_months: z.number().int().min(1).max(360).optional(),
  expected_strength: z.number().min(0).max(1).optional(),
  citations: z
    .array(
      z.object({
        label: z.string().min(1).max(300),
        source: z.string().max(100).optional(),
        citation_reference: z.string().max(300).optional(),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params;
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

  const sb = supabase as any;
  const { data: profile } = await sb
    .from('provider_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'Not a registered provider' }, { status: 403 });

  const created = await issueRecommendation(sb, {
    provider_id: profile.id,
    patient_user_id: patientId,
    engagement_id: parsed.data.engagement_id,
    domain: parsed.data.domain,
    title: parsed.data.title,
    body: parsed.data.body,
    rationale: parsed.data.rationale,
    related_goal_id: parsed.data.related_goal_id ?? undefined,
    expected_horizon_months: parsed.data.expected_horizon_months,
    expected_strength: parsed.data.expected_strength,
    citations: parsed.data.citations as
      | Array<{ label: string; source?: string; citation_reference?: string; confidence?: number }>
      | undefined,
  });
  if (!created) return NextResponse.json({ error: 'Insert blocked or failed' }, { status: 403 });
  return NextResponse.json({ recommendation: created }, { status: 201 });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabase as any;
  const { data: profile } = await sb
    .from('provider_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ recommendations: [] });
  const rows = await listRecommendations(sb, {
    patient_user_id: patientId,
    provider_id: profile.id,
  });
  return NextResponse.json({ recommendations: rows });
}
