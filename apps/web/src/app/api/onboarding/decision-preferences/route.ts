import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const AXES = ['speed', 'certainty', 'flexibility', 'upside'] as const;

const BodySchema = z.object({
  preferences: z
    .array(
      z.object({
        axis: z.enum(AXES),
        weight: z.number().min(0).max(1),
        notes: z.string().trim().max(2000).optional().nullable(),
      })
    )
    .min(1)
    .max(AXES.length),
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
  const rows = parsed.data.preferences.map((p) => ({
    user_id: user.id,
    axis: p.axis,
    weight: p.weight,
    notes: p.notes ?? null,
    source,
  }));

  const { error } = await (supabase as any)
    .from('user_decision_preferences')
    .upsert(rows, { onConflict: 'user_id,axis' });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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
    .from('user_decision_preferences')
    .select('axis, weight, notes, source, updated_at')
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ preferences: data ?? [] });
}
