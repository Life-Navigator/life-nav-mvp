import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  motivations: z
    .array(
      z.object({
        motivation_text: z.string().trim().min(1).max(2000),
        motivation_type: z
          .enum(['intrinsic', 'extrinsic', 'values_based', 'identity', 'fear_based'])
          .optional()
          .nullable(),
        intensity: z.number().int().min(1).max(10).optional().nullable(),
        goal_id: z.string().uuid().optional().nullable(),
        confidence_score: z.number().min(0).max(1).optional().nullable(),
      })
    )
    .max(50),
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

  if (parsed.data.motivations.length === 0) {
    return NextResponse.json({ success: true, created: 0 });
  }

  const source = parsed.data.source ?? 'onboarding';
  const rows = parsed.data.motivations.map((m) => ({
    user_id: user.id,
    motivation_text: m.motivation_text.trim(),
    motivation_type: m.motivation_type ?? null,
    intensity: m.intensity ?? null,
    goal_id: m.goal_id ?? null,
    source,
    confidence_score: m.confidence_score ?? null,
  }));

  const { error } = await (supabase as any).from('user_motivations').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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
    .from('user_motivations')
    .select('id, motivation_text, motivation_type, intensity, goal_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ motivations: data ?? [] });
}
