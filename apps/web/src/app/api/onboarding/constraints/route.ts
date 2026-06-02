import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const DIMENSIONS = ['time', 'money', 'health', 'family', 'geography', 'other'] as const;

const ConstraintSchema = z.object({
  dimension: z.enum(DIMENSIONS),
  severity: z.enum(['hard', 'soft']).default('soft'),
  description: z.string().trim().min(1).max(2000),
  value_numeric: z.number().finite().optional().nullable(),
  value_unit: z.string().trim().max(64).optional().nullable(),
  starts_at: z.string().date().optional().nullable(),
  ends_at: z.string().date().optional().nullable(),
  confidence_score: z.number().min(0).max(1).optional().nullable(),
});

const BodySchema = z.object({
  constraints: z.array(ConstraintSchema).max(50),
  replace_existing: z.boolean().optional().default(false),
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

  if (parsed.data.replace_existing) {
    const { error: delErr } = await (supabase as any)
      .from('user_constraints')
      .delete()
      .eq('user_id', user.id)
      .eq('source', source);
    if (delErr) return safeApiError({ code: 'validation_failed', internal: delErr });
  }

  if (parsed.data.constraints.length === 0) {
    return NextResponse.json({ success: true, created: 0 });
  }

  const rows = parsed.data.constraints.map((c) => ({
    user_id: user.id,
    dimension: c.dimension,
    severity: c.severity,
    description: c.description.trim(),
    value_numeric: c.value_numeric ?? null,
    value_unit: c.value_unit ?? null,
    starts_at: c.starts_at ?? null,
    ends_at: c.ends_at ?? null,
    is_active: true,
    source,
    confidence_score: c.confidence_score ?? null,
  }));

  const { error } = await (supabase as any).from('user_constraints').insert(rows);
  if (error) return safeApiError({ code: 'validation_failed', internal: error });

  return NextResponse.json({ success: true, created: rows.length });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await (supabase as any)
    .from('user_constraints')
    .select(
      'id, dimension, severity, description, value_numeric, value_unit, is_active, source, created_at'
    )
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return safeApiError({ code: 'validation_failed', internal: error });
  return NextResponse.json({ constraints: data ?? [] });
}
