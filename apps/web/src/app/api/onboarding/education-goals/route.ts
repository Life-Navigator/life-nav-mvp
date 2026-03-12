import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const goals = body.goals;
  if (!goals) return NextResponse.json({ success: true });

  const rows = (Array.isArray(goals) ? goals : [goals])
    .filter((g: Record<string, unknown>) => g?.title || g?.primaryGoal)
    .map((g: Record<string, unknown>) => ({
      user_id: user.id,
      title: String(g.title || g.primaryGoal || ''),
      category: 'education',
      description: String(g.description || ''),
      priority: String(g.priority || 'medium'),
      status: 'active',
    }));

  if (rows.length) {
    const { error } = await supabase.from('goals').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, created: rows.length });
}
