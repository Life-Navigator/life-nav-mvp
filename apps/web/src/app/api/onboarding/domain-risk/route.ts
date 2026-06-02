import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const DOMAINS = ['financial', 'career', 'education', 'health', 'entrepreneurship'] as const;

const QUALITATIVE = [
  'very_conservative',
  'conservative',
  'moderate',
  'growth_oriented',
  'aggressive',
] as const;

function deriveQualitative(score: number): (typeof QUALITATIVE)[number] {
  if (score < 0.2) return 'very_conservative';
  if (score < 0.4) return 'conservative';
  if (score < 0.6) return 'moderate';
  if (score < 0.8) return 'growth_oriented';
  return 'aggressive';
}

const BodySchema = z.object({
  tolerances: z
    .array(
      z.object({
        domain: z.enum(DOMAINS),
        tolerance_score: z.number().min(0).max(1),
        qualitative_level: z.enum(QUALITATIVE).optional().nullable(),
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
  const rows = parsed.data.tolerances.map((t) => ({
    user_id: user.id,
    domain: t.domain,
    tolerance_score: t.tolerance_score,
    qualitative_level: t.qualitative_level ?? deriveQualitative(t.tolerance_score),
    notes: t.notes ?? null,
    source,
  }));

  const { error } = await (supabase as any)
    .from('user_domain_risk_tolerance')
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
    .from('user_domain_risk_tolerance')
    .select('domain, tolerance_score, qualitative_level, notes, updated_at')
    .eq('user_id', user.id);

  if (error) return safeApiError({ code: 'validation_failed', internal: error });
  return NextResponse.json({ tolerances: data ?? [] });
}
