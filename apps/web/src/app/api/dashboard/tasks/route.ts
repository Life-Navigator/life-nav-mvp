import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    const {
      data: { user },
    } = await (supabase as any).auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: tasks, error } = await (supabase as any)
      .from('goals')
      .select('id, title, description, category, status, priority, target_date, progress_percent')
      .eq('user_id', user.id)
      .in('status', ['active', 'draft', 'not_started'])
      .order('target_date', { ascending: true, nullsFirst: false })
      .limit(10);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ tasks: tasks || [] });
  } catch (err) {
    console.error('Dashboard tasks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
