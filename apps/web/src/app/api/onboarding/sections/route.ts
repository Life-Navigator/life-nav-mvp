import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const SECTIONS = [
  'core_life_vision',
  'financial',
  'career',
  'education',
  'health_wellness',
  'insurance_benefits',
  'family_lifestyle',
  'risk_decision_preferences',
  'commitment_capacity',
  'final_review',
] as const;

const PutSchema = z.object({
  section: z.enum(SECTIONS),
  status: z.enum(['not_started', 'in_progress', 'skipped', 'completed']),
  fields_captured: z.record(z.unknown()).optional(),
});

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await (supabase as any)
    .from('user_onboarding_sections')
    .select('section, status, completed_at, fields_captured, updated_at')
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Materialize an entry for every known section so the hub can render
  // a complete checklist regardless of whether the row already exists.
  const bySection = new Map<string, any>();
  for (const row of data ?? []) bySection.set(row.section, row);
  const sections = SECTIONS.map((s) => ({
    section: s,
    status: bySection.get(s)?.status ?? 'not_started',
    completed_at: bySection.get(s)?.completed_at ?? null,
    fields_captured: bySection.get(s)?.fields_captured ?? {},
    updated_at: bySection.get(s)?.updated_at ?? null,
  }));

  return NextResponse.json({ sections });
}

export async function PUT(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = PutSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const completed_at = parsed.data.status === 'completed' ? new Date().toISOString() : null;
  const { error } = await (supabase as any).from('user_onboarding_sections').upsert(
    {
      user_id: user.id,
      section: parsed.data.section,
      status: parsed.data.status,
      completed_at,
      fields_captured: parsed.data.fields_captured ?? {},
    },
    { onConflict: 'user_id,section' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
