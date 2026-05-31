import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ActionSchema = z.object({
  domain: z.string().trim().max(64).optional().nullable(),
  action_type: z.string().trim().min(1).max(128),
  action_title: z.string().trim().min(1).max(256),
  description: z.string().trim().max(4000).optional().nullable(),
  goal_id: z.string().uuid().optional().nullable(),
  decision_id: z.string().uuid().optional().nullable(),
  recommendation_id: z.string().uuid().optional().nullable(),
  taken_at: z.string().datetime().optional(),
  effort_minutes: z.number().int().min(0).optional().nullable(),
  cost_amount: z.number().finite().optional().nullable(),
  cost_currency: z.string().trim().length(3).optional().nullable(),
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']).optional(),
  source: z.string().trim().min(1).max(64).optional(),
  confidence_score: z.number().min(0).max(1).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = z
    .object({ actions: z.array(ActionSchema).max(50) })
    .safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  if (parsed.data.actions.length === 0) return NextResponse.json({ success: true, created: 0 });

  const rows = parsed.data.actions.map((a) => ({ user_id: user.id, ...a }));
  const { error } = await (supabase as any).from('user_actions').insert(rows);
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
    .from('user_actions')
    .select('*')
    .eq('user_id', user.id)
    .order('taken_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ actions: data ?? [] });
}
