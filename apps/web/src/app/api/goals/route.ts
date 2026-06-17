import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { safeApiError } from '@/lib/security/safe-error';
import { recordUserEvent } from '@/lib/analytics/events';
import { createGoal } from '@/lib/services/goalsService';

export const dynamic = 'force-dynamic';

// The form submits a rich client-side Goal object (friendly camelCase + UI-only enums). We only
// require a title here; goalsService.toGoalRow() aliases + whitelists + maps it onto real columns
// and DB CHECK values. priority/status/category accept either friendly strings or numbers.
const createGoalSchema = z
  .object({
    title: z.string().min(1, 'A goal title is required').max(200),
  })
  .passthrough();

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
    if (error) return safeApiError({ code: 'validation_failed', internal: error });

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
        {
          error: 'validation_failed',
          message: parsed.error.errors[0]?.message ?? 'A goal title is required.',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    let goal;
    try {
      goal = await createGoal(supabase, user.id, parsed.data);
    } catch (dbErr: any) {
      // table=public.goals — log full detail server-side, return a stable, non-leaking code.
      return safeApiError({
        code: 'db_persistence_error',
        internal: dbErr,
        context: { route: 'POST /api/goals', table: 'public.goals' },
      });
    }

    await recordUserEvent(supabase, {
      user_id: user.id,
      event_type: 'goal_created',
      event_metadata: { category: goal?.category, priority: goal?.priority },
      subject_kind: 'goal',
      subject_id: goal?.id,
    });

    return NextResponse.json({ goal }, { status: 201 });
  } catch (err) {
    console.error('Goals POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
