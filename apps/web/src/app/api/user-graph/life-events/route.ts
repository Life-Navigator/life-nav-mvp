import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const EVENT_TYPES = [
  'marriage',
  'divorce',
  'birth',
  'death',
  'job_change',
  'job_loss',
  'promotion',
  'relocation',
  'home_purchase',
  'home_sale',
  'enrollment',
  'graduation',
  'diagnosis',
  'recovery',
  'injury',
  'inheritance',
  'windfall',
  'major_purchase',
  'retirement',
  'pet_added',
  'other',
] as const;

const EventSchema = z
  .object({
    domain: z.string().trim().max(64).optional().nullable(),
    event_type: z.enum(EVENT_TYPES),
    event_title: z.string().trim().min(1).max(256),
    description: z.string().trim().max(4000).optional().nullable(),
    occurred_at: z.string().date().optional().nullable(),
    expected_at: z.string().date().optional().nullable(),
    is_anticipated: z.boolean().optional(),
    impact_level: z.enum(['low', 'medium', 'high', 'major']).optional().nullable(),
    related_goal_id: z.string().uuid().optional().nullable(),
    source: z.string().trim().min(1).max(64).optional(),
    confidence_score: z.number().min(0).max(1).optional().nullable(),
  })
  .refine((v) => v.occurred_at || v.expected_at, {
    message: 'Either occurred_at or expected_at is required',
  });

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = z
    .object({ events: z.array(EventSchema).max(50) })
    .safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  if (parsed.data.events.length === 0) return NextResponse.json({ success: true, created: 0 });

  const rows = parsed.data.events.map((e) => ({ user_id: user.id, ...e }));
  const { error } = await (supabase as any).from('user_life_events').insert(rows);
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
    .from('user_life_events')
    .select('*')
    .eq('user_id', user.id)
    .order('occurred_at', { ascending: false, nullsFirst: false })
    .order('expected_at', { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) return safeApiError({ code: 'validation_failed', internal: error });
  return NextResponse.json({ events: data ?? [] });
}
