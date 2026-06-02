import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const DOMAINS = [
  'financial',
  'career',
  'education',
  'health',
  'family',
  'wellness',
  'lifestyle',
  'overall',
] as const;

const BodySchema = z.object({
  commitments: z
    .array(
      z.object({
        domain: z.enum(DOMAINS),
        hours_per_week: z.number().min(0).max(168).optional().nullable(),
        energy_level: z.enum(['low', 'medium', 'high']).optional().nullable(),
        duration_weeks: z.number().int().positive().max(520).optional().nullable(),
        notes: z.string().trim().max(2000).optional().nullable(),
      })
    )
    .min(1)
    .max(DOMAINS.length),
  source: z.string().trim().min(1).max(64).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const source = parsed.data.source ?? 'onboarding';
  const rows = parsed.data.commitments.map((c) => ({
    user_id: user.id,
    domain: c.domain,
    hours_per_week: c.hours_per_week ?? null,
    energy_level: c.energy_level ?? null,
    duration_weeks: c.duration_weeks ?? null,
    notes: c.notes ?? null,
    source,
  }));

  const { error } = await (supabase as any)
    .from('user_commitment_levels')
    .upsert(rows, { onConflict: 'user_id,domain' });

  if (error) return safeApiError({ code: 'validation_failed', internal: error });
  return NextResponse.json({ success: true, count: rows.length });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await (supabase as any)
    .from('user_commitment_levels')
    .select('domain, hours_per_week, energy_level, duration_weeks, notes, updated_at')
    .eq('user_id', user.id);

  if (error) return safeApiError({ code: 'validation_failed', internal: error });
  return NextResponse.json({ commitments: data ?? [] });
}
