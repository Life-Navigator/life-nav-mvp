import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createGoalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().default(''),
  category: z.string().default('personal'),
  priority: z.string().default('medium'),
  status: z.string().default('draft'),
  target_date: z.string().optional(),
  target_amount: z.number().optional(),
  current_amount: z.number().optional(),
  progress_percent: z.number().min(0).max(100).optional().default(0),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const {
      data: { user },
    } = await (supabase as any).auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('goals')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);

    const { data: goals, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ goals: goals || [], total: count || 0 });
  } catch (err) {
    console.error('Goals GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const {
      data: { user },
    } = await (supabase as any).auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = createGoalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data: goal, error } = await (supabase as any)
      .from('goals')
      .insert({ user_id: user.id, ...parsed.data })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ goal }, { status: 201 });
  } catch (err) {
    console.error('Goals POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
