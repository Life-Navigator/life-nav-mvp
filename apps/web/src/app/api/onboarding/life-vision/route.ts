import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const HORIZONS = [
  '1_year',
  '3_year',
  '5_year',
  '10_year',
  'definition_of_success',
  'fears_to_avoid',
] as const;

const VisionEntrySchema = z.object({
  horizon: z.enum(HORIZONS),
  vision_text: z.string().trim().min(1).max(4000).optional().nullable(),
  domains: z.array(z.string().trim().min(1).max(64)).max(16).optional(),
  confidence_score: z.number().min(0).max(1).optional().nullable(),
});

const BodySchema = z.object({
  entries: z.array(VisionEntrySchema).min(1).max(HORIZONS.length),
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
  const rows = parsed.data.entries
    .filter((e) => e.vision_text && e.vision_text.trim().length > 0)
    .map((e) => ({
      user_id: user.id,
      horizon: e.horizon,
      vision_text: e.vision_text!.trim(),
      domains: e.domains ?? [],
      source,
      confidence_score: e.confidence_score ?? null,
    }));

  if (rows.length === 0) return NextResponse.json({ success: true, created: 0 });

  const { error } = await (supabase as any)
    .from('user_life_vision')
    .upsert(rows, { onConflict: 'user_id,horizon' });

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
    .from('user_life_vision')
    .select('id, horizon, vision_text, domains, confidence_score, source, updated_at')
    .eq('user_id', user.id)
    .order('horizon', { ascending: true });

  if (error) return safeApiError({ code: 'validation_failed', internal: error });
  return NextResponse.json({ entries: data ?? [] });
}
